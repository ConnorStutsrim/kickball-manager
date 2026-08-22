const NEUTRAL_RATING = 5;

export interface BatterSkills {
  power: number | null;
  placement: number | null;
  bunting: number | null;
  baserunning: number | null;
}

export interface BattingSlotArchetype {
  name: string;
  weightPower: number;
  weightPlacement: number;
  weightBunting: number;
  weightBaserunning: number;
}

function rating(value: number | null): number {
  return value ?? NEUTRAL_RATING;
}

/**
 * Predicts how well a player fits a batting-order slot archetype: the
 * weighted average of their batting skill axes, weighted by how much each
 * axis matters for that archetype. An archetype with no weights configured
 * yet (all zero) has no basis for a prediction, so it falls back to neutral
 * rather than dividing by zero.
 */
export function battingAptitude(
  player: BatterSkills,
  archetype: BattingSlotArchetype,
): number {
  const totalWeight =
    archetype.weightPower +
    archetype.weightPlacement +
    archetype.weightBunting +
    archetype.weightBaserunning;

  if (totalWeight <= 0) return NEUTRAL_RATING;

  return (
    (archetype.weightPower * rating(player.power) +
      archetype.weightPlacement * rating(player.placement) +
      archetype.weightBunting * rating(player.bunting) +
      archetype.weightBaserunning * rating(player.baserunning)) /
    totalWeight
  );
}
