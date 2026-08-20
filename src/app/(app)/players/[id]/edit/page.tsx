import { notFound } from "next/navigation";
import { getPlayer } from "@/lib/data/players";
import { getPositions } from "@/lib/data/positions";
import { getPlayerPositionOverrides } from "@/lib/data/position-overrides";
import { updatePlayer } from "../../actions";
import { PlayerForm } from "../../player-form";
import { PositionOverridesForm } from "./position-overrides-form";

export default async function EditPlayerPage(
  props: PageProps<"/players/[id]/edit">,
) {
  const { id } = await props.params;
  const [player, positions, overrides] = await Promise.all([
    getPlayer(id),
    getPositions(),
    getPlayerPositionOverrides(id),
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
        <h2 className="text-lg font-semibold">Position overrides</h2>
        <p className="text-sm text-muted-foreground">
          Pin this player&apos;s fit at a specific position directly, bypassing
          the computed skill-axis formula for that position only. Leave blank
          to use the computed aptitude.
        </p>
      </div>
      <PositionOverridesForm playerId={id} positions={positions} overrides={overrides} />
    </div>
  );
}
