import { describe, expect, it } from "vitest";
import {
  BENCH,
  computeGenderShortfalls,
  solveFielding,
  type FieldingSolverPlayer,
  type GenderMinimum,
  type PositionProfile,
  type PositionShoreUpWeight,
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

// Mirrors the real league's actual position names — unlike POSITIONS above,
// this includes "Float" and "Outfield 4" by name, which is what the
// shorthanded-gender degradation logic matches against.
const REAL_POSITIONS: PositionProfile[] = [
  makePosition("Pitcher"),
  makePosition("Catcher"),
  makePosition("Monster"),
  makePosition("1st"),
  makePosition("2nd"),
  makePosition("3rd"),
  makePosition("Float"),
  makePosition("Outfield 1"),
  makePosition("Outfield 2"),
  makePosition("Outfield 3"),
  makePosition("Outfield 4"),
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

  describe("computeGenderShortfalls", () => {
    it("reports 0 shortfall when a gender's total meets or exceeds the minimum", () => {
      const players = makeRoster(4, 9);
      const shortfalls = computeGenderShortfalls(players, STANDARD_MINIMUMS);
      expect(shortfalls.find((s) => s.gender === "M")).toMatchObject({ total: 4, min: 4, shortfall: 0 });
    });

    it("reports min minus total as the shortfall otherwise, independent per gender", () => {
      const players = makeRoster(3, 2);
      const shortfalls = computeGenderShortfalls(players, STANDARD_MINIMUMS);
      expect(shortfalls.find((s) => s.gender === "M")).toMatchObject({ total: 3, min: 4, shortfall: 1 });
      expect(shortfalls.find((s) => s.gender === "F")).toMatchObject({ total: 2, min: 4, shortfall: 2 });
    });
  });

  it("plays without Float when a gender is exactly 1 short of the minimum", async () => {
    const players = makeRoster(3, 9); // only 3 men, minimum requires 4 -> 1 short
    const { assignments, warnings } = await solveFielding({
      players,
      positions: REAL_POSITIONS,
      innings: 3,
      genderMinimums: STANDARD_MINIMUMS,
    });

    expect(warnings.some((w) => w.includes("shorthanded"))).toBe(true);
    expect(assignments.some((a) => a.position === "Float")).toBe(false);
    // Outfield 4 isn't dropped until 2 short — still available here.
    expect(assignments.some((a) => a.position === "Outfield 4")).toBe(true);

    // All 3 men are short-handed, so all 3 field every inning, never benched.
    for (const p of players.filter((p) => p.gender === "M")) {
      const benchedInnings = assignments.filter(
        (a) => a.playerId === p.id && a.position === BENCH,
      );
      expect(benchedInnings).toEqual([]);
    }
  });

  it("also plays without Outfield 4 when a gender is 2 short of the minimum", async () => {
    const players = makeRoster(2, 9); // only 2 men, minimum requires 4 -> 2 short
    const { assignments, warnings } = await solveFielding({
      players,
      positions: REAL_POSITIONS,
      innings: 3,
      genderMinimums: STANDARD_MINIMUMS,
    });

    expect(warnings.some((w) => w.includes("shorthanded"))).toBe(true);
    expect(assignments.some((a) => a.position === "Float")).toBe(false);
    expect(assignments.some((a) => a.position === "Outfield 4")).toBe(false);

    for (const p of players.filter((p) => p.gender === "M")) {
      const benchedInnings = assignments.filter(
        (a) => a.playerId === p.id && a.position === BENCH,
      );
      expect(benchedInnings).toEqual([]);
    }

    // The non-short gender still rotates fairly among themselves.
    const benchCounts = new Map<string, number>();
    for (const p of players.filter((p) => p.gender === "F")) benchCounts.set(p.id, 0);
    for (const a of assignments) {
      if (a.position === BENCH && benchCounts.has(a.playerId)) {
        benchCounts.set(a.playerId, benchCounts.get(a.playerId)! + 1);
      }
    }
    const counts = [...benchCounts.values()];
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
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

    for (const a of assignments) {
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

    for (const a of assignments) {
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

  it("finds the brute-force-optimal total quality across a game, even when it means splitting up the two strongest players", async () => {
    // 4 players, 2 positions, no gender constraint, 2 innings: with
    // fieldSize=2 and everyone tied at 0 field-innings going into inning
    // 1, fairness allows *any* of the C(4,2)=6 possible pairs to field
    // inning 1 (inning 2 is then forced to the complementary pair). That's
    // a small enough space to brute-force exhaustively and compare
    // against what the solver actually finds.
    //
    // Ratings are adversarial to a myopic per-inning optimizer: a and b
    // are each strong at both positions, so pairing them together
    // maximizes *inning 1's own* quality — but a true optimum should
    // discover that spreading them across separate innings (each
    // anchoring a weaker partner) beats clustering them together and
    // leaving two weak players stuck with each other.
    const positions: PositionProfile[] = [makePosition("P", { importance: 1 }), makePosition("C", { importance: 1 })];
    const players: FieldingSolverPlayer[] = [
      { id: "a", gender: "M" },
      { id: "b", gender: "M" },
      { id: "c", gender: "M" },
      { id: "d", gender: "M" },
    ];
    const ratingTable: Record<string, { P: number; C: number }> = {
      a: { P: 8, C: 7 },
      b: { P: 7, C: 6 },
      c: { P: 6, C: 6 },
      d: { P: 6, C: 6 },
    };
    const ratings = Object.entries(ratingTable).flatMap(([playerId, r]) => [
      { playerId, positionName: "P", rating: r.P },
      { playerId, positionName: "C", rating: r.C },
    ]);

    const bestPairQuality = (p1: string, p2: string) =>
      Math.max(ratingTable[p1].P + ratingTable[p2].C, ratingTable[p2].P + ratingTable[p1].C);

    const ids = players.map((p) => p.id);
    let bruteForceMax = -Infinity;
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const inning1 = [ids[i], ids[j]];
        const inning2 = ids.filter((id) => !inning1.includes(id));
        const total = bestPairQuality(inning1[0], inning1[1]) + bestPairQuality(inning2[0], inning2[1]);
        bruteForceMax = Math.max(bruteForceMax, total);
      }
    }

    const { assignments } = await solveFielding({
      players,
      positions,
      innings: 2,
      genderMinimums: [],
      ratings,
    });

    let totalQuality = 0;
    for (const a of assignments) {
      if (a.position === BENCH) continue;
      totalQuality += ratingTable[a.playerId][a.position as "P" | "C"];
    }
    expect(totalQuality).toBe(bruteForceMax);
  });

  it("never benches two position specialists in the same inning when a fair alternative exists", async () => {
    // 2 specialists (s1 rated 10, s2 rated 8 at "P") among 6 generic
    // players (all rated 5 everywhere, no reason to prefer any one of
    // them over another), 4 positions -> bench of 4 out of 8, 7 innings.
    // Because the 6 generic players are fully interchangeable, there's
    // always a fairness-tied way to keep s1 and s2 apart without costing
    // any inning any quality — so a true optimum should never pay that
    // price, in any inning.
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
          .filter((a) => a.playerId === playerId && a.position === BENCH)
          .map((a) => a.inning),
      );
    const s1BenchInnings = benchInningsFor("s1");
    const s2BenchInnings = benchInningsFor("s2");
    const overlap = [...s1BenchInnings].filter((inning) => s2BenchInnings.has(inning));
    expect(overlap).toEqual([]);
  });

  describe("cross-position coverage (shoreUpWeights)", () => {
    // 3 players, 2 positions (H = "helper", L = "helped"), bench of 1, 1
    // inning, no gender constraint. importance overridden to 1
    // (makePosition defaults to 3) so the coefficient math below (bonus =
    // weight * importance(helped) / 10 * gap) reduces to bonus =
    // weight/10 * gap, keeping the by-hand numbers tractable.
    //
    // The bonus is scaled by the *helped* position's own importance so
    // that, for a fixed helper, raising the helped fielder's own rating
    // is never worse than lowering it (see fielding-solver.ts) — which
    // means, provably, a coverage bonus can never make the solver prefer
    // a *weaker* helped-fielder over a stronger one for the same helper.
    // What it *can* still do is change which player is worth using as
    // helper in the first place, trading away a slightly-better raw fit
    // at the helper position for a much bigger exploitable gap. That's
    // what "shifts the optimal assignment" below demonstrates.
    const positions: PositionProfile[] = [
      makePosition("H", { importance: 1 }),
      makePosition("L", { importance: 1 }),
    ];

    const noWeightPlayers: FieldingSolverPlayer[] = [
      { id: "A", gender: "M" },
      { id: "B", gender: "M" },
      { id: "C", gender: "M" },
    ];
    const noWeightRatings = [
      { playerId: "A", positionName: "H", rating: 10 },
      { playerId: "A", positionName: "L", rating: 5 },
      { playerId: "B", positionName: "H", rating: 6 },
      { playerId: "B", positionName: "L", rating: 6 },
      { playerId: "C", positionName: "H", rating: 5 },
      { playerId: "C", positionName: "L", rating: 9 },
    ];

    async function fieldedPair(
      players: FieldingSolverPlayer[],
      ratings: { playerId: string; positionName: string; rating: number }[],
      shoreUpWeights: PositionShoreUpWeight[],
    ) {
      const { assignments } = await solveFielding({
        players,
        positions,
        innings: 1,
        genderMinimums: [],
        ratings,
        shoreUpWeights,
      });
      return {
        atH: assignments.find((a) => a.position === "H")!.playerId,
        atL: assignments.find((a) => a.position === "L")!.playerId,
      };
    }

    it("has no effect when no weight is configured (backward compatible)", async () => {
      // Pure best-fit with no bonus at all: {A->H, C->L} (raw 10+9=19,
      // beating every other ordered pair).
      expect(await fieldedPair(noWeightPlayers, noWeightRatings, [])).toEqual({
        atH: "A",
        atL: "C",
      });
    });

    it("has no effect when the configured weight is 0", async () => {
      const pair = await fieldedPair(noWeightPlayers, noWeightRatings, [
        { helperPositionName: "H", helpedPositionName: "L", weight: 0 },
      ]);
      expect(pair).toEqual({ atH: "A", atL: "C" });
    });

    // A: H=8, L=7; B: H=6, L=2; C: H=3, L=3.
    // Raw best fit (weight 0): {H:B, L:A} = 6+7 = 13 (B is a fine helper
    // fit, and A is the best available L partner for B).
    // At weight 5, the H->L bonus (coeff = 5/10 = 0.5) rewards A-as-helper
    // instead: A outrates C at H by 5 (8-3), worth a bonus of 0.5*5=2.5 on
    // top of A's raw 8+3=11, totaling 13.5 — narrowly beating {H:B,L:A}'s
    // unchanged 13 (B's own gap against A, 6 vs 7, is already negative,
    // so B's total never grows with weight). Every other ordered pair
    // stays below 13.5 too (verified by brute force below, not just this
    // one comparison).
    const shiftPlayers: FieldingSolverPlayer[] = [
      { id: "A", gender: "M" },
      { id: "B", gender: "M" },
      { id: "C", gender: "M" },
    ];
    const shiftRatings = [
      { playerId: "A", positionName: "H", rating: 8 },
      { playerId: "A", positionName: "L", rating: 7 },
      { playerId: "B", positionName: "H", rating: 6 },
      { playerId: "B", positionName: "L", rating: 2 },
      { playerId: "C", positionName: "H", rating: 3 },
      { playerId: "C", positionName: "L", rating: 3 },
    ];

    function bruteForceBest(
      ratings: typeof shiftRatings,
      helperPositionName: "H" | "L",
      helpedPositionName: "H" | "L",
      weight: number,
    ) {
      const ratingOf = (playerId: string, positionName: string) =>
        ratings.find((r) => r.playerId === playerId && r.positionName === positionName)!.rating;
      const ids = [...new Set(ratings.map((r) => r.playerId))];
      let best = -Infinity;
      let bestPair = { atH: "", atL: "" };
      for (const h of ids) {
        for (const l of ids) {
          if (h === l) continue;
          const raw = ratingOf(h, "H") + ratingOf(l, "L");
          const fielderAtHelper = helperPositionName === "H" ? h : l;
          const fielderAtHelped = helpedPositionName === "H" ? h : l;
          const gap = Math.max(
            0,
            ratingOf(fielderAtHelper, helperPositionName) - ratingOf(fielderAtHelped, helpedPositionName),
          );
          // importance(helped) = 1 throughout this describe block, so the
          // coefficient reduces to weight / 10.
          const total = raw + (weight / 10) * gap;
          if (total > best) {
            best = total;
            bestPair = { atH: h, atL: l };
          }
        }
      }
      return { ...bestPair, total: best };
    }

    it("shifts the optimal assignment once a positive weight makes a different helper worth it", async () => {
      const baseline = bruteForceBest(shiftRatings, "H", "L", 0);
      expect(baseline).toMatchObject({ atH: "B", atL: "A" });

      const withBonus = bruteForceBest(shiftRatings, "H", "L", 5);
      // Confirms the brute force itself picked a genuinely different pair
      // than the no-bonus case, not just a higher score for the same one.
      expect(withBonus).toMatchObject({ atH: "A", atL: "C" });
      expect(withBonus.total).toBeGreaterThan(baseline.total);

      const pair = await fieldedPair(shiftPlayers, shiftRatings, [
        { helperPositionName: "H", helpedPositionName: "L", weight: 5 },
      ]);
      expect(pair).toEqual({ atH: withBonus.atH, atL: withBonus.atL });
    });

    // Same shape as above, mirrored (each player's H/L ratings swapped),
    // so a weight configured L->H produces an analogous flip that H->L on
    // this same roster does *not* produce — proving direction matters,
    // not just magnitude.
    const directionalPlayers: FieldingSolverPlayer[] = [
      { id: "A", gender: "M" },
      { id: "B", gender: "M" },
      { id: "C", gender: "M" },
    ];
    const directionalRatings = [
      { playerId: "A", positionName: "H", rating: 7 },
      { playerId: "A", positionName: "L", rating: 8 },
      { playerId: "B", positionName: "H", rating: 2 },
      { playerId: "B", positionName: "L", rating: 6 },
      { playerId: "C", positionName: "H", rating: 3 },
      { playerId: "C", positionName: "L", rating: 3 },
    ];

    it("is directional — the same weight applied L->H instead of H->L finds a different optimum", async () => {
      const lToH = bruteForceBest(directionalRatings, "L", "H", 5);
      const hToL = bruteForceBest(directionalRatings, "H", "L", 5);
      // Confirms the two directions genuinely disagree on this roster, not
      // just that both happen to compute some bonus.
      expect(lToH).not.toMatchObject({ atH: hToL.atH, atL: hToL.atL });

      const pairLToH = await fieldedPair(directionalPlayers, directionalRatings, [
        { helperPositionName: "L", helpedPositionName: "H", weight: 5 },
      ]);
      expect(pairLToH).toEqual({ atH: lToH.atH, atL: lToH.atL });

      const pairHToL = await fieldedPair(directionalPlayers, directionalRatings, [
        { helperPositionName: "H", helpedPositionName: "L", weight: 5 },
      ]);
      expect(pairHToL).toEqual({ atH: hToL.atH, atL: hToL.atL });
    });

    // Separate 3-position scenario (H1, H2, L; bench of 1; 4 players): two
    // *simultaneous* helpers both targeting L. P1/P2 are clearly the best
    // fits for H1/H2 regardless of who plays L (rated 10 there, everyone
    // else defaults to 5), so the only real question is whether P3 (a
    // weak L fielder, rating 3) or P4 (a better one, rating 6) plays L —
    // and the guarantee this fix establishes is that the answer can never
    // flip toward the weaker one, no matter how many helpers are active
    // at once. Both H1->L and H2->L are configured at weight 8 (well past
    // what a single unshared pair could safely carry against L's
    // importance of 1) specifically to stress-test that the per-pair /
    // helper-count division still holds the line when summed.
    it("never prefers a weaker helped fielder even with multiple simultaneous helpers", async () => {
      const multiHelperPositions: PositionProfile[] = [
        makePosition("H1", { importance: 1 }),
        makePosition("H2", { importance: 1 }),
        makePosition("L", { importance: 1 }),
      ];
      const multiHelperPlayers: FieldingSolverPlayer[] = [
        { id: "P1", gender: "M" },
        { id: "P2", gender: "M" },
        { id: "P3", gender: "M" },
        { id: "P4", gender: "M" },
      ];
      const multiHelperRatings = [
        { playerId: "P1", positionName: "H1", rating: 10 },
        { playerId: "P2", positionName: "H2", rating: 10 },
        { playerId: "P3", positionName: "L", rating: 3 },
        { playerId: "P4", positionName: "L", rating: 6 },
      ];

      const { assignments } = await solveFielding({
        players: multiHelperPlayers,
        positions: multiHelperPositions,
        innings: 1,
        genderMinimums: [],
        ratings: multiHelperRatings,
        shoreUpWeights: [
          { helperPositionName: "H1", helpedPositionName: "L", weight: 8 },
          { helperPositionName: "H2", helpedPositionName: "L", weight: 8 },
        ],
      });

      const atL = assignments.find((a) => a.position === "L")!.playerId;
      expect(atL).toBe("P4");
    });
  });
});
