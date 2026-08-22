"use client";

import { useActionState } from "react";
import { upsertLeagueRules, type LeagueRulesFormState } from "./actions";
import { useActionToast } from "@/hooks/use-action-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { LeagueRules } from "@/lib/data/league-rules";

const initialState: LeagueRulesFormState = {};

export function LeagueRulesForm({ leagueRules }: { leagueRules?: LeagueRules }) {
  const [state, formAction, pending] = useActionState(
    upsertLeagueRules,
    initialState,
  );
  useActionToast(pending, !!state.error, "Settings saved.");

  const minMen = leagueRules?.genderMinimums.find((g) => g.gender === "M")?.min;
  const minWomen = leagueRules?.genderMinimums.find((g) => g.gender === "F")?.min;

  return (
    <Card>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-6">
          <p className="text-sm text-muted-foreground">
            Fielding positions themselves (names, importance, skill weights) are
            managed on the{" "}
            <a href="/settings/positions" className="underline">
              Positions
            </a>{" "}
            page.
          </p>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="minMen">Minimum men fielding</Label>
              <Input
                id="minMen"
                name="minMen"
                type="number"
                min={0}
                required
                defaultValue={minMen}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="minWomen">Minimum women fielding</Label>
              <Input
                id="minWomen"
                name="minWomen"
                type="number"
                min={0}
                required
                defaultValue={minWomen}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="inningsPerGame">Innings per game</Label>
              <Input
                id="inningsPerGame"
                name="inningsPerGame"
                type="number"
                min={1}
                max={20}
                required
                defaultValue={leagueRules?.inningsPerGame ?? 7}
              />
            </div>
          </div>

          {state.error && <p className="text-sm text-destructive">{state.error}</p>}

          <Button type="submit" disabled={pending} className="self-start">
            {pending ? "Saving..." : "Save league rules"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
