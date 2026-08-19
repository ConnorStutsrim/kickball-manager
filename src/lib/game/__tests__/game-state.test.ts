import { describe, expect, it } from "vitest";
import { computeGameState, type GameStateInput } from "../game-state";

const BATTING_ORDER = [
  { playerId: "p1", battingPosition: 1 },
  { playerId: "p2", battingPosition: 2 },
  { playerId: "p3", battingPosition: 3 },
];

function baseInput(overrides: Partial<GameStateInput> = {}): GameStateInput {
  return {
    battingOrder: BATTING_ORDER,
    plateAppearances: [],
    baserunningEvents: [],
    opponentInningRuns: [],
    inningsPlanned: 7,
    ...overrides,
  };
}

describe("computeGameState", () => {
  it("starts at inning 1, half 'us', 0 outs, first batter up, on an empty game", () => {
    const state = computeGameState(baseInput());
    expect(state.currentInning).toBe(1);
    expect(state.half).toBe("us");
    expect(state.outsThisHalf).toBe(0);
    expect(state.nextBatter).toEqual({ playerId: "p1", battingPosition: 1 });
  });

  it("stays in 'us' half while outs are below 3", () => {
    const state = computeGameState(
      baseInput({
        plateAppearances: [
          { inning: 1, playerId: "p1", result: "out", runsScored: false },
          { inning: 1, playerId: "p2", result: "single", runsScored: false },
        ],
      }),
    );
    expect(state.half).toBe("us");
    expect(state.outsThisHalf).toBe(1);
    expect(state.nextBatter).toEqual({ playerId: "p3", battingPosition: 3 });
  });

  it("flips to 'them' once 3 outs are recorded, before opponent runs exist", () => {
    const state = computeGameState(
      baseInput({
        plateAppearances: [
          { inning: 1, playerId: "p1", result: "out", runsScored: false },
          { inning: 1, playerId: "p2", result: "fielders_choice", runsScored: false },
          { inning: 1, playerId: "p3", result: "sac", runsScored: false },
        ],
      }),
    );
    expect(state.currentInning).toBe(1);
    expect(state.half).toBe("them");
  });

  it("moves to the next inning once the opponent's runs are recorded", () => {
    const state = computeGameState(
      baseInput({
        plateAppearances: [
          { inning: 1, playerId: "p1", result: "out", runsScored: false },
          { inning: 1, playerId: "p2", result: "out", runsScored: false },
          { inning: 1, playerId: "p3", result: "out", runsScored: false },
        ],
        opponentInningRuns: [{ inning: 1, runs: 2 }],
      }),
    );
    expect(state.currentInning).toBe(2);
    expect(state.half).toBe("us");
    expect(state.outsThisHalf).toBe(0);
  });

  it("reaches game_over once both halves of the final inning are complete", () => {
    const threeOuts = [
      { inning: 1, playerId: "p1", result: "out" as const, runsScored: false },
      { inning: 1, playerId: "p2", result: "out" as const, runsScored: false },
      { inning: 1, playerId: "p3", result: "out" as const, runsScored: false },
    ];
    const state = computeGameState(
      baseInput({
        inningsPlanned: 1,
        plateAppearances: threeOuts,
        opponentInningRuns: [{ inning: 1, runs: 3 }],
      }),
    );
    expect(state.half).toBe("game_over");
    expect(state.nextBatter).toBeNull();
  });

  it("continues the batting order across innings without resetting", () => {
    // 3 plate appearances in inning 1 (3 outs -> them), opponent recorded ->
    // inning 2 starts. Next batter should be p1 again (3 PAs so far, index 0).
    const state = computeGameState(
      baseInput({
        plateAppearances: [
          { inning: 1, playerId: "p1", result: "out", runsScored: false },
          { inning: 1, playerId: "p2", result: "out", runsScored: false },
          { inning: 1, playerId: "p3", result: "out", runsScored: false },
        ],
        opponentInningRuns: [{ inning: 1, runs: 0 }],
      }),
    );
    expect(state.currentInning).toBe(2);
    expect(state.nextBatter).toEqual({ playerId: "p1", battingPosition: 1 });
  });

  it("sums runs from both plate-appearance runsScored and 'scored' baserunning events", () => {
    const state = computeGameState(
      baseInput({
        plateAppearances: [
          { inning: 1, playerId: "p1", result: "home_run", runsScored: true },
        ],
        baserunningEvents: [
          { inning: 1, eventType: "scored" },
          { inning: 2, eventType: "advanced" }, // shouldn't count as a run
        ],
        opponentInningRuns: [{ inning: 1, runs: 4 }],
      }),
    );
    expect(state.ourRunsByInning[1]).toBe(2);
    expect(state.ourTotalRuns).toBe(2);
    expect(state.theirRunsByInning[1]).toBe(4);
    expect(state.theirTotalRuns).toBe(4);
  });
});
