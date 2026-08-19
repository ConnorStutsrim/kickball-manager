import type { BaserunningEventType, PlateAppearanceResult } from "@/db/schema";

export interface PlateAppearanceRecord {
  playerId: string;
  result: PlateAppearanceResult;
  rbi: number;
  isBunt: boolean;
}

export interface BaserunningEventRecord {
  playerId: string;
  eventType: BaserunningEventType;
}

export interface PlayerBattingStats {
  playerId: string;
  plateAppearances: number;
  totalBasesPerPA: number;
  rbiPerPA: number;
  timesReachedBase: number;
  /** Hit frequency on non-walk plate appearances — the Placement signal. */
  hitRateExcludingWalks: number;
  /** Advancement/scoring events per time reached base — the Baserunning signal. */
  advancementRate: number;
  buntAttempts: number;
  /** Bunt success rate — the Bunting signal. Null if no bunts attempted. */
  buntSuccessRate: number | null;
}

const TOTAL_BASES: Partial<Record<PlateAppearanceResult, number>> = {
  single: 1,
  double: 2,
  triple: 3,
  home_run: 4,
};

const REACHED_BASE_RESULTS = new Set<PlateAppearanceResult>([
  "single",
  "double",
  "triple",
  "home_run",
  "walk",
  "reached_on_error",
]);

const HIT_RESULTS = new Set<PlateAppearanceResult>(["single", "double", "triple", "home_run"]);

const ADVANCEMENT_EVENT_TYPES = new Set<BaserunningEventType>(["advanced", "scored"]);

/**
 * Computes per-player season batting stats from raw plate-appearance and
 * baserunning-event records. Each rate stat divides by its own relevant
 * opportunity count (not a single shared denominator), so a stat with a
 * small sample doesn't look artificially confident.
 */
export function computeBattingStats(
  playerIds: string[],
  plateAppearances: PlateAppearanceRecord[],
  baserunningEvents: BaserunningEventRecord[],
): PlayerBattingStats[] {
  return playerIds.map((playerId) => {
    const pas = plateAppearances.filter((pa) => pa.playerId === playerId);
    const events = baserunningEvents.filter((e) => e.playerId === playerId);

    const plateAppearanceCount = pas.length;
    const totalBases = pas.reduce((sum, pa) => sum + (TOTAL_BASES[pa.result] ?? 0), 0);
    const totalRbi = pas.reduce((sum, pa) => sum + pa.rbi, 0);
    const timesReachedBase = pas.filter((pa) => REACHED_BASE_RESULTS.has(pa.result)).length;

    const nonWalkPAs = pas.filter((pa) => pa.result !== "walk");
    const hits = nonWalkPAs.filter((pa) => HIT_RESULTS.has(pa.result)).length;

    const advancementEvents = events.filter((e) =>
      ADVANCEMENT_EVENT_TYPES.has(e.eventType),
    ).length;

    const buntAttempts = pas.filter((pa) => pa.isBunt).length;
    const buntSuccesses = pas.filter((pa) => pa.isBunt && pa.result !== "out").length;

    return {
      playerId,
      plateAppearances: plateAppearanceCount,
      totalBasesPerPA: plateAppearanceCount > 0 ? totalBases / plateAppearanceCount : 0,
      rbiPerPA: plateAppearanceCount > 0 ? totalRbi / plateAppearanceCount : 0,
      timesReachedBase,
      hitRateExcludingWalks: nonWalkPAs.length > 0 ? hits / nonWalkPAs.length : 0,
      advancementRate: timesReachedBase > 0 ? advancementEvents / timesReachedBase : 0,
      buntAttempts,
      buntSuccessRate: buntAttempts > 0 ? buntSuccesses / buntAttempts : null,
    };
  });
}
