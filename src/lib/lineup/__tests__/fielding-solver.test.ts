import { describe, expect, it } from "vitest";
import {
  BENCH,
  solveFielding,
  type FieldingSolverPlayer,
  type GenderMinimum,
} from "../fielding-solver";
import type { PositionProfile } from "../position-aptitude";

function makePosition(
  name: string,
  overrides: Partial<Omit<PositionProfile, "name">> = {},
): PositionProfile {
  return {
    name,
    importance: 3,
    weightSpeed: 1,
    weightCatching: 1,
    weightThrowing: 1,
    weightGameSense: 1,
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
  const base = { speed: null, catching: null, throwing: null, gameSense: null };
  for (let i = 0; i < mCount; i++) players.push({ id: `m${i}`, gender: "M", ...base });
  for (let i = 0; i < fCount; i++) players.push({ id: `f${i}`, gender: "F", ...base });
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

  it("puts the clearly-best-fit player at a position over a clearly weaker one", () => {
    // Two-position, two-player game: ace is a great catcher and a poor
    // pitcher, rookie is the reverse. The optimal assignment should not
    // just alternate/rotate — it should exploit the clear fit.
    const positions: PositionProfile[] = [
      makePosition("P", { weightThrowing: 1, weightSpeed: 0, weightCatching: 0, weightGameSense: 0 }),
      makePosition("C", { weightCatching: 1, weightSpeed: 0, weightThrowing: 0, weightGameSense: 0 }),
    ];
    const ace: FieldingSolverPlayer = {
      id: "ace",
      gender: "M",
      speed: null,
      catching: 5,
      throwing: 1,
      gameSense: null,
    };
    const rookie: FieldingSolverPlayer = {
      id: "rookie",
      gender: "F",
      speed: null,
      catching: 1,
      throwing: 5,
      gameSense: null,
    };

    const { assignments } = solveFielding({
      players: [ace, rookie],
      positions,
      innings: 3,
      genderMinimums: [],
      seed: 1,
    });

    for (const a of assignments) {
      if (a.playerId === "ace") expect(a.position).toBe("C");
      if (a.playerId === "rookie") expect(a.position).toBe("P");
    }
  });

  it("honors a position override over computed aptitude", () => {
    // Both players and both positions are fully symmetric on paper (same
    // ratings, same weights) — without an override, nothing distinguishes
    // who plays where. An override on one (player, position) pair should
    // still deterministically flip the optimal assignment to honor it, and
    // the other player falls back to computed aptitude for their slot.
    const positions: PositionProfile[] = [
      makePosition("P", { weightThrowing: 1, weightSpeed: 0, weightCatching: 0, weightGameSense: 0 }),
      makePosition("C", { weightCatching: 1, weightSpeed: 0, weightThrowing: 0, weightGameSense: 0 }),
    ];
    const ace: FieldingSolverPlayer = {
      id: "ace",
      gender: "M",
      speed: null,
      catching: 3,
      throwing: 3,
      gameSense: null,
    };
    const rookie: FieldingSolverPlayer = {
      id: "rookie",
      gender: "F",
      speed: null,
      catching: 3,
      throwing: 3,
      gameSense: null,
    };

    const { assignments } = solveFielding({
      players: [ace, rookie],
      positions,
      innings: 3,
      genderMinimums: [],
      seed: 1,
      overrides: [{ playerId: "ace", positionName: "P", rating: 5 }],
    });

    for (const a of assignments) {
      if (a.playerId === "ace") expect(a.position).toBe("P");
      if (a.playerId === "rookie") expect(a.position).toBe("C");
    }
  });

  it("ignores an override for a player/position pair that isn't in play", () => {
    const positions: PositionProfile[] = [
      makePosition("P", { weightThrowing: 1, weightSpeed: 0, weightCatching: 0, weightGameSense: 0 }),
      makePosition("C", { weightCatching: 1, weightSpeed: 0, weightThrowing: 0, weightGameSense: 0 }),
    ];
    const ace: FieldingSolverPlayer = {
      id: "ace",
      gender: "M",
      speed: null,
      catching: 5,
      throwing: 1,
      gameSense: null,
    };
    const rookie: FieldingSolverPlayer = {
      id: "rookie",
      gender: "F",
      speed: null,
      catching: 1,
      throwing: 5,
      gameSense: null,
    };

    const { assignments } = solveFielding({
      players: [ace, rookie],
      positions,
      innings: 3,
      genderMinimums: [],
      seed: 1,
      overrides: [{ playerId: "someone-else", positionName: "P", rating: 5 }],
    });

    // Same outcome as the no-override "clearly-best-fit" test above.
    for (const a of assignments) {
      if (a.playerId === "ace") expect(a.position).toBe("C");
      if (a.playerId === "rookie") expect(a.position).toBe("P");
    }
  });
});
