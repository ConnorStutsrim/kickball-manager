"use client";

import { useActionState } from "react";
import { recordDefensiveNote, type LiveActionState } from "./actions";
import { DEFENSIVE_NOTE_TAG_OPTIONS } from "./constants";
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

export function DefensiveNoteForm({
  gameId,
  currentInning,
  roster,
  positions,
}: {
  gameId: string;
  currentInning: number;
  roster: { id: string; name: string }[];
  positions: string[];
}) {
  const boundAction = recordDefensiveNote.bind(null, gameId);
  const [state, formAction, pending] = useActionState(boundAction, initialState);
  // Base UI's Select doesn't scrape rendered SelectItem children to label
  // the trigger the way a native <select> does — it needs an explicit
  // value->label map (or, for DEFENSIVE_NOTE_TAG_OPTIONS below, an array
  // already shaped as {value, label}, which it also accepts directly).
  const rosterItems = Object.fromEntries(roster.map((p) => [p.id, p.name]));

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-md border p-4">
      <p className="text-sm font-medium">Log defensive note</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div className="flex flex-col gap-2">
          <Label htmlFor="dn-player">Player</Label>
          <Select name="playerId" items={rosterItems}>
            <SelectTrigger id="dn-player" className="w-full">
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
          <Label htmlFor="dn-inning">Inning</Label>
          <Input id="dn-inning" name="inning" type="number" min={1} defaultValue={currentInning} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="dn-position">Position</Label>
          <Select name="position">
            <SelectTrigger id="dn-position" className="w-full">
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              {positions.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="dn-tag">Tag</Label>
          <Select name="tag" items={DEFENSIVE_NOTE_TAG_OPTIONS}>
            <SelectTrigger id="dn-tag" className="w-full">
              <SelectValue placeholder="None" />
            </SelectTrigger>
            <SelectContent>
              {DEFENSIVE_NOTE_TAG_OPTIONS.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="dn-note">Note</Label>
          <Input id="dn-note" name="note" />
        </div>
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Saving..." : "Add"}
      </Button>
    </form>
  );
}
