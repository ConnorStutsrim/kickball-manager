import { getPositions } from "@/lib/data/positions";
import { PositionsForm } from "./positions-form";

export default async function PositionsPage() {
  const positions = await getPositions();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Positions</h1>
        <p className="text-sm text-muted-foreground">
          For each position: how important it is relative to the others, and
          how much each skill axis (from a player&apos;s ratings) predicts
          success there. The lineup generator uses these to find each
          player&apos;s best-fit position.
        </p>
      </div>
      {positions.length === 0 ? (
        <p className="text-muted-foreground">
          No positions configured yet — seed the roster of fielding positions
          first.
        </p>
      ) : (
        <PositionsForm positions={positions} />
      )}
    </div>
  );
}
