"use client";

import { useTransition } from "react";
import { moveBattingOrder } from "./actions";
import { Button } from "@/components/ui/button";

export function BattingOrderList({
  gameId,
  lineupId,
  battingOrder,
}: {
  gameId: string;
  lineupId: string;
  battingOrder: { playerId: string; playerName: string; battingPosition: number }[];
}) {
  const [pending, startTransition] = useTransition();

  return (
    <ol className="flex flex-col gap-1">
      {battingOrder.map((entry, index) => (
        <li
          key={entry.playerId}
          className="flex items-center justify-between gap-2 rounded-md border px-3 py-2"
        >
          <span className="text-sm">
            <span className="mr-2 text-muted-foreground">{entry.battingPosition}.</span>
            {entry.playerName}
          </span>
          <div className="flex gap-1">
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              disabled={pending || index === 0}
              onClick={() =>
                startTransition(() =>
                  moveBattingOrder(gameId, lineupId, entry.playerId, "up"),
                )
              }
            >
              ↑
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              disabled={pending || index === battingOrder.length - 1}
              onClick={() =>
                startTransition(() =>
                  moveBattingOrder(gameId, lineupId, entry.playerId, "down"),
                )
              }
            >
              ↓
            </Button>
          </div>
        </li>
      ))}
    </ol>
  );
}
