import type { Gender } from "@/db/schema";
import { solveAssignment } from "./hungarian";

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
  /** Deterministic PRNG seed for bench rotation. Defaults to a hash of the sorted player ids. */
  seed?: number;
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
 * who's on the bench. Who fields is decided fresh each inning by a greedy
 * least-fielded-so-far rule, applied first within each gender (to satisfy
 * that gender's minimum) and then across whoever's left (to fill the
 * remaining "flex" spots) — this keeps field-innings as equal as possible
 * both within each gender and across the whole roster, without needing to
 * patch a gender-blind rotation after the fact. Which position each
 * fielder plays is a pure best-fit optimization — an importance-weighted
 * optimal assignment (Hungarian algorithm) over each player's rating
 * (1-10, default 5) at each position.
 */
export function solveFielding(input: FieldingSolverInput): FieldingSolverResult {
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

  // Tracks each player's field-innings so far, so each inning's selection
  // can greedily favor whoever's fielded the least (their "turn").
  const fieldInningsSoFar = new Map<string, number>();
  for (const p of players) fieldInningsSoFar.set(p.id, 0);

  // Stable seeded tiebreak for players otherwise tied on fieldInningsSoFar,
  // so selection stays deterministic for a given seed without always
  // favoring the same player when counts tie (e.g. every inning 1).
  const tiebreakIndex = new Map<string, number>();
  order.forEach((p, i) => tiebreakIndex.set(p.id, i));

  function leastFielded(candidates: FieldingSolverPlayer[], count: number): FieldingSolverPlayer[] {
    return [...candidates]
      .sort((a, b) => {
        const diff = fieldInningsSoFar.get(a.id)! - fieldInningsSoFar.get(b.id)!;
        if (diff !== 0) return diff;
        return tiebreakIndex.get(a.id)! - tiebreakIndex.get(b.id)!;
      })
      .slice(0, count);
  }

  for (let inning = 1; inning <= innings; inning++) {
    // Fill each gender's minimum first, from whoever of that gender has
    // fielded the fewest innings so far, then fill the remaining "flex"
    // spots (not tied to any gender minimum) from whoever's fielded the
    // fewest overall, gender-blind.
    const fieldedIds = new Set<string>();
    for (const gm of feasibleGenderMins) {
      const genderPlayers = players.filter((p) => p.gender === gm.gender);
      const take = Math.min(gm.min, genderPlayers.length, Math.max(fieldSize - fieldedIds.size, 0));
      for (const p of leastFielded(genderPlayers, take)) fieldedIds.add(p.id);
    }
    const remainingSlots = fieldSize - fieldedIds.size;
    if (remainingSlots > 0) {
      const remainingPlayers = players.filter((p) => !fieldedIds.has(p.id));
      for (const p of leastFielded(remainingPlayers, remainingSlots)) fieldedIds.add(p.id);
    }

    const fielders = players.filter((p) => fieldedIds.has(p.id));

    for (const p of fielders) {
      fieldInningsSoFar.set(p.id, fieldInningsSoFar.get(p.id)! + 1);
    }

    if (usedPositions.length > 0) {
      const costMatrix = fielders.map((player) =>
        usedPositions.map((position) => {
          const rating = ratingMap.get(`${player.id}::${position.name}`) ?? DEFAULT_RATING;
          return -(position.importance * rating);
        }),
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
