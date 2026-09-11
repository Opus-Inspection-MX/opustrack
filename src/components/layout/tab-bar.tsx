"use client";

import { Home, Menu, Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import * as React from "react";
import { useSidebar } from "@/components/ui/sidebar";
import { flattenMenu, visibleMenu } from "@/lib/navigation/menu";
import { cn } from "@/lib/utils";

/**
 * The mobile tab bar: four shortcuts, nothing more.
 *
 * Inicio goes home, Búsqueda opens the palette, the third tab is the
 * role's priority destination from the menu registry (Mis Asignaciones
 * for FSR, Reportar for REPORTER, Seguimiento for ADMIN_OPERACION), and
 * Más opens the full sidebar as a drawer. Labels are navigation
 * destinations only — never page-action names like "Reintentar" or
 * "Iniciar trabajo", which the offline specs assert on.
 */
export function TabBar({ onOpenPalette }: { onOpenPalette: () => void }) {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  const { data: session } = useSession();
  const home = session?.user?.defaultPath ?? "/";

  const third = React.useMemo(() => {
    const user = session?.user;
    if (!user) return null;
    const items = flattenMenu(
      visibleMenu(
        {
          prefixes: user.routePaths ?? [],
          exact: user.exactRoutePaths ?? [],
        },
        user.isSuperuser ?? false,
      ),
    ).filter((item) => item.url !== home);
    if (items.length === 0) return null;
    const ranked = items.filter((item) => item.mobilePriority !== undefined);
    const pool = ranked.length > 0 ? ranked : items;
    return pool.sort(
      (a, b) => (a.mobilePriority ?? 99) - (b.mobilePriority ?? 99),
    )[0];
  }, [session, home]);

  const cell =
    "flex min-h-16 flex-col items-center justify-center gap-0.5 text-[11px] leading-tight";

  return (
    <nav
      aria-label="Navegación principal"
      className="fixed inset-x-0 bottom-0 z-30 border-t bg-background lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className={cn("grid", third ? "grid-cols-4" : "grid-cols-3")}>
        <Link
          href={home}
          aria-current={pathname === home ? "page" : undefined}
          className={cn(
            cell,
            pathname === home ? "text-primary" : "text-muted-foreground",
          )}
        >
          <Home className="h-5 w-5" aria-hidden />
          <span>Inicio</span>
        </Link>
        <button
          type="button"
          onClick={onOpenPalette}
          className={cn(cell, "text-muted-foreground")}
        >
          <Search className="h-5 w-5" aria-hidden />
          <span>Búsqueda</span>
        </button>
        {third && (
          <Link
            href={third.url}
            aria-current={
              pathname === third.url ||
              pathname.startsWith(`${third.url.replace(/\/$/, "")}/`)
                ? "page"
                : undefined
            }
            className={cn(
              cell,
              "px-1 text-center",
              pathname === third.url ||
                pathname.startsWith(`${third.url.replace(/\/$/, "")}/`)
                ? "text-primary"
                : "text-muted-foreground",
            )}
          >
            <third.icon className="h-5 w-5" aria-hidden />
            <span className="max-w-full truncate">{third.title}</span>
          </Link>
        )}
        <button
          type="button"
          onClick={() => setOpenMobile(true)}
          className={cn(cell, "text-muted-foreground")}
        >
          <Menu className="h-5 w-5" aria-hidden />
          <span>Más</span>
        </button>
      </div>
    </nav>
  );
}
