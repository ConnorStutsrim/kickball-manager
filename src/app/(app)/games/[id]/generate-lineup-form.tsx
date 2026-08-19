"use client";

import { useActionState } from "react";
import { generateLineup, type GenerateLineupState } from "./actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

const initialState: GenerateLineupState = {};

export function GenerateLineupForm({
  gameId,
  activePlayers,
  hasLineup,
}: {
  gameId: string;
  activePlayers: { id: string; name: string }[];
  hasLineup: boolean;
}) {
  const boundAction = generateLineup.bind(null, gameId);
  const [state, formAction, pending] = useActionState(boundAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div>
        <p className="text-sm font-medium">Who&apos;s here today?</p>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {activePlayers.map((player) => (
            <div key={player.id} className="flex items-center gap-2">
              <Checkbox
                id={`present-${player.id}`}
                name="presentPlayerIds"
                value={player.id}
                defaultChecked
              />
              <Label htmlFor={`present-${player.id}`} className="font-normal">
                {player.name}
              </Label>
            </div>
          ))}
        </div>
      </div>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state.warnings?.map((w) => (
        <p key={w} className="text-sm text-amber-600 dark:text-amber-500">
          {w}
        </p>
      ))}

      <Button type="submit" disabled={pending} className="self-start">
        {pending
          ? "Generating..."
          : hasLineup
            ? "Regenerate lineup"
            : "Generate lineup"}
      </Button>
    </form>
  );
}
