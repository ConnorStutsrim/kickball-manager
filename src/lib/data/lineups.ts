import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { battingOrderEntries, fieldingAssignments, lineups, players } from "@/db/schema";

export interface GameLineupData {
  lineupId: string;
  battingOrder: { playerId: string; playerName: string; battingPosition: number }[];
  fielding: { inning: number; position: string; playerId: string; playerName: string }[];
}

export async function getGameLineup(gameId: string): Promise<GameLineupData | undefined> {
  const lineup = await db.query.lineups.findFirst({
    where: eq(lineups.gameId, gameId),
    orderBy: [asc(lineups.createdAt)],
  });
  if (!lineup) return undefined;

  const [battingOrder, fielding] = await Promise.all([
    db
      .select({
        playerId: battingOrderEntries.playerId,
        playerName: players.name,
        battingPosition: battingOrderEntries.battingPosition,
      })
      .from(battingOrderEntries)
      .innerJoin(players, eq(battingOrderEntries.playerId, players.id))
      .where(eq(battingOrderEntries.lineupId, lineup.id))
      .orderBy(asc(battingOrderEntries.battingPosition)),
    db
      .select({
        inning: fieldingAssignments.inning,
        position: fieldingAssignments.position,
        playerId: fieldingAssignments.playerId,
        playerName: players.name,
      })
      .from(fieldingAssignments)
      .innerJoin(players, eq(fieldingAssignments.playerId, players.id))
      .where(eq(fieldingAssignments.lineupId, lineup.id))
      .orderBy(asc(fieldingAssignments.inning)),
  ]);

  return { lineupId: lineup.id, battingOrder, fielding };
}
