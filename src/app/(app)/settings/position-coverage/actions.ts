"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { positionShoreUpWeights } from "@/db/schema";
import { requireUser } from "@/lib/auth";

// A missing field (null) must fail validation, not silently coerce to 0 —
// z.coerce.number() would otherwise treat an absent form field the same as
// an explicit 0 and silently overwrite an existing non-zero weight.
const weightSchema = z.preprocess(
  (v) => (v === null ? undefined : v),
  z.coerce.number().int().min(0).max(10),
);

export type PositionCoverageFormState = { error?: string };

export async function updatePositionShoreUpWeights(
  _prevState: PositionCoverageFormState,
  formData: FormData,
): Promise<PositionCoverageFormState> {
  await requireUser();

  const existing = await db.query.positionShoreUpWeights.findMany();

  const updates = existing.map((row) => {
    const parsed = weightSchema.safeParse(
      formData.get(`weight-${row.helperPositionId}-${row.helpedPositionId}`),
    );
    return { id: row.id, parsed };
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
        .update(positionShoreUpWeights)
        .set({ weight: parsed.data })
        .where(eq(positionShoreUpWeights.id, id));
    }
  });

  revalidatePath("/settings/position-coverage");
  return {};
}
