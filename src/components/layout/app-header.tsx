"use client";

import { ChevronLeft, Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import * as React from "react";
import { NotificationBell } from "@/components/notifications";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { breadcrumbsFor, visibleMenu } from "@/lib/navigation/menu";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";

/**
 * Breadcrumb trail for the current path.
 *
 * Never rendered with headings: every page already owns its <h1> and a
 * second one would break the heading contract the e2e suite asserts. On
 * small screens only the parent ("← Padre") shows, so the trail never
 * squeezes the search, bell, theme, and account controls out.
 */
function Breadcrumbs() {
  const pathname = usePathname();
  const { data: session } = useSession();

  const crumbs = React.useMemo(() => {
    const user = session?.user;
    if (!user) return [];
    return breadcrumbsFor(
      pathname,
      visibleMenu(
        {
          prefixes: user.routePaths ?? [],
          exact: user.exactRoutePaths ?? [],
        },
        user.isSuperuser ?? false,
        { includeHidden: true },
      ),
    );
  }, [pathname, session]);

  if (crumbs.length === 0) return null;

  const [group, ...rest] = crumbs;
  const current = rest[rest.length - 1];
  const trail = rest.slice(0, -1);
  const parent = [...trail].reverse().find((crumb) => crumb.url);

  return (
    <nav aria-label="breadcrumb" className="min-w-0 flex-1">
      {/* Mobile: parent only. */}
      {parent ? (
        <Link
          href={parent.url ?? "#"}
          className="flex min-h-[44px] items-center gap-1 text-sm text-muted-foreground lg:hidden"
        >
          <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden />
          <span className="truncate">{parent.title}</span>
        </Link>
      ) : (
        <span className="flex min-h-[44px] items-center text-sm text-muted-foreground lg:hidden">
          <span className="truncate">{current?.title ?? group.title}</span>
        </span>
      )}
      {/* Desktop: full trail. */}
      <ol className="hidden min-h-[44px] items-center gap-1 text-sm lg:flex">
        <li aria-hidden className="shrink-0 text-muted-foreground">
          {group.title}
        </li>
        {trail.map((crumb) => (
          <li key={crumb.url} className="flex min-w-0 items-center gap-1">
            <span aria-hidden className="text-muted-foreground">
              /
            </span>
            <Link
              href={crumb.url ?? "#"}
              className="truncate text-muted-foreground hover:text-foreground"
            >
              {crumb.title}
            </Link>
          </li>
        ))}
        {current && (
          <li className="flex min-w-0 items-center gap-1">
            <span aria-hidden className="text-muted-foreground">
              /
            </span>
            {current.url ? (
              <Link
                href={current.url}
                className="truncate hover:text-foreground"
              >
                {current.title}
              </Link>
            ) : (
              <span aria-current="page" className="truncate font-medium">
                {current.title}
              </span>
            )}
          </li>
        )}
      </ol>
    </nav>
  );
}

/**
 * The global header, sticky on every viewport.
 *
 * The search control is a plain button ("Búsqueda rápida"), never an input
 * and never labeled "Buscar": the tracking, errors, and catalog specs
 * assert on `searchbox` and "Buscar" and a global one would collide.
 */
export function AppHeader({ onOpenPalette }: { onOpenPalette: () => void }) {
  return (
    <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-1 border-b bg-background px-2 sm:gap-2 sm:px-4">
      <SidebarTrigger className="size-11 shrink-0 lg:hidden" />
      <Breadcrumbs />
      <Button
        type="button"
        variant="outline"
        onClick={onOpenPalette}
        aria-label="Búsqueda rápida"
        className="h-11 min-w-11 shrink-0 justify-start gap-2 px-3"
      >
        <Search className="h-4 w-4 shrink-0" aria-hidden />
        <span
          aria-hidden
          className="hidden font-normal text-muted-foreground md:inline"
        >
          Ir a…
        </span>
        <kbd
          aria-hidden
          className="hidden rounded border bg-muted px-1.5 text-[11px] text-muted-foreground lg:inline"
        >
          ⌘K
        </kbd>
      </Button>
      <NotificationBell />
      <ThemeToggle />
      <UserMenu />
    </header>
  );
}
