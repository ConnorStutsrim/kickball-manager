const NEUTRAL_RATING = 3;

export interface PlayerSkills {
  speed: number | null;
  catching: number | null;
  throwing: number | null;
  gameSense: number | null;
}

export interface PositionProfile {
  name: string;
  importance: number;
  weightSpeed: number;
  weightCatching: number;
  weightThrowing: number;
  weightGameSense: number;
}

function rating(value: number | null): number {
  return value ?? NEUTRAL_RATING;
}

/**
 * Predicts how well a player fits a position: the weighted average of their
 * skill axes, weighted by how predictive each axis is of that position
 * (the position's profile). A position with no weights configured yet
 * (all zero) has no basis for a prediction, so it falls back to neutral
 * rather than dividing by zero.
 */
export function positionAptitude(
  player: PlayerSkills,
  profile: PositionProfile,
): number {
  const totalWeight =
    profile.weightSpeed +
    profile.weightCatching +
    profile.weightThrowing +
    profile.weightGameSense;

  if (totalWeight <= 0) return NEUTRAL_RATING;

  return (
    (profile.weightSpeed * rating(player.speed) +
      profile.weightCatching * rating(player.catching) +
      profile.weightThrowing * rating(player.throwing) +
      profile.weightGameSense * rating(player.gameSense)) /
    totalWeight
  );
}
