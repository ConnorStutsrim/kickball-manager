import { getLeagueRules } from "@/lib/data/league-rules";
import { NewGameForm } from "./new-game-form";

export default async function NewGamePage() {
  const leagueRules = await getLeagueRules();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">New game</h1>
      <NewGameForm defaultInnings={leagueRules?.inningsPerGame ?? 7} />
    </div>
  );
}
