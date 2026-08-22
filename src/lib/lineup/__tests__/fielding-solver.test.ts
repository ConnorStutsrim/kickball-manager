import { describe, expect, it } from "vitest";
import {
  BENCH,
  solveFielding,
  type FieldingSolverPlayer,
  type GenderMinimum,
  type PositionProfile,
} from "../fielding-solver";

function makePosition(name: string, overrides: Partial<Omit<PositionProfile, "name">> = {}): PositionProfile {
  return {
    name,
    importance: 3,
    ...overrides,
  };
}

const POSITIONS: PositionProfile[] = [
  makePosition("P"),
  makePosition("C"),
  makePosition("1B"),
  makePosition("2B"),
  makePosition("3B"),
  makePosition("SS"),
  makePosition("Monster"),
  makePosition("LF"),
  makePosition("CLF"),
  makePosition("CRF"),
  makePosition("RF"),
];

const STANDARD_MINIMUMS: GenderMinimum[] = [
  { gender: "M", min: 4 },
  { gender: "F", min: 4 },
];

function makeRoster(mCount: number, fCount: number): FieldingSolverPlayer[] {
  const players: FieldingSolverPlayer[] = [];
  for (let i = 0; i < mCount; i++) players.push({ id: `m${i}`, gender: "M" });
  for (let i = 0; i < fCount; i++) players.push({ id: `f${i}`, gender: "F" });
  return players;
}

describe("solveFielding", () => {
  it("spreads bench innings within 1 of each other across the game", () => {
    const players = makeRoster(6, 7); // 13 players, 11 positions -> bench of 2
    const { assignments } = solveFielding({
      players,
      positions: POSITIONS,
      innings: 7,
      genderMinimums: STANDARD_MINIMUMS,
      seed: 42,
    });

    const benchCounts = new Map<string, number>();
    for (const p of players) benchCounts.set(p.id, 0);
    for (const a of assignments) {
      if (a.position === BENCH) {
        benchCounts.set(a.playerId, (benchCounts.get(a.playerId) ?? 0) + 1);
      }
    }

    const counts = [...benchCounts.values()];
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
  });

  it("meets configured gender minimums every inning when the roster allows it", () => {
    const players = makeRoster(5, 9); // 14 players, bench of 3 -> exercises repair
    const { assignments } = solveFielding({
      players,
      positions: POSITIONS,
      innings: 7,
      genderMinimums: STANDARD_MINIMUMS,
      seed: 7,
    });

    const byInning = new Map<number, typeof assignments>();
    for (const a of assignments) {
      if (!byInning.has(a.inning)) byInning.set(a.inning, []);
      byInning.get(a.inning)!.push(a);
    }

    for (const [, inningAssignments] of byInning) {
      const fielders = inningAssignments.filter((a) => a.position !== BENCH);
      const mCount = fielders.filter((a) => a.playerId.startsWith("m")).length;
      const fCount = fielders.filter((a) => a.playerId.startsWith("f")).length;
      expect(mCount).toBeGreaterThanOrEqual(4);
      expect(fCount).toBeGreaterThanOrEqual(4);
    }
  });

  it("keeps bench innings within 1 of each other *within each gender* even when repair kicks in often", () => {
    // Only 5 men against a minimum of 4 in the field every inning means the
    // base rotation frequently benches too many men, forcing repair swaps
    // most innings. Repair should favor whoever's fielded the least/most so
    // far within the affected gender, not the same first-match player every
    // time. (Bench time can't be equal *across* genders here — 5 men who
    // must almost always field vs. 9 women who have more slack is an
    // inherent asymmetry from the gender minimum itself, not something the
    // repair step controls — so fairness is checked within each gender.)
    const players = makeRoster(5, 9); // 14 players, bench of 3
    const { assignments } = solveFielding({
      players,
      positions: POSITIONS,
      innings: 7,
      genderMinimums: STANDARD_MINIMUMS,
      seed: 7,
    });

    const benchCounts = new Map<string, number>();
    for (const p of players) benchCounts.set(p.id, 0);
    for (const a of assignments) {
      if (a.position === BENCH) {
        benchCounts.set(a.playerId, (benchCounts.get(a.playerId) ?? 0) + 1);
      }
    }

    const menCounts = players.filter((p) => p.gender === "M").map((p) => benchCounts.get(p.id)!);
    const womenCounts = players.filter((p) => p.gender === "F").map((p) => benchCounts.get(p.id)!);
    expect(Math.max(...menCounts) - Math.min(...menCounts)).toBeLessThanOrEqual(1);
    expect(Math.max(...womenCounts) - Math.min(...womenCounts)).toBeLessThanOrEqual(1);
  });

  it("assigns every position exactly once per inning with no duplicates", () => {
    const players = makeRoster(6, 5); // exactly 11 players, no bench
    const { assignments } = solveFielding({
      players,
      positions: POSITIONS,
      innings: 3,
      genderMinimums: STANDARD_MINIMUMS,
      seed: 1,
    });

    const byInning = new Map<number, typeof assignments>();
    for (const a of assignments) {
      if (!byInning.has(a.inning)) byInning.set(a.inning, []);
      byInning.get(a.inning)!.push(a);
    }

    for (const [, inningAssignments] of byInning) {
      expect(inningAssignments.every((a) => a.position !== BENCH)).toBe(true);
      const positionNames = inningAssignments.map((a) => a.position);
      expect(new Set(positionNames).size).toBe(POSITIONS.length);
      expect(positionNames.sort()).toEqual(POSITIONS.map((p) => p.name).sort());
    }
  });

  it("handles a roster smaller than the position count without throwing", () => {
    const players = makeRoster(4, 4); // 8 players < 11 positions
    const { assignments, warnings } = solveFielding({
      players,
      positions: POSITIONS,
      innings: 2,
      genderMinimums: STANDARD_MINIMUMS,
      seed: 3,
    });

    expect(warnings.length).toBeGreaterThan(0);
    const inning1 = assignments.filter((a) => a.inning === 1);
    expect(inning1.length).toBe(players.length);
    expect(inning1.every((a) => a.position !== BENCH)).toBe(true);
  });

  it("warns instead of throwing when a gender's total is below the minimum", () => {
    const players = makeRoster(2, 9); // only 2 men, minimum requires 4
    const { warnings } = solveFielding({
      players,
      positions: POSITIONS,
      innings: 2,
      genderMinimums: STANDARD_MINIMUMS,
      seed: 5,
    });

    expect(warnings.some((w) => w.includes("gender M"))).toBe(true);
  });

  it("is deterministic for a given seed", () => {
    const players = makeRoster(6, 7);
    const input = {
      players,
      positions: POSITIONS,
      innings: 7,
      genderMinimums: STANDARD_MINIMUMS,
      seed: 99,
    };

    const first = solveFielding(input);
    const second = solveFielding(input);
    expect(second).toEqual(first);
  });

  it("assigns players according to their position ratings", () => {
    const positions: PositionProfile[] = [makePosition("P"), makePosition("C")];
    const ace: FieldingSolverPlayer = { id: "ace", gender: "M" };
    const rookie: FieldingSolverPlayer = { id: "rookie", gender: "F" };

    const { assignments } = solveFielding({
      players: [ace, rookie],
      positions,
      innings: 3,
      genderMinimums: [],
      seed: 1,
      ratings: [
        { playerId: "ace", positionName: "C", rating: 10 },
        { playerId: "ace", positionName: "P", rating: 1 },
        { playerId: "rookie", positionName: "P", rating: 10 },
        { playerId: "rookie", positionName: "C", rating: 1 },
      ],
    });

    for (const a of assignments) {
      if (a.playerId === "ace") expect(a.position).toBe("C");
      if (a.playerId === "rookie") expect(a.position).toBe("P");
    }
  });

  it("defaults to average (5) for a position with no explicit rating", () => {
    const positions: PositionProfile[] = [makePosition("P"), makePosition("C")];
    const ace: FieldingSolverPlayer = { id: "ace", gender: "M" };
    const rookie: FieldingSolverPlayer = { id: "rookie", gender: "F" };

    const { assignments } = solveFielding({
      players: [ace, rookie],
      positions,
      innings: 3,
      genderMinimums: [],
      seed: 1,
      // ace is explicitly bad at P (1); C is left unrated, defaulting to
      // average (5) — still better than P for ace, so ace should get C.
      ratings: [{ playerId: "ace", positionName: "P", rating: 1 }],
    });

    for (const a of assignments) {
      if (a.playerId === "ace") expect(a.position).toBe("C");
      if (a.playerId === "rookie") expect(a.position).toBe("P");
    }
  });

  it("ignores a rating for a player/position pair that isn't in play", () => {
    const positions: PositionProfile[] = [makePosition("P"), makePosition("C")];
    const ace: FieldingSolverPlayer = { id: "ace", gender: "M" };
    const rookie: FieldingSolverPlayer = { id: "rookie", gender: "F" };

    const { assignments } = solveFielding({
      players: [ace, rookie],
      positions,
      innings: 3,
      genderMinimums: [],
      seed: 1,
      ratings: [{ playerId: "someone-else", positionName: "P", rating: 10 }],
    });

    // No usable rating for either player -> both default to average (5)
    // everywhere, so the outcome isn't determined by rating — just confirm
    // every inning is still a valid, complete assignment.
    for (let inning = 1; inning <= 3; inning++) {
      const inningPositions = assignments
        .filter((a) => a.inning === inning)
        .map((a) => a.position)
        .sort();
      expect(inningPositions).toEqual(["C", "P"]);
    }
  });
});
