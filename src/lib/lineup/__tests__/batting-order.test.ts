import { describe, expect, it } from "vitest";
import { buildBattingOrder, type BattingOrderPlayer } from "../batting-order";

function player(
  id: string,
  overrides: Partial<Omit<BattingOrderPlayer, "id">> = {},
): BattingOrderPlayer {
  return {
    id,
    ratingContact: 3,
    ratingPower: 3,
    ratingSpeed: 3,
    ratingPlateDiscipline: 3,
    ...overrides,
  };
}

describe("buildBattingOrder", () => {
  it("puts the best speed+discipline player leadoff", () => {
    const speedster = player("speedster", { ratingSpeed: 5, ratingPlateDiscipline: 5 });
    const players = [
      player("average1"),
      speedster,
      player("average2"),
      player("average3"),
      player("average4"),
    ];

    const order = buildBattingOrder({ players });
    expect(order[0].playerId).toBe("speedster");
    expect(order[0].battingPosition).toBe(1);
  });

  it("puts the best power hitter in the cleanup (4th) spot", () => {
    // Slugger is deliberately weak elsewhere so power alone decides the
    // cleanup spot, without also winning leadoff/#2/#3 on overall score.
    const slugger = player("slugger", {
      ratingPower: 5,
      ratingContact: 2,
      ratingSpeed: 2,
      ratingPlateDiscipline: 2,
    });
    const bestOverall = player("best-overall", {
      ratingContact: 4,
      ratingPower: 4,
      ratingSpeed: 4,
      ratingPlateDiscipline: 4,
    });
    const players = [
      player("filler1"),
      player("filler2"),
      slugger,
      player("filler3"),
      bestOverall,
    ];

    const order = buildBattingOrder({ players });
    expect(order[3].playerId).toBe("slugger");
  });

  it("defaults missing ratings to neutral without crashing", () => {
    const unrated: BattingOrderPlayer = {
      id: "unrated",
      ratingContact: null,
      ratingPower: null,
      ratingSpeed: null,
      ratingPlateDiscipline: null,
    };
    const players = [player("average1"), unrated, player("average2")];

    const order = buildBattingOrder({ players });
    expect(order).toHaveLength(3);
    expect(order.map((o) => o.playerId).sort()).toEqual(
      ["average1", "average2", "unrated"].sort(),
    );
  });

  it("orders the tail of the lineup by descending overall score", () => {
    // Five specialists, each dominant in exactly the one dimension their
    // slot cares about and deliberately weak elsewhere, so each is claimed
    // by its intended slot and none leaks into the tail. Two tail players
    // are moderate in every dimension (never enough to win a specialist's
    // own dimension, or to beat the overall specialist on overall score),
    // so they're guaranteed to fall through and get sorted by overall score.
    const players = [
      player("s1-leadoff", { ratingSpeed: 5, ratingPlateDiscipline: 5, ratingContact: 1, ratingPower: 1 }),
      player("s2-contact", { ratingContact: 5, ratingSpeed: 1, ratingPlateDiscipline: 1, ratingPower: 1 }),
      player("s3-overall", { ratingContact: 5, ratingPower: 5, ratingSpeed: 5, ratingPlateDiscipline: 5 }),
      player("s4-power", { ratingPower: 5, ratingContact: 1, ratingSpeed: 1, ratingPlateDiscipline: 1 }),
      player("s5-blend", { ratingPower: 5, ratingContact: 5, ratingSpeed: 1, ratingPlateDiscipline: 1 }),
      player("tail-low", { ratingContact: 2, ratingPower: 2, ratingSpeed: 2, ratingPlateDiscipline: 2 }),
      player("tail-high", { ratingContact: 3, ratingPower: 3, ratingSpeed: 3, ratingPlateDiscipline: 3 }),
    ];

    const order = buildBattingOrder({ players });
    const tail = order.slice(5).map((o) => o.playerId);
    expect(tail).toEqual(["tail-high", "tail-low"]);
  });

  it("produces a batting position for every player exactly once", () => {
    const players = Array.from({ length: 12 }, (_, i) => player(`p${i}`));
    const order = buildBattingOrder({ players });
    expect(order).toHaveLength(12);
    expect(new Set(order.map((o) => o.battingPosition)).size).toBe(12);
    expect(order.map((o) => o.battingPosition).sort((a, b) => a - b)).toEqual(
      Array.from({ length: 12 }, (_, i) => i + 1),
    );
  });
});
