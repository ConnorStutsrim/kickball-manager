"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { battingSlotArchetypes } from "@/db/schema";
import { requireUser } from "@/lib/auth";

const weightSchema = z.coerce.number().int().min(0).max(5);

export type BattingSlotsFormState = { error?: string };

export async function updateBattingSlotArchetypes(
  _prevState: BattingSlotsFormState,
  formData: FormData,
): Promise<BattingSlotsFormState> {
  await requireUser();

  const existing = await db.query.battingSlotArchetypes.findMany();

  const updates = existing.map((archetype) => {
    const parsed = z
      .object({
        weightPower: weightSchema,
        weightPlacement: weightSchema,
        weightBunting: weightSchema,
        weightBaserunning: weightSchema,
      })
      .safeParse({
        weightPower: formData.get(`weightPower-${archetype.id}`),
        weightPlacement: formData.get(`weightPlacement-${archetype.id}`),
        weightBunting: formData.get(`weightBunting-${archetype.id}`),
        weightBaserunning: formData.get(`weightBaserunning-${archetype.id}`),
      });
    return { id: archetype.id, parsed };
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
      await tx
        .update(battingSlotArchetypes)
        .set(parsed.data)
        .where(eq(battingSlotArchetypes.id, id));
    }
  });

  revalidatePath("/settings/batting-slots");
  return {};
}
