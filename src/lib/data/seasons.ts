import { eq } from "drizzle-orm";
import { db } from "@/db";
import { seasons } from "@/db/schema";

export type Season = typeof seasons.$inferSelect;

export async function getOrCreateSeasonForYear(year: number): Promise<Season> {
  const existing = await db.query.seasons.findFirst({
    where: eq(seasons.year, year),
  });
  if (existing) return existing;

  const [created] = await db
    .insert(seasons)
    .values({ year, name: `${year} Season` })
    .returning();
  return created;
}
