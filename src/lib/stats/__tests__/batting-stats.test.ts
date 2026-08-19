import { describe, expect, it } from "vitest";
import { computeBattingStats, type PlateAppearanceRecord } from "../batting-stats";

function pa(overrides: Partial<PlateAppearanceRecord> = {}): PlateAppearanceRecord {
  return {
    playerId: "p1",
    result: "out",
    rbi: 0,
    isBunt: false,
    ...overrides,
  };
}

describe("computeBattingStats", () => {
  it("computes totalBasesPerPA correctly (slugging-style)", () => {
    const stats = computeBattingStats(
      ["p1"],
      [
        pa({ result: "single" }), // 1 base
        pa({ result: "double" }), // 2 bases
        pa({ result: "home_run" }), // 4 bases
        pa({ result: "out" }), // 0 bases
      ],
      [],
    );
    // (1+2+4+0) / 4 PAs = 1.75
    expect(stats[0].totalBasesPerPA).toBe(1.75);
    expect(stats[0].plateAppearances).toBe(4);
  });

  it("excludes walks from hitRateExcludingWalks but counts them toward timesReachedBase", () => {
    const stats = computeBattingStats(
      ["p1"],
      [
        pa({ result: "single" }),
        pa({ result: "walk" }),
        pa({ result: "out" }),
        pa({ result: "out" }),
      ],
      [],
    );
    // Non-walk PAs: single, out, out (3) -> 1 hit / 3 = 0.333...
    expect(stats[0].hitRateExcludingWalks).toBeCloseTo(1 / 3);
    // Reached base: single + walk = 2
    expect(stats[0].timesReachedBase).toBe(2);
  });

  it("computes advancementRate as a fraction of timesReachedBase, without dividing by zero", () => {
    const noReach = computeBattingStats(
      ["p1"],
      [pa({ result: "out" }), pa({ result: "out" })],
      [{ playerId: "p1", eventType: "advanced" }],
    );
    expect(noReach[0].advancementRate).toBe(0);

    const withReach = computeBattingStats(
      ["p1"],
      [pa({ result: "single" }), pa({ result: "walk" })],
      [
        { playerId: "p1", eventType: "advanced" },
        { playerId: "p1", eventType: "scored" },
      ],
    );
    // 2 advancement-type events / 2 times reached base = 1
    expect(withReach[0].advancementRate).toBe(1);
  });

  it("returns null buntSuccessRate when no bunts were attempted", () => {
    const stats = computeBattingStats(["p1"], [pa({ result: "single" })], []);
    expect(stats[0].buntAttempts).toBe(0);
    expect(stats[0].buntSuccessRate).toBeNull();
  });

  it("counts any non-out result as a successful bunt", () => {
    const stats = computeBattingStats(
      ["p1"],
      [
        pa({ isBunt: true, result: "single" }),
        pa({ isBunt: true, result: "sac" }),
        pa({ isBunt: true, result: "out" }),
        pa({ isBunt: false, result: "out" }), // not a bunt, shouldn't count
      ],
      [],
    );
    expect(stats[0].buntAttempts).toBe(3);
    // 2 successes (single, sac) / 3 attempts
    expect(stats[0].buntSuccessRate).toBeCloseTo(2 / 3);
  });

  it("keeps stats separate per player and handles a player with zero plate appearances", () => {
    const stats = computeBattingStats(
      ["p1", "p2"],
      [pa({ playerId: "p1", result: "home_run" })],
      [],
    );
    const p1 = stats.find((s) => s.playerId === "p1")!;
    const p2 = stats.find((s) => s.playerId === "p2")!;
    expect(p1.totalBasesPerPA).toBe(4);
    expect(p2.plateAppearances).toBe(0);
    expect(p2.totalBasesPerPA).toBe(0);
    expect(p2.hitRateExcludingWalks).toBe(0);
  });
});
