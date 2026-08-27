import Link from "next/link";
import { notFound } from "next/navigation";
import { getGame } from "@/lib/data/games";
import { getGameLineup } from "@/lib/data/lineups";
import { getLeagueRules } from "@/lib/data/league-rules";
import { getPositions } from "@/lib/data/positions";
import { getPlayers } from "@/lib/data/players";
import { Button } from "@/components/ui/button";
import { GenerateLineupForm } from "./generate-lineup-form";
import { BattingOrderList } from "./batting-order-list";
import { FieldingGrid } from "./fielding-grid";
import { GenerateSheetButton } from "./generate-sheet-button";
import { DeleteGameButton } from "./delete-game-button";

export default async function GamePage(props: PageProps<"/games/[id]">) {
  const { id } = await props.params;

  const [row, leagueRules, positions, players] = await Promise.all([
    getGame(id),
    getLeagueRules(),
    getPositions(),
    getPlayers(),
  ]);

  if (!row) notFound();
  const { game, season } = row;

  const lineup = await getGameLineup(id);
  const activePlayers = players.filter((p) => p.active);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">
            {game.opponent ? `vs ${game.opponent}` : "Game"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {game.date} · {season.name}
            {game.location ? ` · ${game.location}` : ""} · {game.inningsPlanned} innings
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" render={<Link href={`/games/${id}/edit`} />}>
            Edit game
          </Button>
          <DeleteGameButton gameId={id} />
        </div>
      </div>

      {!leagueRules ? (
        <p className="text-sm text-destructive">
          Set up{" "}
          <a href="/settings/league-rules" className="underline">
            league rules
          </a>{" "}
          before generating a lineup.
        </p>
      ) : (
        <GenerateLineupForm
          gameId={id}
          activePlayers={activePlayers}
          hasLineup={!!lineup}
        />
      )}

      {lineup && (
        <div className="flex flex-wrap items-center gap-4">
          <GenerateSheetButton gameId={id} initialUrl={game.sheetUrl} />
        </div>
      )}

      {lineup && (
        <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
          <div className="lg:shrink-0">
            <h2 className="mb-3 text-lg font-semibold">Batting order</h2>
            <BattingOrderList
              gameId={id}
              lineupId={lineup.lineupId}
              battingOrder={lineup.battingOrder}
            />
          </div>
          <div className="lg:min-w-0 lg:flex-1">
            <h2 className="mb-3 text-lg font-semibold">Fielding</h2>
            <FieldingGrid
              gameId={id}
              lineupId={lineup.lineupId}
              positions={positions.map((p) => p.name)}
              innings={game.inningsPlanned}
              fielding={lineup.fielding}
              roster={lineup.battingOrder.map((b) => ({
                id: b.playerId,
                name: b.playerName,
              }))}
            />
          </div>
        </div>
      )}
    </div>
  );
}
