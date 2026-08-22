"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  ClipboardList,
  FileSpreadsheet,
  LayoutDashboard,
  ListOrdered,
  LogOut,
  Shapes,
  Users,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { signOut } from "./actions";

const MAIN_LINKS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/players", label: "Roster", icon: Users },
  { href: "/games", label: "Games", icon: CalendarDays },
];

const SETTINGS_LINKS = [
  { href: "/settings/league-rules", label: "League rules", icon: ClipboardList },
  { href: "/settings/positions", label: "Positions", icon: Shapes },
  { href: "/settings/batting-slots", label: "Batting slots", icon: ListOrdered },
  { href: "/settings/google", label: "Google Sheets", icon: FileSpreadsheet },
];

function NavGroup({
  label,
  links,
  pathname,
}: {
  label: string;
  links: typeof MAIN_LINKS;
  pathname: string;
}) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {links.map((link) => (
            <SidebarMenuItem key={link.href}>
              <SidebarMenuButton
                isActive={pathname === link.href}
                render={<Link href={link.href} />}
              >
                <link.icon />
                <span>{link.label}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

export function AppSidebar({ userEmail }: { userEmail: string }) {
  const pathname = usePathname();

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1">
          <span className="text-sm font-semibold">Kickball Manager</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <NavGroup label="Roster & Games" links={MAIN_LINKS} pathname={pathname} />
        <NavGroup label="Settings" links={SETTINGS_LINKS} pathname={pathname} />
      </SidebarContent>
      <SidebarFooter>
        <div className="flex items-center justify-between gap-2 px-2 py-1">
          <span className="truncate text-xs text-muted-foreground" title={userEmail}>
            {userEmail}
          </span>
          <form action={signOut}>
            <Button variant="ghost" size="icon-sm" type="submit" aria-label="Sign out">
              <LogOut />
            </Button>
          </form>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
