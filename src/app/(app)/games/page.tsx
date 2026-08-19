import Link from "next/link";
import { getGames } from "@/lib/data/games";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function GamesPage() {
  const rows = await getGames();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Games</h1>
        <Button render={<Link href="/games/new" />}>New game</Button>
      </div>

      {rows.length === 0 ? (
        <p className="text-muted-foreground">No games yet.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Opponent</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Season</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(({ game, season }) => (
              <TableRow key={game.id}>
                <TableCell>
                  <Link href={`/games/${game.id}`} className="underline">
                    {game.date}
                  </Link>
                </TableCell>
                <TableCell>{game.opponent ?? "—"}</TableCell>
                <TableCell>{game.location ?? "—"}</TableCell>
                <TableCell>{season.name}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
