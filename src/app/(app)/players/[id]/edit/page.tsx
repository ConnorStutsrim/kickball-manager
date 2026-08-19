import { notFound } from "next/navigation";
import { getPlayer } from "@/lib/data/players";
import { updatePlayer } from "../../actions";
import { PlayerForm } from "../../player-form";

export default async function EditPlayerPage(
  props: PageProps<"/players/[id]/edit">,
) {
  const { id } = await props.params;
  const player = await getPlayer(id);

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
    </div>
  );
}
