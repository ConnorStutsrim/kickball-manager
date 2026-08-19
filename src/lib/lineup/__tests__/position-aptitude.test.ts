import { describe, expect, it } from "vitest";
import { positionAptitude, type PlayerSkills, type PositionProfile } from "../position-aptitude";

function profile(overrides: Partial<PositionProfile> = {}): PositionProfile {
  return {
    name: "Test",
    importance: 3,
    weightSpeed: 0,
    weightCatching: 0,
    weightThrowing: 0,
    weightGameSense: 0,
    ...overrides,
  };
}

function skills(overrides: Partial<PlayerSkills> = {}): PlayerSkills {
  return {
    speed: null,
    catching: null,
    throwing: null,
    gameSense: null,
    ...overrides,
  };
}

describe("positionAptitude", () => {
  it("computes a weighted average across the relevant skill axes", () => {
    const player = skills({ speed: 5, catching: 1 });
    const catcherProfile = profile({ weightCatching: 3, weightSpeed: 1 });
    // (3*1 + 1*5) / 4 = 2
    expect(positionAptitude(player, catcherProfile)).toBe(2);
  });

  it("ignores skill axes with zero weight", () => {
    const player = skills({ speed: 1, catching: 5, throwing: 1, gameSense: 1 });
    const catchingOnly = profile({ weightCatching: 1 });
    expect(positionAptitude(player, catchingOnly)).toBe(5);
  });

  it("defaults missing ratings to the neutral midpoint", () => {
    const player = skills(); // everything null
    const p = profile({ weightSpeed: 1, weightCatching: 1 });
    expect(positionAptitude(player, p)).toBe(3);
  });

  it("falls back to neutral when a position has no weights configured", () => {
    const player = skills({ speed: 5, catching: 5, throwing: 5, gameSense: 5 });
    const unconfigured = profile(); // all weights 0
    expect(positionAptitude(player, unconfigured)).toBe(3);
  });
});
