import { getLeagueRules } from "@/lib/data/league-rules";
import { LeagueRulesForm } from "./league-rules-form";

export default async function LeagueRulesPage() {
  const leagueRules = await getLeagueRules();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">League rules</h1>
        <p className="text-sm text-muted-foreground">
          Drives lineup generation: the fielding positions to fill each
          inning and the minimum number of each gender that must be fielding
          at once.
        </p>
      </div>
      <LeagueRulesForm leagueRules={leagueRules} />
    </div>
  );
}
