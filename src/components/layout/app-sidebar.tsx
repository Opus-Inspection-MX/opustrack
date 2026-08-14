"use client";

import { Building2, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useMemo } from "react";
import { LogoutButton } from "@/components/auth/logout-button";
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
  SidebarRail,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import { visibleMenu } from "@/lib/navigation/menu";
import { ThemeToggle } from "./theme-toggle";

/**
 * The single navigation sidebar.
 *
 * It replaces four static per-portal sidebars that listed their contents
 * unconditionally. What a user sees is now derived from the route grants in
 * their session, so someone holding ADMIN_VACACIONES + FSR gets one menu with
 * both — and without the operations or user-administration sections they cannot
 * open anyway.
 */
export function AppSidebar() {
  const pathname = usePathname();
  const { toggleSidebar } = useSidebar();
  const { data: session } = useSession();

  const sections = useMemo(() => {
    const user = session?.user;
    if (!user) return [];
    return visibleMenu(
      { prefixes: user.routePaths ?? [], exact: user.exactRoutePaths ?? [] },
      user.isSuperuser ?? false,
    );
  }, [session]);

  const home = session?.user?.defaultPath ?? "/";

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b px-6 py-4 group-data-[collapsible=icon]:px-2">
        <div className="flex items-center justify-between group-data-[collapsible=icon]:justify-center">
          <Link
            href={home}
            className="flex items-center gap-2 group-data-[collapsible=icon]:hidden"
          >
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <Building2 className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-semibold">OpusTrack</span>
          </Link>
          <button
            type="button"
            onClick={toggleSidebar}
            className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center hover:bg-primary/90 transition-colors cursor-pointer hidden group-data-[collapsible=icon]:flex"
            aria-label="Expandir menú"
          >
            <PanelLeftOpen className="h-5 w-5 text-primary-foreground" />
          </button>
          <button
            type="button"
            onClick={toggleSidebar}
            className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors cursor-pointer group-data-[collapsible=icon]:hidden"
            aria-label="Contraer menú"
          >
            <PanelLeftClose className="h-5 w-5" />
          </button>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-4 py-4 group-data-[collapsible=icon]:px-2">
        {sections.map((section, index) => (
          <div key={section.title}>
            <SidebarGroup>
              <SidebarGroupLabel>{section.title}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {section.items.map((item) => (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton
                        asChild
                        isActive={
                          pathname === item.url ||
                          pathname.startsWith(`${item.url}/`)
                        }
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
              </SidebarGroupContent>
            </SidebarGroup>
            {index < sections.length - 1 && <SidebarSeparator />}
          </div>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t p-4 group-data-[collapsible=icon]:p-2">
        <div className="flex flex-col gap-2 group-data-[collapsible=icon]:items-center">
          <ThemeToggle />
          <div className="w-full group-data-[collapsible=icon]:w-auto">
            <LogoutButton
              variant="outline"
              size="sm"
              className="w-full bg-transparent group-data-[collapsible=icon]:hidden"
            />
            <LogoutButton
              variant="outline"
              size="icon"
              className="hidden group-data-[collapsible=icon]:flex"
              iconOnly
            />
          </div>
        </div>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
