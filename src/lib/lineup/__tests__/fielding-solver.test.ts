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
  it("spreads bench innings within 1 of each other across the game", async () => {
    const players = makeRoster(6, 7); // 13 players, 11 positions -> bench of 2
    const { assignments } = await solveFielding({
      players,
      positions: POSITIONS,
      innings: 7,
      genderMinimums: STANDARD_MINIMUMS,
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

  it("meets configured gender minimums every inning when the roster allows it", async () => {
    const players = makeRoster(5, 9); // 14 players, bench of 3
    const { assignments } = await solveFielding({
      players,
      positions: POSITIONS,
      innings: 7,
      genderMinimums: STANDARD_MINIMUMS,
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

  it("keeps bench innings within 1 of each other *within each gender*", async () => {
    // Only 5 men against a minimum of 4 in the field every inning means
    // men structurally have far less bench slack than the 9 women — but a
    // single roster-wide fairness bound (floor/ceil of one shared share)
    // still forces every player, of either gender, into one of just two
    // possible bench-count values, so within-gender spread of at most 1
    // is a guaranteed consequence, not something that needs separate
    // per-gender enforcement.
    const players = makeRoster(5, 9); // 14 players, bench of 3
    const { assignments } = await solveFielding({
      players,
      positions: POSITIONS,
      innings: 7,
      genderMinimums: STANDARD_MINIMUMS,
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

  it("assigns every position exactly once per inning with no duplicates", async () => {
    const players = makeRoster(6, 5); // exactly 11 players, no bench
    const { assignments } = await solveFielding({
      players,
      positions: POSITIONS,
      innings: 3,
      genderMinimums: STANDARD_MINIMUMS,
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

  it("handles a roster smaller than the position count without throwing", async () => {
    const players = makeRoster(4, 4); // 8 players < 11 positions
    const { assignments, warnings } = await solveFielding({
      players,
      positions: POSITIONS,
      innings: 2,
      genderMinimums: STANDARD_MINIMUMS,
    });

    expect(warnings.length).toBeGreaterThan(0);
    const inning1 = assignments.filter((a) => a.inning === 1);
    expect(inning1.length).toBe(players.length);
    expect(inning1.every((a) => a.position !== BENCH)).toBe(true);
  });

  it("warns instead of throwing when a gender's total is below the minimum", async () => {
    const players = makeRoster(2, 9); // only 2 men, minimum requires 4
    const { warnings } = await solveFielding({
      players,
      positions: POSITIONS,
      innings: 2,
      genderMinimums: STANDARD_MINIMUMS,
    });

    expect(warnings.some((w) => w.includes("gender M"))).toBe(true);
  });

  it("is deterministic", async () => {
    const players = makeRoster(6, 7);
    const input = {
      players,
      positions: POSITIONS,
      innings: 7,
      genderMinimums: STANDARD_MINIMUMS,
    };

    const first = await solveFielding(input);
    const second = await solveFielding(input);
    expect(second).toEqual(first);
  });

  it("assigns players according to their position ratings", async () => {
    const positions: PositionProfile[] = [makePosition("P"), makePosition("C")];
    const ace: FieldingSolverPlayer = { id: "ace", gender: "M" };
    const rookie: FieldingSolverPlayer = { id: "rookie", gender: "F" };

    const { assignments } = await solveFielding({
      players: [ace, rookie],
      positions,
      innings: 3,
      genderMinimums: [],
      ratings: [
        { playerId: "ace", positionName: "C", rating: 10 },
        { playerId: "ace", positionName: "P", rating: 1 },
        { playerId: "rookie", positionName: "P", rating: 10 },
        { playerId: "rookie", positionName: "C", rating: 1 },
      ],
    });

    // Only checked for the 2 real innings: with nobody ever benched here
    // (2 players, 2 positions), inning 3 is the extra inning and the only
    // lever left to make it deliberately weaker is position choice itself
    // — so the solver correctly flips ace/rookie there instead, covered
    // by the dedicated "prefers a weaker lineup in the extra inning" test.
    for (const a of assignments.filter((a) => a.inning < 3)) {
      if (a.playerId === "ace") expect(a.position).toBe("C");
      if (a.playerId === "rookie") expect(a.position).toBe("P");
    }
  });

  it("defaults to average (5) for a position with no explicit rating", async () => {
    const positions: PositionProfile[] = [makePosition("P"), makePosition("C")];
    const ace: FieldingSolverPlayer = { id: "ace", gender: "M" };
    const rookie: FieldingSolverPlayer = { id: "rookie", gender: "F" };

    const { assignments } = await solveFielding({
      players: [ace, rookie],
      positions,
      innings: 3,
      genderMinimums: [],
      // ace is explicitly bad at P (1); C is left unrated, defaulting to
      // average (5) — still better than P for ace, so ace should get C.
      ratings: [{ playerId: "ace", positionName: "P", rating: 1 }],
    });

    // See the note in the previous test — inning 3 is the extra inning
    // here and is deliberately weakened, so only the 2 real innings are
    // checked against the rating-driven expectation.
    for (const a of assignments.filter((a) => a.inning < 3)) {
      if (a.playerId === "ace") expect(a.position).toBe("C");
      if (a.playerId === "rookie") expect(a.position).toBe("P");
    }
  });

  it("ignores a rating for a player/position pair that isn't in play", async () => {
    const positions: PositionProfile[] = [makePosition("P"), makePosition("C")];
    const ace: FieldingSolverPlayer = { id: "ace", gender: "M" };
    const rookie: FieldingSolverPlayer = { id: "rookie", gender: "F" };

    const { assignments } = await solveFielding({
      players: [ace, rookie],
      positions,
      innings: 3,
      genderMinimums: [],
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

  it("finds the true optimum, not just a locally good one, at a single inning", async () => {
    // 4 same-gender players, bench of 2, 1 inning -> full freedom over
    // which 2 field. ace is a great Pitcher but bad Catcher; star is a
    // great Catcher but bad Pitcher; the other two are mediocre at both.
    // The globally best achievable quality fields ace+star (10+10=20) —
    // strictly better than any pair involving a mediocre player (13) or
    // both mediocre players (6).
    const positions: PositionProfile[] = [makePosition("P"), makePosition("C")];
    const ace: FieldingSolverPlayer = { id: "ace", gender: "M" };
    const star: FieldingSolverPlayer = { id: "star", gender: "M" };
    const mediocre1: FieldingSolverPlayer = { id: "mediocre1", gender: "M" };
    const mediocre2: FieldingSolverPlayer = { id: "mediocre2", gender: "M" };

    const { assignments } = await solveFielding({
      players: [ace, star, mediocre1, mediocre2],
      positions,
      innings: 1,
      genderMinimums: [],
      ratings: [
        { playerId: "ace", positionName: "P", rating: 10 },
        { playerId: "ace", positionName: "C", rating: 1 },
        { playerId: "star", positionName: "C", rating: 10 },
        { playerId: "star", positionName: "P", rating: 1 },
        { playerId: "mediocre1", positionName: "P", rating: 3 },
        { playerId: "mediocre1", positionName: "C", rating: 3 },
        { playerId: "mediocre2", positionName: "P", rating: 3 },
        { playerId: "mediocre2", positionName: "C", rating: 3 },
      ],
    });

    const fieldedIds = new Set(
      assignments.filter((a) => a.position !== BENCH).map((a) => a.playerId),
    );
    expect(fieldedIds).toEqual(new Set(["ace", "star"]));
  });

  it("prefers a weaker fairness-tied lineup in the extra (last) inning, not a stronger one", async () => {
    // 5 same-gender players, bench of 3, 2 innings, importance 3 at both
    // positions. ace (10/10) + b (8/8) are strictly the best pair for
    // inning 1 — phase 1 maximizes inning 1 in isolation (inning 2, as
    // the extra inning, doesn't factor in at all), so {ace,b} always wins
    // inning 1, structurally excluding ace/b from inning 2 (they'd exceed
    // their fair share if they fielded twice out of 2 innings). That
    // leaves inning 2 free to be filled from {c,d,e} however phase 2
    // likes. Phase 2 doesn't just pick the weakest *pair* among c/d/e —
    // it minimizes quality over pair *and* position assignment together,
    // so the true minimum considers both fits of every pair: {c,d} can go
    // as low as 3*(1+1)=6 (the game's actual minimum, achieved by giving
    // each of c/d their *worse* position instead of their better one),
    // beating every other pair/fit combination.
    const positions: PositionProfile[] = [makePosition("P"), makePosition("C")];
    const ace: FieldingSolverPlayer = { id: "ace", gender: "M" };
    const b: FieldingSolverPlayer = { id: "b", gender: "M" };
    const c: FieldingSolverPlayer = { id: "c", gender: "M" };
    const d: FieldingSolverPlayer = { id: "d", gender: "M" };
    const e: FieldingSolverPlayer = { id: "e", gender: "M" };

    const ratings = [
      { playerId: "ace", positionName: "P", rating: 10 },
      { playerId: "ace", positionName: "C", rating: 10 },
      { playerId: "b", positionName: "P", rating: 8 },
      { playerId: "b", positionName: "C", rating: 8 },
      { playerId: "c", positionName: "P", rating: 5 },
      { playerId: "c", positionName: "C", rating: 1 },
      { playerId: "d", positionName: "P", rating: 1 },
      { playerId: "d", positionName: "C", rating: 5 },
      { playerId: "e", positionName: "P", rating: 3 },
      { playerId: "e", positionName: "C", rating: 3 },
    ];

    const { assignments } = await solveFielding({
      players: [ace, b, c, d, e],
      positions,
      innings: 2,
      genderMinimums: [],
      ratings,
    });

    const ratingFor = (playerId: string, position: string) =>
      ratings.find((r) => r.playerId === playerId && r.positionName === position)!.rating;
    const inning1Fielders = new Set(
      assignments.filter((a) => a.inning === 1 && a.position !== BENCH).map((a) => a.playerId),
    );
    expect(inning1Fielders).toEqual(new Set(["ace", "b"]));

    const inning2Quality = assignments
      .filter((a) => a.inning === 2 && a.position !== BENCH)
      .reduce((sum, a) => sum + 3 * ratingFor(a.playerId, a.position), 0);
    expect(inning2Quality).toBe(6);
  });

  it("finds the brute-force-optimal total quality across the real innings, even when it means splitting up the two strongest players", async () => {
    // 6 players, 2 positions, no gender constraint, 3 innings (2 real + 1
    // extra): fieldSize=2 and fair share = 3*2/6 = 1 exactly, so every
    // player fields *exactly once* across the whole game — no slack.
    // Phase 1 (maximize innings 1-2 together) therefore reduces to:
    // choose which 2 of the 6 players sit out the real innings entirely
    // (forced into inning 3), then best-fit-pair the remaining 4 across
    // innings 1 and 2. That's small enough to brute-force exhaustively —
    // C(6,2)=15 choices of who sits out x 3 ways to pair the remaining 4
    // — and compare against what the solver actually finds.
    //
    // Ratings are adversarial to a myopic per-inning optimizer: a and b
    // are each strong at both positions, so pairing them together
    // maximizes *that inning's own* quality — but a true optimum should
    // discover that spreading them across separate innings (each
    // anchoring a weaker partner) beats clustering them together and
    // leaving two weak players stuck with each other.
    const positions: PositionProfile[] = [makePosition("P", { importance: 1 }), makePosition("C", { importance: 1 })];
    const ids = ["a", "b", "c", "d", "e", "f"];
    const players: FieldingSolverPlayer[] = ids.map((id) => ({ id, gender: "M" }));
    const ratingTable: Record<string, { P: number; C: number }> = {
      a: { P: 8, C: 7 },
      b: { P: 7, C: 6 },
      c: { P: 6, C: 6 },
      d: { P: 6, C: 6 },
      e: { P: 6, C: 6 },
      f: { P: 6, C: 6 },
    };
    const ratings = Object.entries(ratingTable).flatMap(([playerId, r]) => [
      { playerId, positionName: "P", rating: r.P },
      { playerId, positionName: "C", rating: r.C },
    ]);

    const bestPairQuality = (p1: string, p2: string) =>
      Math.max(ratingTable[p1].P + ratingTable[p2].C, ratingTable[p2].P + ratingTable[p1].C);

    let bruteForceMax = -Infinity;
    for (let ei = 0; ei < ids.length; ei++) {
      for (let ej = ei + 1; ej < ids.length; ej++) {
        const excluded = new Set([ids[ei], ids[ej]]);
        const remaining = ids.filter((id) => !excluded.has(id));
        const [r0, r1, r2, r3] = remaining;
        const partitions: [string, string][][] = [
          [[r0, r1], [r2, r3]],
          [[r0, r2], [r1, r3]],
          [[r0, r3], [r1, r2]],
        ];
        for (const [pairA, pairB] of partitions) {
          const total = bestPairQuality(...pairA) + bestPairQuality(...pairB);
          bruteForceMax = Math.max(bruteForceMax, total);
        }
      }
    }

    const { assignments } = await solveFielding({
      players,
      positions,
      innings: 3,
      genderMinimums: [],
      ratings,
    });

    let realInningsQuality = 0;
    for (const a of assignments) {
      if (a.inning === 3 || a.position === BENCH) continue;
      realInningsQuality += ratingTable[a.playerId][a.position as "P" | "C"];
    }
    expect(realInningsQuality).toBe(bruteForceMax);
  });

  it("never benches two position specialists in the same real inning when a fair alternative exists", async () => {
    // 2 specialists (s1 rated 10, s2 rated 8 at "P") among 6 generic
    // players (all rated 5 everywhere, no reason to prefer any one of
    // them over another), 4 positions -> bench of 4 out of 8, 7 innings
    // (7 is the extra/tie-breaker slot, excluded below since the
    // "prefer a weaker fairness-tied lineup" behavior can legitimately
    // put both specialists there if that's genuinely the weakest option).
    // Because the 6 generic players are fully interchangeable, there's
    // always a fairness-tied way to keep s1 and s2 apart without costing
    // any real inning any quality — so a true optimum should never pay
    // that price.
    const positions: PositionProfile[] = [
      makePosition("P"),
      makePosition("X"),
      makePosition("Y"),
      makePosition("Z"),
    ];
    const players: FieldingSolverPlayer[] = [
      { id: "s1", gender: "M" },
      { id: "s2", gender: "M" },
      { id: "g1", gender: "M" },
      { id: "g2", gender: "M" },
      { id: "g3", gender: "M" },
      { id: "g4", gender: "M" },
      { id: "g5", gender: "M" },
      { id: "g6", gender: "M" },
    ];
    const ratings = [
      { playerId: "s1", positionName: "P", rating: 10 },
      { playerId: "s2", positionName: "P", rating: 8 },
    ];

    const { assignments } = await solveFielding({
      players,
      positions,
      innings: 7,
      genderMinimums: [],
      ratings,
    });

    const benchInningsFor = (playerId: string) =>
      new Set(
        assignments
          .filter((a) => a.playerId === playerId && a.position === BENCH && a.inning < 7)
          .map((a) => a.inning),
      );
    const s1BenchInnings = benchInningsFor("s1");
    const s2BenchInnings = benchInningsFor("s2");
    const overlap = [...s1BenchInnings].filter((inning) => s2BenchInnings.has(inning));
    expect(overlap).toEqual([]);
  });
});
