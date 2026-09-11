"use client";

import {
  Building2,
  ChevronDown,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";
import { LogoutButton } from "@/components/auth/logout-button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import { flattenMenu, visibleMenu } from "@/lib/navigation/menu";
import { cn } from "@/lib/utils";
import { userInitials } from "./user-menu";

const GROUPS_COOKIE = "nav-groups-collapsed";
const GROUPS_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

function readCollapsedGroups(): string[] {
  if (typeof document === "undefined") return [];
  const match = document.cookie
    .split("; ")
    .find((part) => part.startsWith(`${GROUPS_COOKIE}=`));
  if (!match) return [];
  try {
    return JSON.parse(decodeURIComponent(match.split("=")[1])) as string[];
  } catch {
    return [];
  }
}

/**
 * The single navigation sidebar.
 *
 * It replaces four static per-portal sidebars that listed their contents
 * unconditionally. What a user sees is now derived from the route grants in
 * their session, so someone holding ADMIN_VACACIONES + FSR gets one menu with
 * both — and without the operations or user-administration sections they cannot
 * open anyway.
 *
 * The five groups collapse independently with the state remembered in a
 * cookie. Groups start expanded and collapsed content stays mounted
 * (forceMount): the e2e suite addresses links inside them and must keep
 * finding them. The footer is a compact account row — the bell and the theme
 * selector moved to the global header, where they stay reachable on mobile.
 */
export function AppSidebar() {
  const pathname = usePathname();
  const { toggleSidebar } = useSidebar();
  const { data: session } = useSession();
  const [collapsed, setCollapsed] = useState<string[]>([]);

  useEffect(() => {
    setCollapsed(readCollapsedGroups());
  }, []);

  const groups = useMemo(() => {
    const user = session?.user;
    if (!user) return [];
    return visibleMenu(
      { prefixes: user.routePaths ?? [], exact: user.exactRoutePaths ?? [] },
      user.isSuperuser ?? false,
    );
  }, [session]);

  const home = session?.user?.defaultPath ?? "/";

  /**
   * The single entry that matches the current path best.
   *
   * Prefix matching alone lights up more than one link: standing on
   * `/admin/incidents` both "Panel" (`/admin`) and "Incidentes" match, and the
   * first one painted wins — which is why the menu looked stuck on the first
   * item. The longest match is the specific one, and only it is active.
   */
  const activeUrl = useMemo(() => {
    const candidates = flattenMenu(groups)
      .map((item) => item.url)
      .filter(
        (url) =>
          pathname === url || pathname.startsWith(`${url.replace(/\/$/, "")}/`),
      );
    return candidates.sort((a, b) => b.length - a.length)[0];
  }, [groups, pathname]);

  const toggleGroup = (title: string, open: boolean) => {
    setCollapsed((prev) => {
      const next = open
        ? prev.filter((name) => name !== title)
        : [...prev.filter((name) => name !== title), title];
      // biome-ignore lint/suspicious/noDocumentCookie: Required to remember collapsed groups
      document.cookie = `${GROUPS_COOKIE}=${encodeURIComponent(JSON.stringify(next))}; path=/; max-age=${GROUPS_COOKIE_MAX_AGE}`;
      return next;
    });
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b px-6 py-4 group-data-[collapsible=icon]:px-2">
        <div className="flex items-center justify-between group-data-[collapsible=icon]:justify-center">
          <Link
            href={home}
            className="flex items-center gap-2 group-data-[collapsible=icon]:hidden"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Building2 className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-semibold">OpusTrack</span>
          </Link>
          <button
            type="button"
            onClick={toggleSidebar}
            className="hidden h-8 w-8 cursor-pointer items-center justify-center rounded-lg bg-primary transition-colors group-data-[collapsible=icon]:flex hover:bg-primary/90"
            aria-label="Expandir menú"
          >
            <PanelLeftOpen className="h-5 w-5 text-primary-foreground" />
          </button>
          <button
            type="button"
            onClick={toggleSidebar}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg bg-sidebar-accent text-sidebar-accent-foreground transition-colors group-data-[collapsible=icon]:hidden hover:bg-sidebar-accent/80"
            aria-label="Contraer menú"
          >
            <PanelLeftClose className="h-5 w-5" />
          </button>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-4 py-4 group-data-[collapsible=icon]:px-2">
        {groups.map((group, index) => {
          const open = !collapsed.includes(group.title);
          return (
            <div key={group.title}>
              <Collapsible
                open={open}
                onOpenChange={(next) => toggleGroup(group.title, next)}
              >
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="flex min-h-[44px] w-full cursor-pointer items-center justify-between rounded-md px-2 text-xs font-medium text-sidebar-foreground/70 transition-colors group-data-[collapsible=icon]:hidden hover:text-sidebar-foreground"
                  >
                    <span className="uppercase tracking-wide">
                      {group.title}
                    </span>
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 shrink-0 transition-transform",
                        !open && "-rotate-90",
                      )}
                      aria-hidden
                    />
                  </button>
                </CollapsibleTrigger>
                {/* forceMount keeps the links in the DOM while collapsed, so
                    role queries keep resolving them. */}
                <CollapsibleContent forceMount>
                  {group.sections.map((section) => (
                    <div key={section.title}>
                      {group.sections.length > 1 && (
                        <SidebarGroupLabel className="group-data-[collapsible=icon]:hidden">
                          {section.title}
                        </SidebarGroupLabel>
                      )}
                      <SidebarMenu>
                        {section.items.map((item) => (
                          <SidebarMenuItem key={item.url}>
                            <SidebarMenuButton
                              asChild
                              isActive={item.url === activeUrl}
                              tooltip={item.title}
                            >
                              <Link href={item.url}>
                                <item.icon className="h-4 w-4" />
                                <span>{item.title}</span>
                              </Link>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        ))}
                      </SidebarMenu>
                    </div>
                  ))}
                </CollapsibleContent>
              </Collapsible>
              {index < groups.length - 1 && <SidebarSeparator />}
            </div>
          );
        })}
      </SidebarContent>

      <SidebarFooter className="border-t p-4 group-data-[collapsible=icon]:p-2">
        <div className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center">
          <Link
            href="/profile"
            className="flex min-h-[44px] min-w-0 flex-1 items-center gap-2 rounded-md px-1 group-data-[collapsible=icon]:flex-none group-data-[collapsible=icon]:px-0"
            aria-label="Ver mi perfil"
          >
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarFallback className="bg-sidebar-accent text-xs text-sidebar-accent-foreground">
                {userInitials(session?.user?.name, session?.user?.email)}
              </AvatarFallback>
            </Avatar>
            <span className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
              <span className="block truncate text-sm font-medium">
                {session?.user?.name ?? "Usuario"}
              </span>
              <span className="block truncate text-xs text-sidebar-muted-foreground">
                {session?.user?.email ?? ""}
              </span>
            </span>
          </Link>
          <div className="shrink-0">
            <LogoutButton
              variant="ghost"
              size="icon"
              iconOnly
              className="min-h-[44px] min-w-[44px]"
            />
          </div>
        </div>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
