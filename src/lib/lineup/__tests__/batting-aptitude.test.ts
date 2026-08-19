import { describe, expect, it } from "vitest";
import {
  battingAptitude,
  type BatterSkills,
  type BattingSlotArchetype,
} from "../batting-aptitude";

function archetype(overrides: Partial<Omit<BattingSlotArchetype, "name">> = {}): BattingSlotArchetype {
  return {
    name: "Test",
    weightPower: 0,
    weightPlacement: 0,
    weightBunting: 0,
    weightBaserunning: 0,
    ...overrides,
  };
}

function skills(overrides: Partial<BatterSkills> = {}): BatterSkills {
  return {
    power: null,
    placement: null,
    bunting: null,
    baserunning: null,
    ...overrides,
  };
}

describe("battingAptitude", () => {
  it("computes a weighted average across the relevant skill axes", () => {
    const player = skills({ power: 5, baserunning: 1 });
    const cleanup = archetype({ weightPower: 3, weightBaserunning: 1 });
    // (3*5 + 1*1) / 4 = 4
    expect(battingAptitude(player, cleanup)).toBe(4);
  });

  it("ignores skill axes with zero weight", () => {
    const player = skills({ power: 1, placement: 5, bunting: 1, baserunning: 1 });
    const placementOnly = archetype({ weightPlacement: 1 });
    expect(battingAptitude(player, placementOnly)).toBe(5);
  });

  it("defaults missing ratings to the neutral midpoint", () => {
    const player = skills(); // everything null
    const a = archetype({ weightPower: 1, weightBaserunning: 1 });
    expect(battingAptitude(player, a)).toBe(3);
  });

  it("falls back to neutral when an archetype has no weights configured", () => {
    const player = skills({ power: 5, placement: 5, bunting: 5, baserunning: 5 });
    const unconfigured = archetype(); // all weights 0
    expect(battingAptitude(player, unconfigured)).toBe(3);
  });
});
