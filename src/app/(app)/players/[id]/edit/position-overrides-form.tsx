"use client";

import { useActionState } from "react";
import { updatePlayerPositionOverrides, type PositionOverridesFormState } from "../../actions";
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
import type { Position } from "@/lib/data/positions";
import type { PlayerPositionOverride } from "@/lib/data/position-overrides";

const initialState: PositionOverridesFormState = {};

export function PositionOverridesForm({
  playerId,
  positions,
  overrides,
}: {
  playerId: string;
  positions: Position[];
  overrides: PlayerPositionOverride[];
}) {
  const [state, formAction, pending] = useActionState(
    updatePlayerPositionOverrides.bind(null, playerId),
    initialState,
  );
  const overrideByPositionId = new Map(overrides.map((o) => [o.positionId, o.rating]));

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Position</TableHead>
              <TableHead className="w-24">Override</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {positions.map((position) => (
              <TableRow key={position.id}>
                <TableCell className="font-medium">
                  {position.name}{" "}
                  <span className="text-muted-foreground">({position.shortCode})</span>
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    min={1}
                    max={5}
                    placeholder="auto"
                    name={`rating-${position.id}`}
                    defaultValue={overrideByPositionId.get(position.id) ?? ""}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Saving..." : "Save overrides"}
      </Button>
    </form>
  );
}
