"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { deleteGame } from "./actions";

export function DeleteGameButton({ gameId }: { gameId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="destructive"
      disabled={pending}
      onClick={() => {
        if (confirm("Delete this game? This cannot be undone.")) {
          startTransition(() => deleteGame(gameId));
        }
      }}
    >
      {pending ? "Deleting..." : "Delete game"}
    </Button>
  );
}
