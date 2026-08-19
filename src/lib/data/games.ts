import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { games, seasons } from "@/db/schema";

export type Game = typeof games.$inferSelect;

export async function getGames() {
  return db
    .select({ game: games, season: seasons })
    .from(games)
    .innerJoin(seasons, eq(games.seasonId, seasons.id))
    .orderBy(desc(games.date));
}

export async function getGame(id: string) {
  const [row] = await db
    .select({ game: games, season: seasons })
    .from(games)
    .innerJoin(seasons, eq(games.seasonId, seasons.id))
    .where(eq(games.id, id))
    .limit(1);
  return row;
}
