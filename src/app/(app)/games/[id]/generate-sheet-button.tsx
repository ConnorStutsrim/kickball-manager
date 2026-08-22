"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { generateGameSheet } from "./sheet-actions";
import { Button } from "@/components/ui/button";

export function GenerateSheetButton({
  gameId,
  initialUrl,
}: {
  gameId: string;
  initialUrl: string | null;
}) {
  const [url, setUrl] = useState(initialUrl);
  const [error, setError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  function generate() {
    startTransition(async () => {
      const res = await generateGameSheet(gameId);
      if (res.error) {
        setError(res.error);
      } else {
        setError(undefined);
        setUrl(res.url ?? null);
        toast.success("Sheet updated.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <Button type="button" variant="outline" disabled={pending} onClick={generate}>
          {pending ? "Generating..." : url ? "Regenerate Sheet" : "Generate Sheet"}
        </Button>
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm underline"
          >
            Open sheet
          </a>
        )}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
