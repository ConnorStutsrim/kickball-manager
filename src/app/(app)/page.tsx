import Link from "next/link";
import { getPlayers } from "@/lib/data/players";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function DashboardPage() {
  const roster = await getPlayers();
  const activeCount = roster.filter((p) => p.active).length;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <Card className="max-w-sm">
        <CardHeader>
          <CardTitle>Roster</CardTitle>
          <CardDescription>
            {roster.length === 0
              ? "No players yet."
              : `${activeCount} active of ${roster.length} total`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/players" className="text-sm underline">
            Manage roster →
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
