"use client";

import { useActionState } from "react";
import { updatePlayerPositionRatings, type PositionRatingsFormState } from "../../actions";
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
import type { PlayerPositionRating } from "@/lib/data/position-ratings";

const initialState: PositionRatingsFormState = {};

export function PositionRatingsForm({
  playerId,
  positions,
  ratings,
}: {
  playerId: string;
  positions: Position[];
  ratings: PlayerPositionRating[];
}) {
  const [state, formAction, pending] = useActionState(
    updatePlayerPositionRatings.bind(null, playerId),
    initialState,
  );
  const ratingByPositionId = new Map(ratings.map((r) => [r.positionId, r.rating]));

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground sm:grid-cols-5">
        <div className="flex gap-1">
          <dt className="font-medium text-foreground">1</dt>
          <dd>Unacceptable</dd>
        </div>
        <div className="flex gap-1">
          <dt className="font-medium text-foreground">3</dt>
          <dd>Below average</dd>
        </div>
        <div className="flex gap-1">
          <dt className="font-medium text-foreground">5</dt>
          <dd>Average (the default when unrated)</dd>
        </div>
        <div className="flex gap-1">
          <dt className="font-medium text-foreground">7</dt>
          <dd>Above average</dd>
        </div>
        <div className="flex gap-1">
          <dt className="font-medium text-foreground">10</dt>
          <dd>Perfect fit</dd>
        </div>
      </dl>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Position</TableHead>
              <TableHead className="w-24">Rating</TableHead>
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
                    max={10}
                    placeholder="5"
                    name={`rating-${position.id}`}
                    defaultValue={ratingByPositionId.get(position.id) ?? ""}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Saving..." : "Save ratings"}
      </Button>
    </form>
  );
}
