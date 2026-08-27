"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { games } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { getOrCreateSeasonForYear } from "@/lib/data/seasons";

const gameSchema = z.object({
  date: z.iso.date(),
  opponent: z.string().trim().max(200).optional(),
  location: z.string().trim().max(200).optional(),
  inningsPlanned: z.coerce.number().int().min(1).max(20),
});

export type GameFormState = { error?: string };

function parseGameForm(formData: FormData) {
  return gameSchema.safeParse({
    date: formData.get("date"),
    opponent: formData.get("opponent") || undefined,
    location: formData.get("location") || undefined,
    inningsPlanned: formData.get("inningsPlanned"),
  });
}

export async function createGame(
  _prevState: GameFormState,
  formData: FormData,
): Promise<GameFormState> {
  await requireUser();

  const parsed = parseGameForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const year = new Date(parsed.data.date).getUTCFullYear();
  const season = await getOrCreateSeasonForYear(year);

  const [game] = await db
    .insert(games)
    .values({
      seasonId: season.id,
      date: parsed.data.date,
      opponent: parsed.data.opponent,
      location: parsed.data.location,
      inningsPlanned: parsed.data.inningsPlanned,
    })
    .returning();

  redirect(`/games/${game.id}`);
}

export async function updateGame(
  gameId: string,
  _prevState: GameFormState,
  formData: FormData,
): Promise<GameFormState> {
  await requireUser();

  const parsed = parseGameForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  // Re-derive the season from the (possibly edited) date, same as creation —
  // an edit that moves a game across a year boundary should move with it.
  const year = new Date(parsed.data.date).getUTCFullYear();
  const season = await getOrCreateSeasonForYear(year);

  await db
    .update(games)
    .set({
      seasonId: season.id,
      date: parsed.data.date,
      opponent: parsed.data.opponent,
      location: parsed.data.location,
      inningsPlanned: parsed.data.inningsPlanned,
    })
    .where(eq(games.id, gameId));

  revalidatePath("/games");
  revalidatePath(`/games/${gameId}`);
  redirect(`/games/${gameId}`);
}
