import { RESULT_LABELS } from "./constants";
import type { GameLogPlateAppearance } from "@/lib/data/game-log";

export function PlayLog({ plateAppearances }: { plateAppearances: GameLogPlateAppearance[] }) {
  const recent = [...plateAppearances].reverse().slice(0, 10);

  return (
    <div>
      <p className="mb-2 text-sm font-medium">Recent plays</p>
      {plateAppearances.length === 0 ? (
        <p className="text-sm text-muted-foreground">No plays logged yet.</p>
      ) : (
        <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
          {recent.map((pa) => (
            <li key={pa.id}>
              Inning {pa.inning}: {pa.playerName} — {RESULT_LABELS[pa.result]}
              {pa.rbi ? ` (${pa.rbi} RBI)` : ""}
              {pa.runsScored ? " · scored" : ""}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
