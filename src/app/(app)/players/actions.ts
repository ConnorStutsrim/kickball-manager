"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { players, playerPositionRatings, genderEnum } from "@/db/schema";
import { requireUser } from "@/lib/auth";

const ratingSchema = z
  .preprocess(
    (val) => (val === "" ? undefined : val),
    z.coerce.number().int().min(1).max(10).optional(),
  );

const playerSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  gender: z.enum(genderEnum),
  ratingPower: ratingSchema,
  ratingPlacement: ratingSchema,
  ratingBunting: ratingSchema,
  ratingBaserunning: ratingSchema,
});

export type PlayerFormState = { error?: string };

function parsePlayerForm(formData: FormData) {
  return playerSchema.safeParse({
    name: formData.get("name"),
    gender: formData.get("gender"),
    ratingPower: formData.get("ratingPower"),
    ratingPlacement: formData.get("ratingPlacement"),
    ratingBunting: formData.get("ratingBunting"),
    ratingBaserunning: formData.get("ratingBaserunning"),
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

export type PositionRatingsFormState = { error?: string };

export async function updatePlayerPositionRatings(
  playerId: string,
  _prevState: PositionRatingsFormState,
  formData: FormData,
): Promise<PositionRatingsFormState> {
  await requireUser();

  const allPositions = await db.query.positions.findMany();

  const rows = allPositions.map((position) => ({
    positionId: position.id,
    parsed: ratingSchema.safeParse(formData.get(`rating-${position.id}`)),
  }));

  const failed = rows.find((r) => !r.parsed.success);
  if (failed && !failed.parsed.success) {
    return { error: failed.parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  await db.transaction(async (tx) => {
    for (const { positionId, parsed } of rows) {
      if (!parsed.success) continue;
      if (parsed.data === undefined) {
        await tx
          .delete(playerPositionRatings)
          .where(
            and(
              eq(playerPositionRatings.playerId, playerId),
              eq(playerPositionRatings.positionId, positionId),
            ),
          );
      } else {
        await tx
          .insert(playerPositionRatings)
          .values({ playerId, positionId, rating: parsed.data })
          .onConflictDoUpdate({
            target: [playerPositionRatings.playerId, playerPositionRatings.positionId],
            set: { rating: parsed.data },
          });
      }
    }
  });

  revalidatePath(`/players/${playerId}/edit`);
  return {};
}
