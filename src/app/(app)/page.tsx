import Link from "next/link";
import { Users } from "lucide-react";
import { getPlayers } from "@/lib/data/players";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function DashboardPage() {
  const roster = await getPlayers();
  const activeCount = roster.filter((p) => p.active).length;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          A quick look at your team.
        </p>
      </div>
      <Card className="max-w-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-muted-foreground">
            <Users className="size-4" />
            Roster
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {roster.length === 0 ? (
            <p className="text-sm text-muted-foreground">No players yet.</p>
          ) : (
            <p>
              <span className="text-3xl font-semibold text-primary">{activeCount}</span>{" "}
              <span className="text-sm text-muted-foreground">
                active of {roster.length} total
              </span>
            </p>
          )}
          <Link href="/players" className="text-sm underline">
            Manage roster →
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
