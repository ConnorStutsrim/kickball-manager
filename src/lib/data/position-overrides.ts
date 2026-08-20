import { eq } from "drizzle-orm";
import { db } from "@/db";
import { playerPositionOverrides } from "@/db/schema";

export type PlayerPositionOverride = typeof playerPositionOverrides.$inferSelect;

export async function getPlayerPositionOverrides(
  playerId: string,
): Promise<PlayerPositionOverride[]> {
  return db.query.playerPositionOverrides.findMany({
    where: eq(playerPositionOverrides.playerId, playerId),
  });
}

export async function getAllPlayerPositionOverrides(): Promise<PlayerPositionOverride[]> {
  return db.query.playerPositionOverrides.findMany();
}
