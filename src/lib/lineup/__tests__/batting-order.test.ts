import { describe, expect, it } from "vitest";
import { buildBattingOrder, type BattingOrderPlayer } from "../batting-order";
import type { BattingSlotArchetype } from "../batting-aptitude";

function player(
  id: string,
  overrides: Partial<Omit<BattingOrderPlayer, "id">> = {},
): BattingOrderPlayer {
  return {
    id,
    power: 3,
    placement: 3,
    bunting: 3,
    baserunning: 3,
    ...overrides,
  };
}

const ARCHETYPES: BattingSlotArchetype[] = [
  { name: "Leadoff", weightPower: 0, weightPlacement: 0, weightBunting: 0, weightBaserunning: 1 },
  { name: "Connector", weightPower: 0, weightPlacement: 1, weightBunting: 0, weightBaserunning: 0 },
  { name: "Cleanup", weightPower: 1, weightPlacement: 0, weightBunting: 0, weightBaserunning: 0 },
  { name: "Balanced", weightPower: 1, weightPlacement: 1, weightBunting: 1, weightBaserunning: 1 },
];

describe("buildBattingOrder", () => {
  it("puts the best baserunner in the leadoff (1st) slot", () => {
    const speedster = player("speedster", { baserunning: 5, power: 1, placement: 1, bunting: 1 });
    const players = [
      player("average1"),
      speedster,
      player("average2"),
      player("average3"),
      player("average4"),
    ];

    const order = buildBattingOrder({ players, archetypes: ARCHETYPES });
    expect(order[0].playerId).toBe("speedster");
    expect(order[0].battingPosition).toBe(1);
  });

  it("puts the two best power hitters in the two Cleanup slots (3rd and 4th)", () => {
    const sluggerA = player("sluggerA", { power: 5 });
    const sluggerB = player("sluggerB", { power: 4 });
    const players = [
      player("filler1"),
      player("filler2"),
      player("filler3"),
      player("filler4"),
      sluggerA,
      sluggerB,
    ];

    const order = buildBattingOrder({ players, archetypes: ARCHETYPES });
    expect(order[2].playerId).toBe("sluggerA");
    expect(order[3].playerId).toBe("sluggerB");
  });

  it("defaults missing ratings to neutral without crashing", () => {
    const unrated: BattingOrderPlayer = {
      id: "unrated",
      power: null,
      placement: null,
      bunting: null,
      baserunning: null,
    };
    const players = [player("average1"), unrated, player("average2")];

    const order = buildBattingOrder({ players, archetypes: ARCHETYPES });
    expect(order).toHaveLength(3);
    expect(order.map((o) => o.playerId).sort()).toEqual(
      ["average1", "average2", "unrated"].sort(),
    );
  });

  it("follows the full Leadoff/Connector/Cleanup/Cleanup/Balanced.../Leadoff cycle", () => {
    const s1 = player("s1-leadoff", { baserunning: 5, power: 1, placement: 1, bunting: 1 });
    const s2 = player("s2-connector", { placement: 5, power: 1, baserunning: 1, bunting: 1 });
    const s3 = player("s3-cleanup-a", { power: 5, placement: 1, bunting: 1, baserunning: 1 });
    const s4 = player("s4-cleanup-b", { power: 4, placement: 1, bunting: 1, baserunning: 1 });
    const tailHigh = player("tail-high", { power: 3, placement: 3, bunting: 3, baserunning: 3 });
    const tailLow = player("tail-low", { power: 2, placement: 2, bunting: 2, baserunning: 2 });
    // Weak everywhere except baserunning, but not as fast as s1 — should
    // wait out the whole order and land in the final "second leadoff" slot.
    const secondLeadoff = player("second-leadoff", {
      baserunning: 4,
      power: 1,
      placement: 1,
      bunting: 1,
    });

    const order = buildBattingOrder({
      players: [s1, s2, s3, s4, tailHigh, tailLow, secondLeadoff],
      archetypes: ARCHETYPES,
    });

    expect(order.map((o) => o.playerId)).toEqual([
      "s1-leadoff",
      "s2-connector",
      "s3-cleanup-a",
      "s4-cleanup-b",
      "tail-high",
      "tail-low",
      "second-leadoff",
    ]);
  });

  it("produces a batting position for every player exactly once", () => {
    const players = Array.from({ length: 12 }, (_, i) => player(`p${i}`));
    const order = buildBattingOrder({ players, archetypes: ARCHETYPES });
    expect(order).toHaveLength(12);
    expect(new Set(order.map((o) => o.battingPosition)).size).toBe(12);
    expect(order.map((o) => o.battingPosition).sort((a, b) => a - b)).toEqual(
      Array.from({ length: 12 }, (_, i) => i + 1),
    );
  });

  it("falls back gracefully when an archetype is missing from the input", () => {
    const players = [player("p1"), player("p2"), player("p3")];
    const order = buildBattingOrder({ players, archetypes: [] });
    expect(order).toHaveLength(3);
  });
});
