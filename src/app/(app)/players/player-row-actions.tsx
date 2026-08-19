"use client";

import { useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { deletePlayer, setPlayerActive } from "./actions";

export function PlayerRowActions({
  playerId,
  active,
}: {
  playerId: string;
  active: boolean;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        render={<Link href={`/players/${playerId}/edit`} />}
      >
        Edit
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(() => setPlayerActive(playerId, !active))
        }
      >
        {active ? "Deactivate" : "Activate"}
      </Button>
      <Button
        variant="destructive"
        size="sm"
        disabled={pending}
        onClick={() => {
          if (confirm("Delete this player? This cannot be undone.")) {
            startTransition(() => deletePlayer(playerId));
          }
        }}
      >
        Delete
      </Button>
    </div>
  );
}
