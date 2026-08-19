import Link from "next/link";
import { notFound } from "next/navigation";
import { getGame } from "@/lib/data/games";
import { getGameLog } from "@/lib/data/game-log";
import { getPositions } from "@/lib/data/positions";
import { Scoreboard } from "./scoreboard";
import { AtBatPanel } from "./at-bat-panel";
import { OpponentHalfPanel } from "./opponent-half-panel";
import { BaserunningForm } from "./baserunning-form";
import { DefensiveNoteForm } from "./defensive-note-form";
import { PlayLog } from "./play-log";

export default async function LiveGamePage(props: PageProps<"/games/[id]/live">) {
  const { id } = await props.params;

  const [row, log, positions] = await Promise.all([
    getGame(id),
    getGameLog(id),
    getPositions(),
  ]);

  if (!row) notFound();
  const { game, season } = row;

  if (!log || !log.lineupId) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold">Live tracking</h1>
        <p className="text-sm text-muted-foreground">
          Generate a lineup on the{" "}
          <Link href={`/games/${id}`} className="underline">
            game page
          </Link>{" "}
          before starting live tracking.
        </p>
      </div>
    );
  }

  const roster = log.battingOrder.map((b) => ({ id: b.playerId, name: b.playerName }));
  const { state } = log;
  const currentBatterName =
    roster.find((r) => r.id === state.nextBatter?.playerId)?.name ?? "";

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold">
          {game.opponent ? `vs ${game.opponent}` : "Game"} — Live
        </h1>
        <p className="text-sm text-muted-foreground">
          {game.date} · {season.name}
        </p>
      </div>

      <Scoreboard
        inningsPlanned={game.inningsPlanned}
        ourRunsByInning={state.ourRunsByInning}
        theirRunsByInning={state.theirRunsByInning}
        ourTotal={state.ourTotalRuns}
        theirTotal={state.theirTotalRuns}
        opponentName={game.opponent}
      />

      {state.half === "us" && state.nextBatter && (
        <AtBatPanel
          gameId={id}
          batterName={currentBatterName}
          battingPosition={state.nextBatter.battingPosition}
          outs={state.outsThisHalf}
          canDeleteLast={log.plateAppearances.length > 0}
        />
      )}
      {state.half === "them" && (
        <OpponentHalfPanel gameId={id} inning={state.currentInning} />
      )}
      {state.half === "game_over" && (
        <div className="rounded-md border p-4">
          <p className="text-lg font-semibold">
            Final: Us {state.ourTotalRuns} — {game.opponent ?? "Them"} {state.theirTotalRuns}
          </p>
        </div>
      )}

      <BaserunningForm gameId={id} currentInning={state.currentInning} roster={roster} />
      <DefensiveNoteForm
        gameId={id}
        currentInning={state.currentInning}
        roster={roster}
        positions={positions.map((p) => p.name)}
      />

      <PlayLog plateAppearances={log.plateAppearances} />
    </div>
  );
}
