"use client";

import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import * as React from "react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { flattenMenu, visibleMenu } from "@/lib/navigation/menu";
import { quickActions } from "@/lib/navigation/quick-actions";

/**
 * The global command palette (⌘K).
 *
 * It navigates to any page the session can open — sidebar-hidden report
 * pages included — plus the creation shortcuts the role is granted. Closed
 * by default, so the `getByRole("dialog")` specs never see it, and the
 * input lives only inside the dialog, never as a global searchbox.
 */
export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const { data: session } = useSession();

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        onOpenChange(!open);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange]);

  const { pages, actions } = React.useMemo(() => {
    const user = session?.user;
    if (!user) return { pages: [], actions: [] };
    const grants = {
      prefixes: user.routePaths ?? [],
      exact: user.exactRoutePaths ?? [],
    };
    const superuser = user.isSuperuser ?? false;
    return {
      pages: flattenMenu(
        visibleMenu(grants, superuser, { includeHidden: true }),
      ),
      actions: quickActions(grants, superuser),
    };
  }, [session]);

  const go = React.useCallback(
    (url: string) => {
      onOpenChange(false);
      router.push(url);
    },
    [onOpenChange, router],
  );

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Búsqueda rápida"
      description="Ir a una página o ejecutar una acción"
    >
      <CommandInput placeholder="Ir a una página o acción…" />
      <CommandList>
        <CommandEmpty>Sin resultados para esa búsqueda.</CommandEmpty>
        <CommandGroup heading="Páginas">
          {pages.map((page) => (
            <CommandItem
              key={page.url}
              value={`${page.group} ${page.section} ${page.title} ${(page.keywords ?? []).join(" ")}`}
              onSelect={() => go(page.url)}
              className="min-h-[44px]"
            >
              <page.icon className="h-4 w-4 shrink-0" aria-hidden />
              <span className="flex flex-col">
                <span>{page.title}</span>
                {page.description && (
                  <span className="text-xs text-muted-foreground">
                    {page.description}
                  </span>
                )}
              </span>
            </CommandItem>
          ))}
        </CommandGroup>
        {actions.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Acciones">
              {actions.map((action) => (
                <CommandItem
                  key={action.url}
                  value={action.title}
                  onSelect={() => go(action.url)}
                  className="min-h-[44px]"
                >
                  <action.icon className="h-4 w-4 shrink-0" aria-hidden />
                  <span className="flex flex-col">
                    <span>{action.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {action.description}
                    </span>
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
