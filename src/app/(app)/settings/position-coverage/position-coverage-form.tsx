"use client";

import { useActionState } from "react";
import {
  updatePositionShoreUpWeights,
  type PositionCoverageFormState,
} from "./actions";
import { useActionToast } from "@/hooks/use-action-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import type { PositionShoreUpWeightRow } from "@/lib/data/position-shore-up-weights";

const initialState: PositionCoverageFormState = {};

export function PositionCoverageForm({
  positions,
  shoreUpWeights,
}: {
  positions: Position[];
  shoreUpWeights: PositionShoreUpWeightRow[];
}) {
  const [state, formAction, pending] = useActionState(
    updatePositionShoreUpWeights,
    initialState,
  );
  useActionToast(pending, !!state.error, "Settings saved.");

  const weightByPair = new Map(
    shoreUpWeights.map((row) => [
      `${row.helperPositionId}::${row.helpedPositionId}`,
      row.weight,
    ]),
  );

  return (
    <Card>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-4">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Helper \ Helped</TableHead>
                  {positions.map((helped) => (
                    <TableHead key={helped.id} className="w-16 text-center">
                      {helped.shortCode}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {positions.map((helper) => (
                  <TableRow key={helper.id}>
                    <TableCell className="font-medium whitespace-nowrap">
                      {helper.name}
                    </TableCell>
                    {positions.map((helped) => {
                      if (helped.id === helper.id) {
                        return (
                          <TableCell key={helped.id} className="text-center">
                            <span className="text-muted-foreground">—</span>
                          </TableCell>
                        );
                      }
                      const weight =
                        weightByPair.get(`${helper.id}::${helped.id}`) ?? 0;
                      return (
                        <TableCell key={helped.id}>
                          <Input
                            type="number"
                            min={0}
                            max={10}
                            className="w-14"
                            name={`weight-${helper.id}-${helped.id}`}
                            defaultValue={weight}
                          />
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {state.error && <p className="text-sm text-destructive">{state.error}</p>}

          <Button type="submit" disabled={pending} className="self-start">
            {pending ? "Saving..." : "Save position coverage"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
