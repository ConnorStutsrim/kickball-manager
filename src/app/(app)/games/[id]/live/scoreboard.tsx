import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function Scoreboard({
  inningsPlanned,
  ourRunsByInning,
  theirRunsByInning,
  ourTotal,
  theirTotal,
  opponentName,
}: {
  inningsPlanned: number;
  ourRunsByInning: Record<number, number>;
  theirRunsByInning: Record<number, number>;
  ourTotal: number;
  theirTotal: number;
  opponentName: string | null;
}) {
  const innings = Array.from({ length: inningsPlanned }, (_, i) => i + 1);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead></TableHead>
          {innings.map((inning) => (
            <TableHead key={inning} className="w-8 text-center font-normal">
              {inning}
            </TableHead>
          ))}
          <TableHead className="text-center font-semibold text-foreground">R</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell className="font-medium">Us</TableCell>
          {innings.map((inning) => (
            <TableCell key={inning} className="text-center">
              {ourRunsByInning[inning] ?? "–"}
            </TableCell>
          ))}
          <TableCell className="text-center font-semibold">{ourTotal}</TableCell>
        </TableRow>
        <TableRow>
          <TableCell className="font-medium">{opponentName ?? "Them"}</TableCell>
          {innings.map((inning) => (
            <TableCell key={inning} className="text-center">
              {theirRunsByInning[inning] ?? "–"}
            </TableCell>
          ))}
          <TableCell className="text-center font-semibold">{theirTotal}</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}
