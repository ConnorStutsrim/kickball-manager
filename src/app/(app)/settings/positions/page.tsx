import { getPositions } from "@/lib/data/positions";
import { PositionsForm } from "./positions-form";

export default async function PositionsPage() {
  const positions = await getPositions();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Positions</h1>
        <p className="text-sm text-muted-foreground">
          How important each position is relative to the others when
          optimizing assignments. Each player&apos;s actual fit at a
          position is rated directly, per player — see a player&apos;s edit
          page.
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
