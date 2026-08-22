import path from "node:path";
import type { Gender } from "@/db/schema";
import highsLoader from "highs";

// Turbopack rewrites highs.js's own bundled path lookup for its companion
// .wasm file, breaking the default resolution (and a require.resolve() to
// the package's "runtime" export subpath just makes Turbopack try, and
// fail, to run the file through its own broken WASM-asset pipeline). Build
// the real filesystem path by hand instead, from segments that never spell
// out ".wasm" as a single string literal, so no bundler asset pipeline
// recognizes it as an import to intercept.
const HIGHS_WASM_PATH = path.join(
  process.cwd(),
  "node_modules",
  "highs",
  "build",
  ["highs", "wasm"].join("."),
);

export const BENCH = "BENCH";

// Rating a player gets at a position they have no explicit rating for.
const DEFAULT_RATING = 5;

export interface FieldingSolverPlayer {
  id: string;
  gender: Gender;
}

export interface PositionProfile {
  name: string;
  importance: number;
}

export interface GenderMinimum {
  gender: Gender;
  min: number;
}

/** A player's rating (1-10) at a specific fielding position. */
export interface PositionRating {
  playerId: string;
  positionName: string;
  rating: number;
}

export interface FieldingSolverInput {
  players: FieldingSolverPlayer[];
  positions: PositionProfile[];
  innings: number;
  genderMinimums: GenderMinimum[];
  ratings?: PositionRating[];
}

export interface FieldingAssignment {
  inning: number;
  playerId: string;
  position: string;
}

export interface FieldingSolverResult {
  assignments: FieldingAssignment[];
  warnings: string[];
}

// The WASM module takes real time to instantiate; load it once and reuse
// it across every solve call in this process instead of per-call.
let highsPromise: ReturnType<typeof highsLoader> | null = null;
function getHighs() {
  if (!highsPromise) {
    highsPromise = highsLoader({ locateFile: () => HIGHS_WASM_PATH });
  }
  return highsPromise;
}

function rangeInclusive(start: number, end: number): number[] {
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

/**
 * Generates a per-inning fielding rotation — who fields which position,
 * and who's on the bench — by solving the whole game at once as a single
 * integer linear program (via HiGHS), rather than deciding each inning
 * greedily. Decision variable x[player][inning][position] = 1 means that
 * player fields that position that inning; a player with no position set
 * to 1 for a given inning is on the bench. Constraints: every position is
 * filled by exactly one player each inning; a player fields at most one
 * position per inning; each player's total field-innings across the whole
 * game falls within one of the fairest possible split (floor/ceil of
 * innings*fieldSize/players.length — the same bound applies to every
 * player regardless of gender, which is enough on its own to also keep
 * each gender's bench counts within 1 of each other); each inning meets
 * the league's per-gender minimums (skipped, with a warning, for any
 * gender whose roster total can never satisfy it). The objective
 * maximizes total quality (position importance × rating) — this is a
 * genuine global optimum, not a per-inning approximation, verified
 * against brute-force search in the test suite.
 *
 * The last inning of a multi-inning game is the team's extra/tie-breaker
 * slot, which might not even get played. That's handled as a second,
 * lexicographic solve: first maximize quality over the real innings only,
 * then re-solve with that value pinned as a floor and *minimize* the
 * extra inning's quality — so real innings always get the strongest
 * lineup the fairness constraints allow, and the extra inning only ever
 * gets a weaker one when doing so costs the real innings nothing.
 */
export async function solveFielding(input: FieldingSolverInput): Promise<FieldingSolverResult> {
  const { players, positions, innings, genderMinimums } = input;
  const warnings: string[] = [];
  const assignments: FieldingAssignment[] = [];

  const ratingMap = new Map<string, number>();
  for (const r of input.ratings ?? []) {
    ratingMap.set(`${r.playerId}::${r.positionName}`, r.rating);
  }

  if (players.length === 0 || innings <= 0 || positions.length === 0) {
    return { assignments, warnings };
  }

  const fieldSize = Math.min(positions.length, players.length);
  if (fieldSize < positions.length) {
    warnings.push(
      `Only ${players.length} players present for ${positions.length} positions; ${
        positions.length - fieldSize
      } position(s) will go unfilled each inning.`,
    );
  }
  const usedPositions = positions.slice(0, fieldSize);

  const totalsByGender = new Map<Gender, number>();
  for (const p of players) {
    totalsByGender.set(p.gender, (totalsByGender.get(p.gender) ?? 0) + 1);
  }
  const feasibleGenderMins = genderMinimums.filter((gm) => {
    const total = totalsByGender.get(gm.gender) ?? 0;
    if (total < gm.min) {
      warnings.push(
        `Only ${total} players of gender ${gm.gender} present; league requires at least ${gm.min} fielding each inning. This minimum cannot always be met.`,
      );
      return false;
    }
    return true;
  });

  const varName = (pIdx: number, inning: number, kIdx: number) => `x_${pIdx}_${inning}_${kIdx}`;

  const allVariableNames: string[] = [];
  for (let pIdx = 0; pIdx < players.length; pIdx++) {
    for (let inning = 1; inning <= innings; inning++) {
      for (let kIdx = 0; kIdx < usedPositions.length; kIdx++) {
        allVariableNames.push(varName(pIdx, inning, kIdx));
      }
    }
  }

  // Quality (importance x rating) contributed by fielding player pIdx at
  // position kIdx, used both for the objective and to weight constraint
  // terms consistently.
  const qualityOf = (pIdx: number, kIdx: number) => {
    const player = players[pIdx];
    const position = usedPositions[kIdx];
    const rating = ratingMap.get(`${player.id}::${position.name}`) ?? DEFAULT_RATING;
    return position.importance * rating;
  };

  function objectiveTerms(inningRange: number[]): string {
    const terms: string[] = [];
    for (let pIdx = 0; pIdx < players.length; pIdx++) {
      for (const inning of inningRange) {
        for (let kIdx = 0; kIdx < usedPositions.length; kIdx++) {
          terms.push(`${qualityOf(pIdx, kIdx)} ${varName(pIdx, inning, kIdx)}`);
        }
      }
    }
    return terms.join(" + ");
  }

  const baseConstraints: string[] = [];

  // Each position filled by exactly one player every inning.
  for (let inning = 1; inning <= innings; inning++) {
    for (let kIdx = 0; kIdx < usedPositions.length; kIdx++) {
      const terms = players.map((_, pIdx) => `1 ${varName(pIdx, inning, kIdx)}`);
      baseConstraints.push(`pos_${inning}_${kIdx}: ${terms.join(" + ")} = 1`);
    }
  }

  // A player fields at most one position per inning (no assignment at all
  // that inning means they're on the bench).
  for (let pIdx = 0; pIdx < players.length; pIdx++) {
    for (let inning = 1; inning <= innings; inning++) {
      const terms = usedPositions.map((_, kIdx) => `1 ${varName(pIdx, inning, kIdx)}`);
      baseConstraints.push(`role_${pIdx}_${inning}: ${terms.join(" + ")} <= 1`);
    }
  }

  // Fairness: every player's total field-innings across the whole game
  // falls within the fairest possible split of the roster-wide total.
  const fairShare = (innings * fieldSize) / players.length;
  const fairFloor = Math.floor(fairShare);
  const fairCeil = Math.ceil(fairShare);
  for (let pIdx = 0; pIdx < players.length; pIdx++) {
    const terms: string[] = [];
    for (let inning = 1; inning <= innings; inning++) {
      for (let kIdx = 0; kIdx < usedPositions.length; kIdx++) {
        terms.push(`1 ${varName(pIdx, inning, kIdx)}`);
      }
    }
    baseConstraints.push(`fairlo_${pIdx}: ${terms.join(" + ")} >= ${fairFloor}`);
    baseConstraints.push(`fairhi_${pIdx}: ${terms.join(" + ")} <= ${fairCeil}`);
  }

  const genderConstraints: string[] = [];
  for (const gm of feasibleGenderMins) {
    for (let inning = 1; inning <= innings; inning++) {
      const terms: string[] = [];
      players.forEach((p, pIdx) => {
        if (p.gender !== gm.gender) return;
        for (let kIdx = 0; kIdx < usedPositions.length; kIdx++) {
          terms.push(`1 ${varName(pIdx, inning, kIdx)}`);
        }
      });
      genderConstraints.push(`gender_${inning}_${gm.gender}: ${terms.join(" + ")} >= ${gm.min}`);
    }
  }

  const highs = await getHighs();

  function solveIlp(
    direction: "Maximize" | "Minimize",
    objective: string,
    constraints: string[],
  ) {
    const lpText = [
      direction,
      ` obj: ${objective}`,
      "Subject To",
      ...constraints.map((c) => ` ${c}`),
      "Binary",
      ` ${allVariableNames.join(" ")}`,
      "End",
    ].join("\n");
    return highs.solve(lpText, { output_flag: false, log_to_console: false, random_seed: 0 });
  }

  async function attemptSolve(includeGenderConstraints: boolean) {
    const constraints = includeGenderConstraints
      ? [...baseConstraints, ...genderConstraints]
      : baseConstraints;

    if (innings >= 2) {
      const realInnings = rangeInclusive(1, innings - 1);
      const phase1Objective = objectiveTerms(realInnings);
      const phase1 = solveIlp("Maximize", phase1Objective, constraints);
      if (phase1.Status !== "Optimal") return phase1;

      const lockedValue = Math.round(phase1.ObjectiveValue);
      const lockConstraint = `phase1lock: ${phase1Objective} >= ${lockedValue}`;
      const phase2Objective = objectiveTerms([innings]);
      return solveIlp("Minimize", phase2Objective, [...constraints, lockConstraint]);
    }

    const objective = objectiveTerms(rangeInclusive(1, innings));
    return solveIlp("Maximize", objective, constraints);
  }

  let solution = await attemptSolve(true);
  if (solution.Status !== "Optimal" && genderConstraints.length > 0) {
    warnings.push(
      "Could not satisfy every constraint at once; gender minimums were relaxed for this lineup.",
    );
    solution = await attemptSolve(false);
  }

  if (solution.Status !== "Optimal") {
    warnings.push("No valid lineup could be found for this roster and inning count.");
    return { assignments, warnings };
  }

  for (let pIdx = 0; pIdx < players.length; pIdx++) {
    const player = players[pIdx];
    for (let inning = 1; inning <= innings; inning++) {
      let assignedPosition: string | null = null;
      for (let kIdx = 0; kIdx < usedPositions.length; kIdx++) {
        const column = solution.Columns[varName(pIdx, inning, kIdx)];
        if (column && Math.round(column.Primal) === 1) {
          assignedPosition = usedPositions[kIdx].name;
          break;
        }
      }
      assignments.push({ inning, playerId: player.id, position: assignedPosition ?? BENCH });
    }
  }

  return { assignments, warnings };
}
