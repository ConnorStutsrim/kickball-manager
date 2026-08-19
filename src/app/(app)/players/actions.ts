"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { players, genderEnum } from "@/db/schema";
import { requireUser } from "@/lib/auth";

const ratingSchema = z
  .preprocess(
    (val) => (val === "" ? undefined : val),
    z.coerce.number().int().min(1).max(5).optional(),
  );

const playerSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  gender: z.enum(genderEnum),
  ratingContact: ratingSchema,
  ratingPower: ratingSchema,
  ratingSpeed: ratingSchema,
  ratingPlateDiscipline: ratingSchema,
  ratingFielding: ratingSchema,
});

export type PlayerFormState = { error?: string };

function parsePlayerForm(formData: FormData) {
  return playerSchema.safeParse({
    name: formData.get("name"),
    gender: formData.get("gender"),
    ratingContact: formData.get("ratingContact"),
    ratingPower: formData.get("ratingPower"),
    ratingSpeed: formData.get("ratingSpeed"),
    ratingPlateDiscipline: formData.get("ratingPlateDiscipline"),
    ratingFielding: formData.get("ratingFielding"),
  });
}

export async function createPlayer(
  _prevState: PlayerFormState,
  formData: FormData,
): Promise<PlayerFormState> {
  await requireUser();

  const parsed = parsePlayerForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  await db.insert(players).values(parsed.data);
  revalidatePath("/players");
  return {};
}

export async function updatePlayer(
  playerId: string,
  _prevState: PlayerFormState,
  formData: FormData,
): Promise<PlayerFormState> {
  await requireUser();

  const parsed = parsePlayerForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  await db.update(players).set(parsed.data).where(eq(players.id, playerId));
  revalidatePath("/players");
  return {};
}

export async function setPlayerActive(playerId: string, active: boolean) {
  await requireUser();
  await db.update(players).set({ active }).where(eq(players.id, playerId));
  revalidatePath("/players");
}

export async function deletePlayer(playerId: string) {
  await requireUser();
  await db.delete(players).where(eq(players.id, playerId));
  revalidatePath("/players");
}
