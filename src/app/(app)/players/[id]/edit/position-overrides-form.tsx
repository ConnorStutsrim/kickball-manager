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
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground sm:grid-cols-5">
        <div className="flex gap-1">
          <dt className="font-medium text-foreground">1</dt>
          <dd>Unacceptable</dd>
        </div>
        <div className="flex gap-1">
          <dt className="font-medium text-foreground">2</dt>
          <dd>Below average</dd>
        </div>
        <div className="flex gap-1">
          <dt className="font-medium text-foreground">3</dt>
          <dd>Average (the default when unrated)</dd>
        </div>
        <div className="flex gap-1">
          <dt className="font-medium text-foreground">4</dt>
          <dd>Above average</dd>
        </div>
        <div className="flex gap-1">
          <dt className="font-medium text-foreground">5</dt>
          <dd>Perfect fit</dd>
        </div>
      </dl>
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
