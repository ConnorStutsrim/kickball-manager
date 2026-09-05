"use client";

import { useActionState } from "react";
import type { GameFormState } from "./actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Game } from "@/lib/data/games";

const initialState: GameFormState = {};

export function GameForm({
  action,
  game,
  defaultInnings,
  submitLabel = "Create game",
}: {
  action: (state: GameFormState, formData: FormData) => Promise<GameFormState>;
  game?: Game;
  defaultInnings: number;
  submitLabel?: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <Card className="max-w-md">
      <CardContent>
        <form action={formAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="date">Date</Label>
            <Input id="date" name="date" type="date" defaultValue={game?.date} required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="opponent">Opponent</Label>
            <Input id="opponent" name="opponent" defaultValue={game?.opponent ?? undefined} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="location">Location</Label>
            <Input id="location" name="location" defaultValue={game?.location ?? undefined} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="inningsPlanned">Innings planned</Label>
            <Input
              id="inningsPlanned"
              name="inningsPlanned"
              type="number"
              min={1}
              max={20}
              required
              defaultValue={game?.inningsPlanned ?? defaultInnings}
            />
          </div>

          {state.error && <p className="text-sm text-destructive">{state.error}</p>}

          <Button type="submit" disabled={pending} className="self-start">
            {pending ? "Saving..." : submitLabel}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
