"use server";

import { redirect } from "next/navigation";
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

export type NewGameFormState = { error?: string };

export async function createGame(
  _prevState: NewGameFormState,
  formData: FormData,
): Promise<NewGameFormState> {
  await requireUser();

  const parsed = gameSchema.safeParse({
    date: formData.get("date"),
    opponent: formData.get("opponent") || undefined,
    location: formData.get("location") || undefined,
    inningsPlanned: formData.get("inningsPlanned"),
  });
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
