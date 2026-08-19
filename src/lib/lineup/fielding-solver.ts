import type { Gender } from "@/db/schema";
import { positionAptitude, type PlayerSkills, type PositionProfile } from "./position-aptitude";
import { solveAssignment } from "./hungarian";

export const BENCH = "BENCH";

export interface FieldingSolverPlayer extends PlayerSkills {
  id: string;
  gender: Gender;
}

export interface GenderMinimum {
  gender: Gender;
  min: number;
}

export interface FieldingSolverInput {
  players: FieldingSolverPlayer[];
  positions: PositionProfile[];
  innings: number;
  genderMinimums: GenderMinimum[];
  /** Deterministic PRNG seed for bench rotation. Defaults to a hash of the sorted player ids. */
  seed?: number;
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

function mulberry32(seed: number) {
  let a = seed;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (Math.imul(31, hash) + input.charCodeAt(i)) | 0;
  }
  return hash;
}

function shuffle<T>(items: T[], rng: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Generates a per-inning fielding rotation: who fields which position, and
 * who's on the bench. Who fields (bench rotation, gender-minimum repair)
 * aims for equal field-innings per player, as far as the roster allows.
 * Which position each fielder plays is a pure best-fit optimization —
 * an importance-weighted optimal assignment (Hungarian algorithm) over
 * each player's predicted aptitude at each position.
 */
export function solveFielding(input: FieldingSolverInput): FieldingSolverResult {
  const { players, positions, innings, genderMinimums } = input;
  const warnings: string[] = [];
  const assignments: FieldingAssignment[] = [];

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
  const benchSize = players.length - fieldSize;

  const seed =
    input.seed ??
    hashSeed(
      players
        .map((p) => p.id)
        .sort()
        .join(","),
    );
  const rng = mulberry32(seed);
  const order = shuffle(players, rng);

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

  for (let inning = 1; inning <= innings; inning++) {
    const benchSet = new Set<string>();
    if (benchSize > 0) {
      const start = ((inning - 1) * benchSize) % order.length;
      for (let k = 0; k < benchSize; k++) {
        benchSet.add(order[(start + k) % order.length].id);
      }
    }

    let fielders = players.filter((p) => !benchSet.has(p.id));

    for (const gm of feasibleGenderMins) {
      let countInField = fielders.filter((p) => p.gender === gm.gender).length;
      while (countInField < gm.min) {
        const benchCandidate = players.find(
          (p) => benchSet.has(p.id) && p.gender === gm.gender,
        );
        if (!benchCandidate) break;

        const swapOut = fielders.find((p) => {
          if (p.gender === gm.gender) return false;
          const otherGm = feasibleGenderMins.find((g) => g.gender === p.gender);
          if (!otherGm) return true;
          const currentCount = fielders.filter((f) => f.gender === p.gender).length;
          return currentCount - 1 >= otherGm.min;
        });
        if (!swapOut) break;

        benchSet.delete(benchCandidate.id);
        benchSet.add(swapOut.id);
        fielders = players.filter((p) => !benchSet.has(p.id));
        countInField = fielders.filter((p) => p.gender === gm.gender).length;
      }
    }

    if (usedPositions.length > 0) {
      const costMatrix = fielders.map((player) =>
        usedPositions.map(
          (position) => -(position.importance * positionAptitude(player, position)),
        ),
      );
      const assignment = solveAssignment(costMatrix);
      assignment.forEach((positionIndex, fielderIndex) => {
        assignments.push({
          inning,
          playerId: fielders[fielderIndex].id,
          position: usedPositions[positionIndex].name,
        });
      });
    }

    const assignedThisInning = new Set(fielders.map((p) => p.id));
    for (const p of players) {
      if (!assignedThisInning.has(p.id)) {
        assignments.push({ inning, playerId: p.id, position: BENCH });
      }
    }
  }

  return { assignments, warnings };
}
