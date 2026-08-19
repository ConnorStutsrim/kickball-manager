"use client";

import { useActionState } from "react";
import { recordBaserunningEvent, type LiveActionState } from "./actions";
import { BASERUNNING_EVENT_OPTIONS } from "./constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const initialState: LiveActionState = {};

export function BaserunningForm({
  gameId,
  currentInning,
  roster,
}: {
  gameId: string;
  currentInning: number;
  roster: { id: string; name: string }[];
}) {
  const boundAction = recordBaserunningEvent.bind(null, gameId);
  const [state, formAction, pending] = useActionState(boundAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-md border p-4">
      <p className="text-sm font-medium">Log baserunning event</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="br-player">Player</Label>
          <Select name="playerId">
            <SelectTrigger id="br-player" className="w-full">
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              {roster.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="br-inning">Inning</Label>
          <Input id="br-inning" name="inning" type="number" min={1} defaultValue={currentInning} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="br-type">Event</Label>
          <Select name="eventType">
            <SelectTrigger id="br-type" className="w-full">
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              {BASERUNNING_EVENT_OPTIONS.map((e) => (
                <SelectItem key={e.value} value={e.value}>
                  {e.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="br-notes">Notes</Label>
          <Input id="br-notes" name="notes" />
        </div>
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Saving..." : "Add"}
      </Button>
    </form>
  );
}
