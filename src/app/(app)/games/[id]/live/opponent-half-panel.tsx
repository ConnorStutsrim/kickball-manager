"use client";

import { useActionState } from "react";
import { recordOpponentRuns, type LiveActionState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: LiveActionState = {};

export function OpponentHalfPanel({ gameId, inning }: { gameId: string; inning: number }) {
  const boundAction = recordOpponentRuns.bind(null, gameId);
  const [state, formAction, pending] = useActionState(boundAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4 rounded-md border p-4">
      <p className="text-sm text-muted-foreground">Opponent batting — inning {inning}</p>
      <input type="hidden" name="inning" value={inning} />
      <div className="flex items-end gap-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="runs">Runs this half</Label>
          <Input
            id="runs"
            name="runs"
            type="number"
            min={0}
            max={50}
            required
            defaultValue={0}
            className="w-24"
          />
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving..." : "Save"}
        </Button>
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
    </form>
  );
}
