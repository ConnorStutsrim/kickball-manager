import Link from "next/link";
import { Button } from "@/components/ui/button";
import { signOut } from "./actions";

const NAV_LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/players", label: "Roster" },
  { href: "/games", label: "Games" },
  { href: "/settings/league-rules", label: "League rules" },
  { href: "/settings/positions", label: "Positions" },
  { href: "/settings/google", label: "Google Sheets" },
];

// Authenticated pages show per-user, frequently-mutated data (roster, lineups,
// live game stats) — never statically prerender them.
export const dynamic = "force-dynamic";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <nav className="flex items-center gap-4">
            <Link href="/" className="font-semibold">
              Kickball Manager
            </Link>
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <form action={signOut}>
            <Button variant="ghost" size="sm" type="submit">
              Sign out
            </Button>
          </form>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        {children}
      </main>
    </div>
  );
}
