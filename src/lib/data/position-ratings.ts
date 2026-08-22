import { eq } from "drizzle-orm";
import { db } from "@/db";
import { playerPositionRatings } from "@/db/schema";

export type PlayerPositionRating = typeof playerPositionRatings.$inferSelect;

export async function getPlayerPositionRatings(
  playerId: string,
): Promise<PlayerPositionRating[]> {
  return db.query.playerPositionRatings.findMany({
    where: eq(playerPositionRatings.playerId, playerId),
  });
}

export async function getAllPlayerPositionRatings(): Promise<PlayerPositionRating[]> {
  return db.query.playerPositionRatings.findMany();
}
