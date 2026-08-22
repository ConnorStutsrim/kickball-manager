import type { Gender } from "@/db/schema";
import { solveAssignment } from "./hungarian";

export const BENCH = "BENCH";

// Rating a player gets at a position they have no explicit rating for.
const DEFAULT_RATING = 5;

// How far the top two rated players at a position must clear the third
// before they're treated as a "specialist" pair worth keeping apart in
// the bench-priority order (see separateSpecialistConflicts below).
const SPECIALIST_MARGIN = 2;

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
 * patch a gender-blind rotation after the fact. Whenever that rule leaves
 * a genuine choice (multiple same-gender players tied on field-innings-
 * so-far), a bounded local search swaps among the fairness-tied
 * candidates to maximize that inning's achievable fielding quality — so a
 * team's best players at a position don't end up benched together purely
 * by chance when an equally fair alternative existed. For the last inning
 * of a multi-inning game — the team's extra/tie-breaker slot, which might
 * not even get played — that same search instead prefers the *weaker*
 * fairness-tied alternative: fairness (who's fielded the most/benched the
 * least in the real innings so far) still decides who sits out, exactly as
 * every other inning; "weaker lineup" only breaks ties within whatever
 * freedom that leaves, never at fairness's expense. Which position each
 * fielder plays is a pure best-fit optimization — an importance-weighted
 * optimal assignment (Hungarian algorithm) over each player's rating
 * (1-10, default 5) at each position. When two players are both clearly
 * the best at the same position (a "specialist" pair) and a fair
 * alternative exists, the same inning is never allowed to bench both of
 * them at once — the quality-maximizing search above is what tends to
 * keep specialists fielding together in the first place (since that's
 * good for quality), which otherwise sets up exactly the collision this
 * guards against once fairness eventually forces one of them to rest.
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

  // Positions where the top two rated players both clear the third by
  // SPECIALIST_MARGIN — pairs whose simultaneous absence is a real
  // drop-off, not an incremental one. Deduped, since the same pair can be
  // 1st/2nd at more than one position.
  function findSpecialistConflictPairs(): [string, string][] {
    const pairs: [string, string][] = [];
    const seen = new Set<string>();
    for (const position of usedPositions) {
      const ranked = players
        .map((p) => ({
          id: p.id,
          rating: ratingMap.get(`${p.id}::${position.name}`) ?? DEFAULT_RATING,
        }))
        .sort((a, b) => b.rating - a.rating);
      if (ranked.length < 3) continue;

      const [first, second, third] = ranked;
      if (Math.min(first.rating, second.rating) - third.rating < SPECIALIST_MARGIN) continue;

      const key = [first.id, second.id].sort().join("::");
      if (seen.has(key)) continue;
      seen.add(key);
      pairs.push([first.id, second.id]);
    }
    return pairs;
  }

  const specialistConflictPairs = findSpecialistConflictPairs();

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

  // Solves the best-fit position assignment for a fixed set of fielders,
  // returning both its total quality (for comparing candidate fielder
  // sets) and the actual (player, position) pairs (for pushing into the
  // final assignments list).
  function solveInningAssignment(fielderList: FieldingSolverPlayer[]) {
    const costMatrix = fielderList.map((player) =>
      usedPositions.map((position) => {
        const rating = ratingMap.get(`${player.id}::${position.name}`) ?? DEFAULT_RATING;
        return -(position.importance * rating);
      }),
    );
    const assignment = solveAssignment(costMatrix);
    let quality = 0;
    const pairs = assignment.map((positionIndex, fielderIndex) => {
      const player = fielderList[fielderIndex];
      const position = usedPositions[positionIndex];
      const rating = ratingMap.get(`${player.id}::${position.name}`) ?? DEFAULT_RATING;
      quality += position.importance * rating;
      return { player, position };
    });
    return { quality, pairs };
  }

  // Among players tied on field-innings-so-far (so swapping them never
  // changes anyone's fairness standing), greedily swap in whoever
  // maximizes (or, when preferWeaker, minimizes) this inning's achievable
  // fielding quality. Restricted to same-gender swaps so every gender
  // minimum stays trivially satisfied — no extra checking needed, since a
  // same-gender swap can't change either gender's fielded count.
  function improveFairnessTiedFielders(
    fieldedIds: Set<string>,
    preferWeaker: boolean,
  ): Set<string> {
    if (usedPositions.length === 0) return fieldedIds;

    const isBetter = (candidate: number, best: number) =>
      preferWeaker ? candidate < best : candidate > best;

    let current = fieldedIds;
    let currentQuality = solveInningAssignment(players.filter((p) => current.has(p.id))).quality;

    for (let iter = 0; iter < players.length; iter++) {
      const inPlayers = players.filter((p) => current.has(p.id));
      const outPlayers = players.filter((p) => !current.has(p.id));

      let bestNext: Set<string> | null = null;
      let bestQuality = currentQuality;

      for (const inP of inPlayers) {
        for (const outP of outPlayers) {
          if (inP.gender !== outP.gender) continue;
          if (fieldInningsSoFar.get(inP.id) !== fieldInningsSoFar.get(outP.id)) continue;

          const trial = new Set(current);
          trial.delete(inP.id);
          trial.add(outP.id);
          const quality = solveInningAssignment(players.filter((p) => trial.has(p.id))).quality;
          if (isBetter(quality, bestQuality)) {
            bestQuality = quality;
            bestNext = trial;
          }
        }
      }

      if (!bestNext) break;
      current = bestNext;
      currentQuality = bestQuality;
    }

    return current;
  }

  // The best fairness-tied swap (same gender, same fieldInningsSoFar) that
  // flips `subjectId`'s fielding/bench status — used to pull a specialist
  // back in, or to rest one proactively, without touching anyone's
  // fairness standing. Null if no such swap exists.
  function bestFairnessTiedSwap(
    current: Set<string>,
    subjectId: string,
  ): { quality: number; set: Set<string> } | null {
    const subject = players.find((p) => p.id === subjectId)!;
    const subjectIn = current.has(subjectId);

    let best: { quality: number; set: Set<string> } | null = null;
    for (const other of players) {
      if (other.id === subjectId) continue;
      if (current.has(other.id) === subjectIn) continue;
      if (other.gender !== subject.gender) continue;
      if (fieldInningsSoFar.get(other.id) !== fieldInningsSoFar.get(subjectId)) continue;

      const trial = new Set(current);
      if (subjectIn) {
        trial.delete(subjectId);
        trial.add(other.id);
      } else {
        trial.add(subjectId);
        trial.delete(other.id);
      }
      const { quality } = solveInningAssignment(players.filter((p) => trial.has(p.id)));
      if (!best || quality > best.quality) best = { quality, set: trial };
    }
    return best;
  }

  // Ensures a specialist-conflict pair is never both fielding or both
  // benched at once while they're fairness-tied with each other (equal
  // fieldInningsSoFar): if both are fielding, proactively rests one of
  // them now — before fairness eventually forces the issue and leaves no
  // fairness-tied alternative left, which is what let them collide in the
  // first place; if both are benched, brings one back in. Run *after* the
  // quality-maximizing search above, since that search would otherwise
  // just undo a proactive rest (bringing a high-rated specialist back in
  // is exactly what it optimizes for). Left as-is when no fairness-tied
  // swap exists either way.
  function separateSpecialistPairs(fieldedIds: Set<string>): Set<string> {
    let current = fieldedIds;
    for (const [aId, bId] of specialistConflictPairs) {
      const aIn = current.has(aId);
      const bIn = current.has(bId);
      if (aIn !== bIn) continue;
      if (fieldInningsSoFar.get(aId) !== fieldInningsSoFar.get(bId)) continue;

      const swapA = bestFairnessTiedSwap(current, aId);
      const swapB = bestFairnessTiedSwap(current, bId);
      const chosen =
        swapA && swapB ? (swapA.quality >= swapB.quality ? swapA : swapB) : (swapA ?? swapB);
      if (chosen) current = chosen.set;
    }
    return current;
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

    // The last inning of a multi-inning game is the extra/tie-breaker
    // slot — fairness (computed above) still decides who sits out, but
    // among fairness-tied alternatives, prefer the weaker lineup there
    // instead of the stronger one every other inning prefers.
    const preferWeaker = inning === innings && innings >= 2;
    const qualityFieldedIds = improveFairnessTiedFielders(fieldedIds, preferWeaker);
    const finalFieldedIds = preferWeaker
      ? qualityFieldedIds
      : separateSpecialistPairs(qualityFieldedIds);
    const fielders = players.filter((p) => finalFieldedIds.has(p.id));

    for (const p of fielders) {
      fieldInningsSoFar.set(p.id, fieldInningsSoFar.get(p.id)! + 1);
    }

    if (usedPositions.length > 0) {
      const { pairs } = solveInningAssignment(fielders);
      for (const { player, position } of pairs) {
        assignments.push({ inning, playerId: player.id, position: position.name });
      }
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
