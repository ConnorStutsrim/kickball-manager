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

// When a gender's present total falls below its configured minimum, these
// positions go unfielded — in this order, one per shortfall of 1, capped at
// both entries. Fixed seeded position names in this league's real data, not
// user-renameable via /settings/positions, consistent with the other
// hardcoded constants in this file.
const DEGRADED_POSITION_ORDER = ["Float", "Outfield 4"];

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

export interface GenderShortfall {
  gender: Gender;
  total: number;
  min: number;
  /** How many below the configured minimum this gender's present total is, 0 if not short. */
  shortfall: number;
}

/** How far each configured gender minimum is from being met by who's present. */
export function computeGenderShortfalls(
  players: FieldingSolverPlayer[],
  genderMinimums: GenderMinimum[],
): GenderShortfall[] {
  const totalsByGender = new Map<Gender, number>();
  for (const p of players) {
    totalsByGender.set(p.gender, (totalsByGender.get(p.gender) ?? 0) + 1);
  }
  return genderMinimums.map((gm) => {
    const total = totalsByGender.get(gm.gender) ?? 0;
    return { gender: gm.gender, total, min: gm.min, shortfall: Math.max(0, gm.min - total) };
  });
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

/**
 * Generates a per-inning fielding rotation — who fields which position,
 * and who's on the bench — by solving the whole game at once as a single
 * integer linear program (via HiGHS), rather than deciding each inning
 * greedily. Decision variable x[player][inning][position] = 1 means that
 * player fields that position that inning; a player with no position set
 * to 1 for a given inning is on the bench. Constraints: every position is
 * filled by exactly one player each inning; a player fields at most one
 * position per inning; each player's total field-innings across the whole
 * game falls within the fairest possible split (floor/ceil of
 * innings*fieldSize/players.length — the same bound applies to every
 * player regardless of gender, which is enough on its own to also keep
 * each gender's bench counts within 1 of each other); each inning meets
 * the league's per-gender minimums. A gender short of its configured
 * minimum plays without Float (1 short) and also without Outfield 4 (2+
 * short) — its effective minimum becomes simply "everyone present," who
 * then field every inning with no bench turns, and fairness for
 * everyone else is recomputed over just the remaining slots and players.
 * The objective maximizes total quality (position importance × rating) — this is a
 * genuine global optimum, not a per-inning approximation, verified
 * against brute-force search in the test suite. Every inning, including
 * the last one, gets the same treatment — there's no special-casing for
 * a "tie-breaker" inning.
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

  // A gender short of its configured minimum plays without Float (1 short)
  // and also without Outfield 4 (2+ short) — the league's real shorthanded
  // rule, relative to whatever minimum is configured, not hardcoded to 4.
  const shortfalls = computeGenderShortfalls(players, genderMinimums);
  const maxShortfall = Math.max(0, ...shortfalls.map((s) => s.shortfall));
  const droppedPositionNames = DEGRADED_POSITION_ORDER.slice(
    0,
    Math.min(maxShortfall, DEGRADED_POSITION_ORDER.length),
  );
  if (droppedPositionNames.length > 0) {
    const shortDescriptions = shortfalls
      .filter((s) => s.shortfall > 0)
      .map((s) => `${s.total} of ${s.min} required ${s.gender === "M" ? "men" : "women"}`);
    warnings.push(
      `Playing shorthanded (${shortDescriptions.join(", ")}): ${droppedPositionNames.join(" and ")} will go unfielded, and everyone of that gender will field every inning.`,
    );
  }
  const positionsAfterGenderDrop = positions.filter(
    (p) => !droppedPositionNames.includes(p.name),
  );

  const fieldSize = Math.min(positionsAfterGenderDrop.length, players.length);
  if (fieldSize < positionsAfterGenderDrop.length) {
    warnings.push(
      `Only ${players.length} players present for ${positionsAfterGenderDrop.length} positions; ${
        positionsAfterGenderDrop.length - fieldSize
      } position(s) will go unfilled each inning.`,
    );
  }
  const usedPositions = positionsAfterGenderDrop.slice(0, fieldSize);

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

  function objectiveTerms(): string {
    const terms: string[] = [];
    for (let pIdx = 0; pIdx < players.length; pIdx++) {
      for (let inning = 1; inning <= innings; inning++) {
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
  // falls within the fairest possible split — normally of the roster-wide
  // total, but a gender short of its minimum plays every inning with zero
  // bench turns (there's no slack to rotate when you're already short), so
  // those players get a fixed floor=ceil=innings instead, and fairness for
  // everyone else is recomputed over just the remaining field slots and
  // remaining players. When no gender is short this reduces to exactly the
  // single roster-wide share it replaces.
  const alwaysPlayIds = new Set(
    players.filter((p) => shortfalls.some((s) => s.gender === p.gender && s.shortfall > 0)).map((p) => p.id),
  );
  const remainingPlayers = players.filter((p) => !alwaysPlayIds.has(p.id));
  const remainingFieldSize = Math.max(0, fieldSize - alwaysPlayIds.size);
  const remainingFairShare =
    remainingPlayers.length > 0 ? (innings * remainingFieldSize) / remainingPlayers.length : 0;
  const remainingFairFloor = Math.floor(remainingFairShare);
  const remainingFairCeil = Math.ceil(remainingFairShare);
  for (let pIdx = 0; pIdx < players.length; pIdx++) {
    const player = players[pIdx];
    const terms: string[] = [];
    for (let inning = 1; inning <= innings; inning++) {
      for (let kIdx = 0; kIdx < usedPositions.length; kIdx++) {
        terms.push(`1 ${varName(pIdx, inning, kIdx)}`);
      }
    }
    const [lo, hi] = alwaysPlayIds.has(player.id)
      ? [innings, innings]
      : [remainingFairFloor, remainingFairCeil];
    baseConstraints.push(`fairlo_${pIdx}: ${terms.join(" + ")} >= ${lo}`);
    baseConstraints.push(`fairhi_${pIdx}: ${terms.join(" + ")} <= ${hi}`);
  }

  // Every configured gender minimum is always achievable now: a short
  // gender's effective requirement is simply "all of them" rather than
  // being dropped and left unconstrained.
  const genderConstraints: string[] = [];
  for (const s of shortfalls) {
    const effectiveMin = Math.min(s.min, s.total);
    if (effectiveMin <= 0) continue;
    for (let inning = 1; inning <= innings; inning++) {
      const terms: string[] = [];
      players.forEach((p, pIdx) => {
        if (p.gender !== s.gender) return;
        for (let kIdx = 0; kIdx < usedPositions.length; kIdx++) {
          terms.push(`1 ${varName(pIdx, inning, kIdx)}`);
        }
      });
      genderConstraints.push(`gender_${inning}_${s.gender}: ${terms.join(" + ")} >= ${effectiveMin}`);
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

  function attemptSolve(includeGenderConstraints: boolean) {
    const constraints = includeGenderConstraints
      ? [...baseConstraints, ...genderConstraints]
      : baseConstraints;
    const objective = objectiveTerms();
    return solveIlp("Maximize", objective, constraints);
  }

  let solution = attemptSolve(true);
  if (solution.Status !== "Optimal" && genderConstraints.length > 0) {
    warnings.push(
      "Could not satisfy every constraint at once; gender minimums were relaxed for this lineup.",
    );
    solution = attemptSolve(false);
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
