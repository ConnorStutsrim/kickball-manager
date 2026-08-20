"use client";

import { useActionState, useEffect, useState } from "react";
import { generateLineup, type GenerateLineupState } from "./actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

const initialState: GenerateLineupState = {};

function attendanceStorageKey(gameId: string) {
  return `kickball-manager:attendance:${gameId}`;
}

function readAbsentIds(gameId: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const saved = localStorage.getItem(attendanceStorageKey(gameId));
    return saved ? new Set(JSON.parse(saved) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

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

  // Who's unchecked, remembered per game in this browser — a player not in
  // this set defaults present (so newly-added roster players default
  // checked, same as before this remembered anything).
  const [absentIds, setAbsentIds] = useState<Set<string>>(() => readAbsentIds(gameId));

  useEffect(() => {
    try {
      localStorage.setItem(attendanceStorageKey(gameId), JSON.stringify([...absentIds]));
    } catch {
      // ignore unavailable storage (e.g. private browsing)
    }
  }, [absentIds, gameId]);

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
                checked={!absentIds.has(player.id)}
                onCheckedChange={(checked) =>
                  setAbsentIds((prev) => {
                    const next = new Set(prev);
                    if (checked) next.delete(player.id);
                    else next.add(player.id);
                    return next;
                  })
                }
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
