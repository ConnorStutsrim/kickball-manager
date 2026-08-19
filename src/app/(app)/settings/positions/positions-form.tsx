"use client";

import { useActionState } from "react";
import { updatePositions, type PositionsFormState } from "./actions";
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

const WEIGHT_FIELDS = [
  { key: "weightSpeed", label: "Speed" },
  { key: "weightCatching", label: "Catching" },
  { key: "weightThrowing", label: "Throwing" },
  { key: "weightGameSense", label: "Game sense" },
] as const;

const initialState: PositionsFormState = {};

export function PositionsForm({ positions }: { positions: Position[] }) {
  const [state, formAction, pending] = useActionState(updatePositions, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Position</TableHead>
              <TableHead className="w-20">Importance</TableHead>
              {WEIGHT_FIELDS.map((f) => (
                <TableHead key={f.key} className="w-24">
                  {f.label}
                </TableHead>
              ))}
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
                    min={0}
                    max={5}
                    name={`importance-${position.id}`}
                    defaultValue={position.importance}
                  />
                </TableCell>
                {WEIGHT_FIELDS.map((f) => (
                  <TableCell key={f.key}>
                    <Input
                      type="number"
                      min={0}
                      max={5}
                      name={`${f.key}-${position.id}`}
                      defaultValue={position[f.key]}
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
        {pending ? "Saving..." : "Save positions"}
      </Button>
    </form>
  );
}
