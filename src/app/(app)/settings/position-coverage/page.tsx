import { getPositions } from "@/lib/data/positions";
import { getPositionShoreUpWeights } from "@/lib/data/position-shore-up-weights";
import { PositionCoverageForm } from "./position-coverage-form";

export default async function PositionCoveragePage() {
  const [positions, shoreUpWeights] = await Promise.all([
    getPositions(),
    getPositionShoreUpWeights(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Position coverage</h1>
        <p className="text-sm text-muted-foreground">
          How much a strong fielder at one position (the row) can compensate
          for a weaker fielder at another (the column) when optimizing
          assignments. If the row position&apos;s fielder rates higher than
          the column position&apos;s fielder that inning, some of that gap
          becomes a bonus, scaled by this weight — 0 means no coverage
          relationship. Directional: the reverse pairing is a separate value.
        </p>
      </div>
      {positions.length === 0 ? (
        <p className="text-muted-foreground">
          No positions configured yet — seed the roster of fielding positions
          first.
        </p>
      ) : (
        <PositionCoverageForm positions={positions} shoreUpWeights={shoreUpWeights} />
      )}
    </div>
  );
}
