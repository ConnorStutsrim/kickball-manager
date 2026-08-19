import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  baserunningEvents,
  defensiveNotes,
  games,
  opponentInningRuns,
  plateAppearances,
  players,
  type BaserunningEventType,
  type DefensiveNoteTag,
  type PlateAppearanceResult,
} from "@/db/schema";
import { computeGameState, type GameStateResult } from "@/lib/game/game-state";
import { getGameLineup } from "./lineups";

export interface GameLogPlateAppearance {
  id: string;
  createdAt: Date;
  inning: number;
  playerId: string;
  playerName: string;
  battingPosition: number;
  result: PlateAppearanceResult;
  rbi: number;
  runsScored: boolean;
}

export interface GameLogBaserunningEvent {
  id: string;
  inning: number;
  playerId: string;
  playerName: string;
  eventType: BaserunningEventType;
  notes: string | null;
}

export interface GameLogDefensiveNote {
  id: string;
  inning: number;
  playerId: string;
  playerName: string;
  position: string;
  note: string;
  tag: DefensiveNoteTag | null;
}

export interface GameLog {
  lineupId: string | undefined;
  battingOrder: { playerId: string; playerName: string; battingPosition: number }[];
  plateAppearances: GameLogPlateAppearance[];
  baserunningEvents: GameLogBaserunningEvent[];
  defensiveNotes: GameLogDefensiveNote[];
  opponentInningRuns: { inning: number; runs: number }[];
  state: GameStateResult;
}

export async function getGameLog(gameId: string): Promise<GameLog | undefined> {
  const game = await db.query.games.findFirst({ where: eq(games.id, gameId) });
  if (!game) return undefined;

  const lineup = await getGameLineup(gameId);

  const [pas, baserunning, defNotes, oppRuns] = await Promise.all([
    db
      .select({
        id: plateAppearances.id,
        createdAt: plateAppearances.createdAt,
        inning: plateAppearances.inning,
        playerId: plateAppearances.playerId,
        playerName: players.name,
        battingPosition: plateAppearances.battingPosition,
        result: plateAppearances.result,
        rbi: plateAppearances.rbi,
        runsScored: plateAppearances.runsScored,
      })
      .from(plateAppearances)
      .innerJoin(players, eq(plateAppearances.playerId, players.id))
      .where(eq(plateAppearances.gameId, gameId))
      .orderBy(asc(plateAppearances.inning), asc(plateAppearances.createdAt)),
    db
      .select({
        id: baserunningEvents.id,
        inning: baserunningEvents.inning,
        playerId: baserunningEvents.playerId,
        playerName: players.name,
        eventType: baserunningEvents.eventType,
        notes: baserunningEvents.notes,
      })
      .from(baserunningEvents)
      .innerJoin(players, eq(baserunningEvents.playerId, players.id))
      .where(eq(baserunningEvents.gameId, gameId))
      .orderBy(asc(baserunningEvents.inning)),
    db
      .select({
        id: defensiveNotes.id,
        inning: defensiveNotes.inning,
        playerId: defensiveNotes.playerId,
        playerName: players.name,
        position: defensiveNotes.position,
        note: defensiveNotes.note,
        tag: defensiveNotes.tag,
      })
      .from(defensiveNotes)
      .innerJoin(players, eq(defensiveNotes.playerId, players.id))
      .where(eq(defensiveNotes.gameId, gameId))
      .orderBy(asc(defensiveNotes.inning)),
    db
      .select({ inning: opponentInningRuns.inning, runs: opponentInningRuns.runs })
      .from(opponentInningRuns)
      .where(eq(opponentInningRuns.gameId, gameId))
      .orderBy(asc(opponentInningRuns.inning)),
  ]);

  const state = computeGameState({
    battingOrder: (lineup?.battingOrder ?? []).map((b) => ({
      playerId: b.playerId,
      battingPosition: b.battingPosition,
    })),
    plateAppearances: pas.map((pa) => ({
      inning: pa.inning,
      playerId: pa.playerId,
      result: pa.result,
      runsScored: pa.runsScored,
    })),
    baserunningEvents: baserunning.map((b) => ({ inning: b.inning, eventType: b.eventType })),
    opponentInningRuns: oppRuns,
    inningsPlanned: game.inningsPlanned,
  });

  return {
    lineupId: lineup?.lineupId,
    battingOrder: lineup?.battingOrder ?? [],
    plateAppearances: pas,
    baserunningEvents: baserunning,
    defensiveNotes: defNotes,
    opponentInningRuns: oppRuns,
    state,
  };
}
