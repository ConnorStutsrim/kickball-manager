"use client";

import { useActionState } from "react";
import type { PlayerFormState } from "./actions";
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
import type { Player } from "@/lib/data/players";

const RATING_FIELDS = [
  { name: "ratingContact", label: "Contact" },
  { name: "ratingPower", label: "Power" },
  { name: "ratingSpeed", label: "Speed" },
  { name: "ratingPlateDiscipline", label: "Plate discipline" },
  { name: "ratingFielding", label: "Fielding" },
] as const;

const initialState: PlayerFormState = {};

export function PlayerForm({
  action,
  player,
  submitLabel = "Save",
}: {
  action: (state: PlayerFormState, formData: FormData) => Promise<PlayerFormState>;
  player?: Player;
  submitLabel?: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" defaultValue={player?.name} required />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="gender">Gender</Label>
        <Select name="gender" defaultValue={player?.gender ?? "F"}>
          <SelectTrigger id="gender" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="F">F</SelectItem>
            <SelectItem value="M">M</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <fieldset className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <legend className="col-span-full text-sm font-medium text-muted-foreground">
          Baseline ratings (1-5, optional)
        </legend>
        {RATING_FIELDS.map((field) => (
          <div key={field.name} className="flex flex-col gap-2">
            <Label htmlFor={field.name}>{field.label}</Label>
            <Input
              id={field.name}
              name={field.name}
              type="number"
              min={1}
              max={5}
              defaultValue={player?.[field.name] ?? undefined}
            />
          </div>
        ))}
      </fieldset>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Saving..." : submitLabel}
      </Button>
    </form>
  );
}
