"use client";

import { useActionState } from "react";
import { createGame, type NewGameFormState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: NewGameFormState = {};

export function NewGameForm({ defaultInnings }: { defaultInnings: number }) {
  const [state, formAction, pending] = useActionState(createGame, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="date">Date</Label>
        <Input id="date" name="date" type="date" required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="opponent">Opponent</Label>
        <Input id="opponent" name="opponent" />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="location">Location</Label>
        <Input id="location" name="location" />
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
          defaultValue={defaultInnings}
        />
      </div>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Creating..." : "Create game"}
      </Button>
    </form>
  );
}
