import { db } from "@/db";
import { battingSlotArchetypes } from "@/db/schema";

export type BattingSlotArchetype = typeof battingSlotArchetypes.$inferSelect;

// Display order matching the slot cycle (see src/lib/lineup/batting-order.ts),
// not the order rows happen to come back from the database.
const DISPLAY_ORDER = ["Leadoff", "Connector", "Cleanup", "Balanced"];

export async function getBattingSlotArchetypes(): Promise<BattingSlotArchetype[]> {
  const rows = await db.query.battingSlotArchetypes.findMany();
  return rows.sort(
    (a, b) => DISPLAY_ORDER.indexOf(a.name) - DISPLAY_ORDER.indexOf(b.name),
  );
}
