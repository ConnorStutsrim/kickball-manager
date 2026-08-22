"use client";

import { useState, useTransition } from "react";
import { deleteLastPlateAppearance, recordPlateAppearance } from "./actions";
import { RESULT_OPTIONS } from "./constants";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PlateAppearanceResult } from "@/db/schema";

export function AtBatPanel({
  gameId,
  batterName,
  battingPosition,
  outs,
  canDeleteLast,
}: {
  gameId: string;
  batterName: string;
  battingPosition: number;
  outs: number;
  canDeleteLast: boolean;
}) {
  const [rbi, setRbi] = useState(0);
  const [isBunt, setIsBunt] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  function submitResult(result: PlateAppearanceResult) {
    const formData = new FormData();
    formData.set("result", result);
    formData.set("rbi", String(rbi));
    if (isBunt) formData.set("isBunt", "true");
    startTransition(async () => {
      const res = await recordPlateAppearance(gameId, {}, formData);
      setError(res.error);
      if (!res.error) {
        setRbi(0);
        setIsBunt(false);
      }
    });
  }

  return (
    <div className="flex flex-col gap-4 rounded-md border p-4">
      <div>
        <p className="text-sm text-muted-foreground">At bat</p>
        <p className="text-xl font-semibold">
          {batterName} <span className="text-base text-muted-foreground">(#{battingPosition})</span>
        </p>
        <div className="flex items-center gap-1.5" role="img" aria-label={`${outs} of 3 outs`}>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className={
                i < outs
                  ? "size-2.5 rounded-full bg-destructive"
                  : "size-2.5 rounded-full border border-muted-foreground/40"
              }
            />
          ))}
          <span className="ml-1 text-sm text-muted-foreground">{outs} outs</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Label htmlFor="rbi">RBI</Label>
          <Input
            id="rbi"
            type="number"
            min={0}
            max={10}
            value={rbi}
            onChange={(e) => setRbi(Number(e.target.value))}
            className="w-20"
          />
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="isBunt"
            checked={isBunt}
            onCheckedChange={(checked) => setIsBunt(checked === true)}
          />
          <Label htmlFor="isBunt" className="font-normal">
            Bunt attempt
          </Label>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {RESULT_OPTIONS.map((option) => (
          <Button
            key={option.value}
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => submitResult(option.value)}
          >
            {option.label}
          </Button>
        ))}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={pending || !canDeleteLast}
        className="self-start"
        onClick={() => startTransition(() => deleteLastPlateAppearance(gameId))}
      >
        Delete last play
      </Button>
    </div>
  );
}
