import Link from "next/link";
import { getPlayers } from "@/lib/data/players";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PlayerRowActions } from "./player-row-actions";

const RATING_COLUMNS = [
  { key: "ratingPower", label: "Pow" },
  { key: "ratingPlacement", label: "Plc" },
  { key: "ratingBunting", label: "Bnt" },
  { key: "ratingBaserunning", label: "BR" },
  { key: "ratingSpeed", label: "Spd" },
  { key: "ratingCatching", label: "Cat" },
  { key: "ratingThrowing", label: "Thr" },
  { key: "ratingGameSense", label: "Sns" },
] as const;

export default async function PlayersPage() {
  const roster = await getPlayers();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Roster</h1>
        <Button render={<Link href="/players/new" />}>Add player</Button>
      </div>

      {roster.length === 0 ? (
        <p className="text-muted-foreground">
          No players yet. Add your first player to get started.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Gender</TableHead>
              {RATING_COLUMNS.map((col) => (
                <TableHead key={col.key} className="text-center">
                  {col.label}
                </TableHead>
              ))}
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {roster.map((player) => (
              <TableRow key={player.id}>
                <TableCell className="font-medium">{player.name}</TableCell>
                <TableCell>{player.gender}</TableCell>
                {RATING_COLUMNS.map((col) => (
                  <TableCell key={col.key} className="text-center">
                    {player[col.key] ?? "—"}
                  </TableCell>
                ))}
                <TableCell>{player.active ? "Active" : "Inactive"}</TableCell>
                <TableCell className="text-right">
                  <PlayerRowActions
                    playerId={player.id}
                    active={player.active}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
