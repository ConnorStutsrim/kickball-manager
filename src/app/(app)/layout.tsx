import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { requireUser } from "@/lib/auth";
import { AppSidebar } from "./app-sidebar";

// Authenticated pages show per-user, frequently-mutated data (roster, lineups,
// live game stats) — never statically prerender them.
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();

  return (
    <SidebarProvider>
      <AppSidebar userEmail={user.email!} />
      <SidebarInset>
        <header className="flex items-center gap-2 border-b px-4 py-3">
          <SidebarTrigger />
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
