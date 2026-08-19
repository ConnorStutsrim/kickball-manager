"use client";

import { useTransition } from "react";
import { setFieldingAssignment } from "./actions";
import { BENCH } from "@/lib/lineup/fielding-solver";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface FieldingEntry {
  inning: number;
  position: string;
  playerId: string;
  playerName: string;
}

export function FieldingGrid({
  gameId,
  lineupId,
  positions,
  innings,
  fielding,
  roster,
}: {
  gameId: string;
  lineupId: string;
  positions: string[];
  innings: number;
  fielding: FieldingEntry[];
  roster: { id: string; name: string }[];
}) {
  const [pending, startTransition] = useTransition();
  const inningNumbers = Array.from({ length: innings }, (_, i) => i + 1);
  const sortedRoster = [...roster].sort((a, b) => a.name.localeCompare(b.name));

  const cell = new Map<string, FieldingEntry>();
  for (const entry of fielding) {
    cell.set(`${entry.inning}:${entry.position}`, entry);
  }

  const benchByInning = new Map<number, FieldingEntry[]>();
  for (const entry of fielding) {
    if (entry.position !== BENCH) continue;
    if (!benchByInning.has(entry.inning)) benchByInning.set(entry.inning, []);
    benchByInning.get(entry.inning)!.push(entry);
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Position</TableHead>
            {inningNumbers.map((inning) => (
              <TableHead key={inning} className="text-center">
                Inning {inning}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {positions.map((position) => (
            <TableRow key={position}>
              <TableCell className="font-medium">{position}</TableCell>
              {inningNumbers.map((inning) => {
                const entry = cell.get(`${inning}:${position}`);
                return (
                  <TableCell key={inning}>
                    <select
                      className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
                      value={entry?.playerId ?? ""}
                      disabled={pending || !entry}
                      onChange={(e) =>
                        startTransition(() =>
                          setFieldingAssignment(
                            gameId,
                            lineupId,
                            inning,
                            position,
                            e.target.value,
                          ),
                        )
                      }
                    >
                      {sortedRoster.map((player) => (
                        <option key={player.id} value={player.id}>
                          {player.name}
                        </option>
                      ))}
                    </select>
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
          <TableRow>
            <TableCell className="font-medium text-muted-foreground">Bench</TableCell>
            {inningNumbers.map((inning) => (
              <TableCell key={inning} className="text-sm text-muted-foreground">
                {(benchByInning.get(inning) ?? []).map((e) => e.playerName).join(", ") ||
                  "—"}
              </TableCell>
            ))}
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}
