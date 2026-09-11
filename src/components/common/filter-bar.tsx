"use client";

import { ListFilter } from "lucide-react";
import type React from "react";
import { StaggerGroup, StaggerItem } from "@/components/motion/stagger";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

interface FilterBarProps {
  children: React.ReactNode;
  /** Active filter count shown in the mobile trigger. */
  activeCount?: number;
  onClear?: () => void;
  title?: string;
}

/**
 * Inline filters on desktop, bottom sheet on mobile.
 *
 * The trigger reads "Filtros (n)" — never "Buscar", which collides with
 * e2e `getByRole("button", { name: "Buscar" })` lookups.
 */
export function FilterBar({
  children,
  activeCount = 0,
  onClear,
  title = "Filtros",
}: FilterBarProps) {
  return (
    <div>
      <div className="hidden flex-wrap items-end gap-3 md:flex">{children}</div>
      <div className="md:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" className="min-h-[44px] w-full sm:w-auto">
              <ListFilter className="h-4 w-4" aria-hidden />
              {title}
              {activeCount > 0 && (
                <span
                  aria-hidden="true"
                  className="bg-primary text-primary-foreground ml-1 rounded-full px-2 py-0.5 text-xs font-semibold"
                >
                  {activeCount}
                </span>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent
            side="bottom"
            className="max-h-[85vh] overflow-y-auto"
            aria-label={title}
          >
            <SheetHeader className="text-left">
              <SheetTitle>{title}</SheetTitle>
              <SheetDescription>
                Ajusta los filtros para refinar los resultados.
              </SheetDescription>
            </SheetHeader>
            <StaggerGroup className="grid gap-4 py-4">
              <StaggerItem>{children}</StaggerItem>
            </StaggerGroup>
            <SheetFooter className="flex-col gap-2 sm:flex-col">
              {onClear && (
                <Button
                  variant="outline"
                  onClick={onClear}
                  className="min-h-[44px] w-full"
                >
                  Limpiar filtros
                </Button>
              )}
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}
