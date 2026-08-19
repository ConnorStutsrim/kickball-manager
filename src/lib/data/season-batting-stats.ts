import { eq } from "drizzle-orm";
import { db } from "@/db";
import { baserunningEvents, games, plateAppearances } from "@/db/schema";
import type {
  BaserunningEventRecord,
  PlateAppearanceRecord,
} from "@/lib/stats/batting-stats";

export async function getSeasonPlateAppearances(
  seasonId: string,
): Promise<PlateAppearanceRecord[]> {
  return db
    .select({
      playerId: plateAppearances.playerId,
      result: plateAppearances.result,
      rbi: plateAppearances.rbi,
      isBunt: plateAppearances.isBunt,
    })
    .from(plateAppearances)
    .innerJoin(games, eq(plateAppearances.gameId, games.id))
    .where(eq(games.seasonId, seasonId));
}

export async function getSeasonBaserunningEvents(
  seasonId: string,
): Promise<BaserunningEventRecord[]> {
  return db
    .select({
      playerId: baserunningEvents.playerId,
      eventType: baserunningEvents.eventType,
    })
    .from(baserunningEvents)
    .innerJoin(games, eq(baserunningEvents.gameId, games.id))
    .where(eq(games.seasonId, seasonId));
}
