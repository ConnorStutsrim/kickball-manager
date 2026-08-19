import { getBattingSlotArchetypes } from "@/lib/data/batting-slot-archetypes";
import { BattingSlotsForm } from "./batting-slots-form";

export default async function BattingSlotsPage() {
  const archetypes = await getBattingSlotArchetypes();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Batting slots</h1>
        <p className="text-sm text-muted-foreground">
          Batting slot 1 is Leadoff, 2 is Table Setter, 3 is Balanced, 4 is
          Cleanup, 5 is RBI, and every slot after that reuses Balanced. For
          each archetype: how much each batting skill axis (from a
          player&apos;s ratings) predicts fit for that slot. The lineup
          generator uses these to build the batting order.
        </p>
      </div>
      {archetypes.length === 0 ? (
        <p className="text-muted-foreground">
          No batting slot archetypes configured yet.
        </p>
      ) : (
        <BattingSlotsForm archetypes={archetypes} />
      )}
    </div>
  );
}
