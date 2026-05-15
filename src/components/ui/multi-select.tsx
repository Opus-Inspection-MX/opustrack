"use client";

import { Check, ChevronsUpDown, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface MultiSelectOption {
  value: string;
  label: string;
  sublabel?: string;
  badge?: string;
}

interface MultiSelectProps {
  options: MultiSelectOption[];
  value: string[];
  onValueChange: (value: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  className?: string;
  maxChips?: number;
}

export function MultiSelect({
  options,
  value,
  onValueChange,
  placeholder = "Selecciona...",
  searchPlaceholder = "Buscar...",
  emptyMessage = "Sin resultados.",
  disabled = false,
  className,
  maxChips = 3,
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);

  const optionByValue = useMemo(
    () => new Map(options.map((o) => [o.value, o] as const)),
    [options],
  );

  const toggle = (val: string) => {
    if (value.includes(val)) {
      onValueChange(value.filter((v) => v !== val));
    } else {
      onValueChange([...value, val]);
    }
  };

  const removeChip = (val: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onValueChange(value.filter((v) => v !== val));
  };

  const selected = value
    .map((v) => optionByValue.get(v))
    .filter((o): o is MultiSelectOption => o !== undefined);

  const visible = selected.slice(0, maxChips);
  const overflow = selected.length - visible.length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal h-auto min-h-9 py-1.5",
            selected.length === 0 && "text-muted-foreground",
            className,
          )}
        >
          <div className="flex flex-wrap gap-1 items-center">
            {selected.length === 0 ? (
              <span>{placeholder}</span>
            ) : (
              <>
                {visible.map((o) => (
                  <Badge
                    key={o.value}
                    variant="secondary"
                    className="gap-1 pr-1"
                  >
                    <span className="truncate max-w-[140px]">{o.label}</span>
                    <button
                      type="button"
                      onClick={(e) => removeChip(o.value, e)}
                      className="hover:bg-muted-foreground/20 rounded-sm"
                      aria-label={`Quitar ${o.label}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
                {overflow > 0 && (
                  <Badge variant="outline">+{overflow} más</Badge>
                )}
              </>
            )}
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const isSelected = value.includes(option.value);
                const searchText = `${option.label} ${option.sublabel ?? ""}`;
                return (
                  <CommandItem
                    key={option.value}
                    value={searchText}
                    onSelect={() => toggle(option.value)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        isSelected ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate">{option.label}</span>
                        {option.badge && (
                          <Badge variant="outline" className="text-[10px]">
                            {option.badge}
                          </Badge>
                        )}
                      </div>
                      {option.sublabel && (
                        <div className="text-xs text-muted-foreground truncate">
                          {option.sublabel}
                        </div>
                      )}
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
