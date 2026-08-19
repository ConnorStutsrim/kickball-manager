"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { positions } from "@/db/schema";
import { requireUser } from "@/lib/auth";

const weightSchema = z.coerce.number().int().min(0).max(5);

export type PositionsFormState = { error?: string };

export async function updatePositions(
  _prevState: PositionsFormState,
  formData: FormData,
): Promise<PositionsFormState> {
  await requireUser();

  const existing = await db.query.positions.findMany();

  const updates = existing.map((position) => {
    const parsed = z
      .object({
        importance: weightSchema,
        weightSpeed: weightSchema,
        weightCatching: weightSchema,
        weightThrowing: weightSchema,
        weightGameSense: weightSchema,
      })
      .safeParse({
        importance: formData.get(`importance-${position.id}`),
        weightSpeed: formData.get(`weightSpeed-${position.id}`),
        weightCatching: formData.get(`weightCatching-${position.id}`),
        weightThrowing: formData.get(`weightThrowing-${position.id}`),
        weightGameSense: formData.get(`weightGameSense-${position.id}`),
      });
    return { id: position.id, parsed };
  });

  const failed = updates.find((u) => !u.parsed.success);
  if (failed && !failed.parsed.success) {
    return {
      error: failed.parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  await db.transaction(async (tx) => {
    for (const { id, parsed } of updates) {
      if (!parsed.success) continue;
      await tx.update(positions).set(parsed.data).where(eq(positions.id, id));
    }
  });

  revalidatePath("/settings/positions");
  return {};
}
