import { notFound } from "next/navigation";
import { getGame } from "@/lib/data/games";
import { getLeagueRules } from "@/lib/data/league-rules";
import { updateGame } from "../../actions";
import { GameForm } from "../../game-form";

export default async function EditGamePage(props: PageProps<"/games/[id]/edit">) {
  const { id } = await props.params;

  const [row, leagueRules] = await Promise.all([getGame(id), getLeagueRules()]);
  if (!row) notFound();
  const { game } = row;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Edit game</h1>
      <GameForm
        action={updateGame.bind(null, id)}
        game={game}
        defaultInnings={leagueRules?.inningsPerGame ?? 7}
        submitLabel="Save changes"
      />
    </div>
  );
}
