"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "light", label: "Claro", Icon: Sun, swatch: "bg-white border" },
  { value: "dark", label: "Oscuro", Icon: Moon, swatch: "bg-black border" },
  {
    value: "opus",
    label: "Opus",
    Icon: null,
    swatch: "bg-opus-hero border-transparent",
  },
  {
    value: "system",
    label: "Sistema",
    Icon: Monitor,
    swatch: "bg-gradient-to-b from-white to-black border",
  },
] as const;

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className="h-11 w-11"
        aria-label="Cambiar tema"
      >
        <Sun className="h-4 w-4" />
      </Button>
    );
  }

  const active = OPTIONS.find((o) => o.value === theme) ?? OPTIONS[3];
  const ActiveIcon = active.Icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-11 w-11"
          aria-label="Cambiar tema"
        >
          {ActiveIcon ? (
            <ActiveIcon className="h-4 w-4" />
          ) : (
            <span
              aria-hidden
              className="h-4 w-4 rounded-full bg-opus-hero ring-1 ring-border"
            />
          )}
          <span className="sr-only">Cambiar tema</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" aria-label="Selector de tema">
        <DropdownMenuRadioGroup
          value={theme ?? "system"}
          onValueChange={setTheme}
        >
          {OPTIONS.map(({ value, label, Icon, swatch }) => (
            <DropdownMenuRadioItem
              key={value}
              value={value}
              className="min-h-[44px] gap-2"
            >
              <span
                aria-hidden
                className={cn("h-4 w-4 rounded-full border-border", swatch)}
              />
              {Icon && <Icon className="h-4 w-4" aria-hidden />}
              <span>{label}</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
