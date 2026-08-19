"use server";

import { revalidatePath } from "next/cache";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  baserunningEvents,
  baserunningEventTypeEnum,
  defensiveNoteTagEnum,
  defensiveNotes,
  opponentInningRuns,
  plateAppearanceResultEnum,
  plateAppearances,
} from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { getGameLog } from "@/lib/data/game-log";

export type LiveActionState = { error?: string };

const plateAppearanceSchema = z.object({
  result: z.enum(plateAppearanceResultEnum),
  rbi: z.coerce.number().int().min(0).max(10).default(0),
  isBunt: z.coerce.boolean().default(false),
});

export async function recordPlateAppearance(
  gameId: string,
  _prevState: LiveActionState,
  formData: FormData,
): Promise<LiveActionState> {
  await requireUser();

  const parsed = plateAppearanceSchema.safeParse({
    result: formData.get("result"),
    rbi: formData.get("rbi") || 0,
    isBunt: formData.get("isBunt"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const log = await getGameLog(gameId);
  if (!log) return { error: "Game not found." };
  if (log.state.half !== "us") {
    return { error: "It's not your team's turn to bat right now." };
  }
  if (!log.state.nextBatter) {
    return { error: "No batting order set — generate a lineup first." };
  }

  await db.insert(plateAppearances).values({
    gameId,
    playerId: log.state.nextBatter.playerId,
    inning: log.state.currentInning,
    battingPosition: log.state.nextBatter.battingPosition,
    result: parsed.data.result,
    rbi: parsed.data.rbi,
    runsScored: parsed.data.result === "home_run",
    isBunt: parsed.data.isBunt,
  });

  revalidatePath(`/games/${gameId}/live`);
  return {};
}

export async function deleteLastPlateAppearance(gameId: string) {
  await requireUser();

  const last = await db.query.plateAppearances.findFirst({
    where: eq(plateAppearances.gameId, gameId),
    orderBy: [desc(plateAppearances.createdAt)],
  });
  if (!last) return;

  await db.delete(plateAppearances).where(eq(plateAppearances.id, last.id));
  revalidatePath(`/games/${gameId}/live`);
}

const opponentRunsSchema = z.object({
  inning: z.coerce.number().int().min(1),
  runs: z.coerce.number().int().min(0).max(50),
});

export async function recordOpponentRuns(
  gameId: string,
  _prevState: LiveActionState,
  formData: FormData,
): Promise<LiveActionState> {
  await requireUser();

  const parsed = opponentRunsSchema.safeParse({
    inning: formData.get("inning"),
    runs: formData.get("runs"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  await db
    .insert(opponentInningRuns)
    .values({ gameId, inning: parsed.data.inning, runs: parsed.data.runs })
    .onConflictDoUpdate({
      target: [opponentInningRuns.gameId, opponentInningRuns.inning],
      set: { runs: parsed.data.runs },
    });

  revalidatePath(`/games/${gameId}/live`);
  return {};
}

const baserunningEventSchema = z.object({
  playerId: z.uuid(),
  inning: z.coerce.number().int().min(1),
  eventType: z.enum(baserunningEventTypeEnum),
  notes: z.string().trim().max(500).optional(),
});

export async function recordBaserunningEvent(
  gameId: string,
  _prevState: LiveActionState,
  formData: FormData,
): Promise<LiveActionState> {
  await requireUser();

  const parsed = baserunningEventSchema.safeParse({
    playerId: formData.get("playerId"),
    inning: formData.get("inning"),
    eventType: formData.get("eventType"),
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  await db.insert(baserunningEvents).values({ gameId, ...parsed.data });
  revalidatePath(`/games/${gameId}/live`);
  return {};
}

const defensiveNoteSchema = z.object({
  playerId: z.uuid(),
  inning: z.coerce.number().int().min(1),
  position: z.string().trim().min(1).max(50),
  note: z.string().trim().min(1).max(500),
  tag: z.enum(defensiveNoteTagEnum).optional(),
});

export async function recordDefensiveNote(
  gameId: string,
  _prevState: LiveActionState,
  formData: FormData,
): Promise<LiveActionState> {
  await requireUser();

  const parsed = defensiveNoteSchema.safeParse({
    playerId: formData.get("playerId"),
    inning: formData.get("inning"),
    position: formData.get("position"),
    note: formData.get("note"),
    tag: formData.get("tag") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  await db.insert(defensiveNotes).values({ gameId, ...parsed.data });
  revalidatePath(`/games/${gameId}/live`);
  return {};
}
