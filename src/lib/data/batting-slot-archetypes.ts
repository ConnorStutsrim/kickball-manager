import { db } from "@/db";
import { battingSlotArchetypes } from "@/db/schema";

export type BattingSlotArchetype = typeof battingSlotArchetypes.$inferSelect;

export async function getBattingSlotArchetypes(): Promise<BattingSlotArchetype[]> {
  return db.query.battingSlotArchetypes.findMany();
}
