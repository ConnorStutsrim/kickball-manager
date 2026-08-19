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
    <div className="overflow-x-auto">
      <table className="text-sm">
        <thead>
          <tr>
            <th className="pr-4 text-left font-normal text-muted-foreground"></th>
            {innings.map((inning) => (
              <th key={inning} className="w-8 text-center font-normal text-muted-foreground">
                {inning}
              </th>
            ))}
            <th className="pl-4 text-center font-semibold">R</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="pr-4 font-medium">Us</td>
            {innings.map((inning) => (
              <td key={inning} className="text-center">
                {ourRunsByInning[inning] ?? "–"}
              </td>
            ))}
            <td className="pl-4 text-center font-semibold">{ourTotal}</td>
          </tr>
          <tr>
            <td className="pr-4 font-medium">{opponentName ?? "Them"}</td>
            {innings.map((inning) => (
              <td key={inning} className="text-center">
                {theirRunsByInning[inning] ?? "–"}
              </td>
            ))}
            <td className="pl-4 text-center font-semibold">{theirTotal}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
