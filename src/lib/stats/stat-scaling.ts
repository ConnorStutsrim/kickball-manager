const NEUTRAL_RATING = 3;

/**
 * Converts a raw stat value onto the same 1-5 scale as qualitative ratings,
 * by percentile rank within a comparison set (typically the active roster)
 * rather than a fixed threshold — self-calibrating to whatever "good" means
 * in this specific league/season instead of a guessed cutoff. Falls back to
 * neutral when the comparison set has no spread (everyone tied, or too few
 * players to rank meaningfully).
 */
export function statToRating(value: number, allValues: number[]): number {
  if (allValues.length === 0) return NEUTRAL_RATING;

  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  if (min === max) return NEUTRAL_RATING;

  const countAtOrBelow = allValues.filter((v) => v <= value).length;
  const percentile = countAtOrBelow / allValues.length;

  if (percentile >= 0.8) return 5;
  if (percentile >= 0.6) return 4;
  if (percentile >= 0.4) return 3;
  if (percentile >= 0.2) return 2;
  return 1;
}

// Opportunities (plate appearances, times-reached-base, bunt attempts —
// whichever is relevant to the stat being blended) at which the derived
// stat fully replaces the qualitative prior.
export const BLEND_SAMPLE_SIZE_THRESHOLD = 20;

/**
 * Blends a qualitative (manually-entered) rating with a stat-derived rating,
 * weighted by how much evidence exists for the stat. With no evidence, the
 * qualitative rating wins outright; past the sample-size threshold, the
 * stat wins outright; in between, a linear blend of the two.
 */
export function blendRating(
  qualitativeRating: number | null,
  statRating: number | null,
  sampleSize: number,
): number {
  if (statRating === null) return qualitativeRating ?? NEUTRAL_RATING;

  const weight = Math.min(1, Math.max(0, sampleSize) / BLEND_SAMPLE_SIZE_THRESHOLD);
  const base = qualitativeRating ?? NEUTRAL_RATING;
  return base * (1 - weight) + statRating * weight;
}
