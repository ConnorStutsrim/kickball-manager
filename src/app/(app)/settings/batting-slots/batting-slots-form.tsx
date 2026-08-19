"use client";

import { useActionState } from "react";
import { updateBattingSlotArchetypes, type BattingSlotsFormState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { BattingSlotArchetype } from "@/lib/data/batting-slot-archetypes";

const WEIGHT_FIELDS = [
  { key: "weightPower", label: "Power" },
  { key: "weightPlacement", label: "Placement" },
  { key: "weightBunting", label: "Bunting" },
  { key: "weightBaserunning", label: "Baserunning" },
] as const;

const initialState: BattingSlotsFormState = {};

export function BattingSlotsForm({ archetypes }: { archetypes: BattingSlotArchetype[] }) {
  const [state, formAction, pending] = useActionState(
    updateBattingSlotArchetypes,
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Archetype</TableHead>
              {WEIGHT_FIELDS.map((f) => (
                <TableHead key={f.key} className="w-24">
                  {f.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {archetypes.map((archetype) => (
              <TableRow key={archetype.id}>
                <TableCell className="font-medium">{archetype.name}</TableCell>
                {WEIGHT_FIELDS.map((f) => (
                  <TableCell key={f.key}>
                    <Input
                      type="number"
                      min={0}
                      max={5}
                      name={`${f.key}-${archetype.id}`}
                      defaultValue={archetype[f.key]}
                    />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Saving..." : "Save batting slots"}
      </Button>
    </form>
  );
}
