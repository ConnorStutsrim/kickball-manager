import { notFound } from "next/navigation";
import { getPlayer } from "@/lib/data/players";
import { getPositions } from "@/lib/data/positions";
import { getPlayerPositionRatings } from "@/lib/data/position-ratings";
import { updatePlayer } from "../../actions";
import { PlayerForm } from "../../player-form";
import { PositionRatingsForm } from "./position-ratings-form";

export default async function EditPlayerPage(
  props: PageProps<"/players/[id]/edit">,
) {
  const { id } = await props.params;
  const [player, positions, ratings] = await Promise.all([
    getPlayer(id),
    getPositions(),
    getPlayerPositionRatings(id),
  ]);

  if (!player) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Edit {player.name}</h1>
      <PlayerForm
        action={updatePlayer.bind(null, id)}
        player={player}
        submitLabel="Save changes"
      />

      <div>
        <h2 className="text-lg font-semibold">Position ratings</h2>
        <p className="text-sm text-muted-foreground">
          Rate this player&apos;s fit at each fielding position directly
          (1-10). Leave blank to default to average (5).
        </p>
      </div>
      <PositionRatingsForm playerId={id} positions={positions} ratings={ratings} />
    </div>
  );
}
