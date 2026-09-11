"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import * as React from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { canAccessRoute } from "@/lib/authz/route-access";

export interface SubnavTab {
  title: string;
  href: string;
}

/**
 * Tab sub-navigation for an area index and its children.
 *
 * Replaces the grids of link cards: every child stays one tap away without
 * pushing the content down. Tabs the session cannot open are filtered out,
 * and the active tab is the longest href prefix of the current path. The
 * list scrolls horizontally on small screens instead of wrapping.
 */
export function SubnavTabs({
  items,
  label,
}: {
  items: readonly SubnavTab[];
  label: string;
}) {
  const pathname = usePathname();
  const { data: session } = useSession();

  const visible = React.useMemo(() => {
    const user = session?.user;
    if (!user) return [];
    const grants = {
      prefixes: user.routePaths ?? [],
      exact: user.exactRoutePaths ?? [],
    };
    const superuser = user.isSuperuser ?? false;
    return items.filter((item) => canAccessRoute(grants, superuser, item.href));
  }, [session, items]);

  const active = React.useMemo(() => {
    const matches = visible.filter(
      (item) =>
        pathname === item.href ||
        pathname.startsWith(`${item.href.replace(/\/$/, "")}/`),
    );
    return matches.sort((a, b) => b.href.length - a.href.length)[0]?.href;
  }, [visible, pathname]);

  if (visible.length === 0) return null;

  return (
    <Tabs value={active ?? visible[0].href} aria-label={label}>
      <TabsList className="h-auto w-full justify-start overflow-x-auto">
        {visible.map((item) => (
          <TabsTrigger key={item.href} value={item.href} asChild>
            <Link href={item.href} className="min-h-[44px] shrink-0">
              {item.title}
            </Link>
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
