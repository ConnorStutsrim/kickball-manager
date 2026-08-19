import { db } from "@/db";
import { leagueRules } from "@/db/schema";

export type LeagueRules = typeof leagueRules.$inferSelect;

export async function getLeagueRules(): Promise<LeagueRules | undefined> {
  return db.query.leagueRules.findFirst();
}
