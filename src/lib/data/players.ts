import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { players } from "@/db/schema";

export type Player = typeof players.$inferSelect;

export async function getPlayers(): Promise<Player[]> {
  return db.query.players.findMany({
    orderBy: [asc(players.name)],
  });
}

export async function getPlayer(id: string): Promise<Player | undefined> {
  return db.query.players.findFirst({
    where: eq(players.id, id),
  });
}
