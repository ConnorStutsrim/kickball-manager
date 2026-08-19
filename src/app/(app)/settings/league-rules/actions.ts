"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { leagueRules } from "@/db/schema";
import { requireUser } from "@/lib/auth";

const leagueRulesSchema = z.object({
  minMen: z.coerce.number().int().min(0),
  minWomen: z.coerce.number().int().min(0),
  inningsPerGame: z.coerce.number().int().min(1).max(20),
});

export type LeagueRulesFormState = { error?: string };

export async function upsertLeagueRules(
  _prevState: LeagueRulesFormState,
  formData: FormData,
): Promise<LeagueRulesFormState> {
  await requireUser();

  const parsed = leagueRulesSchema.safeParse({
    minMen: formData.get("minMen"),
    minWomen: formData.get("minWomen"),
    inningsPerGame: formData.get("inningsPerGame"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { minMen, minWomen, inningsPerGame } = parsed.data;
  const genderMinimums = [
    { gender: "M" as const, min: minMen },
    { gender: "F" as const, min: minWomen },
  ];

  const existing = await db.query.leagueRules.findFirst();
  if (existing) {
    await db
      .update(leagueRules)
      .set({ genderMinimums, inningsPerGame, updatedAt: new Date() })
      .where(eq(leagueRules.id, existing.id));
  } else {
    await db.insert(leagueRules).values({ genderMinimums, inningsPerGame });
  }

  revalidatePath("/settings/league-rules");
  return {};
}
