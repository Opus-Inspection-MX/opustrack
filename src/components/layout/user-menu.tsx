"use client";

import { Check, LogOut, Monitor, Moon, Sun, UserRound } from "lucide-react";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { useTheme } from "next-themes";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const THEME_OPTIONS = [
  { value: "light", label: "Claro", Icon: Sun },
  { value: "dark", label: "Oscuro", Icon: Moon },
  { value: "opus", label: "Opus", Icon: null },
  { value: "system", label: "Sistema", Icon: Monitor },
] as const;

/** Initials for the avatar: "María López" → "ML", no name → email prefix. */
export function userInitials(name?: string | null, email?: string | null) {
  const fromName = (name ?? "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
  if (fromName) return fromName;
  return (email ?? "").slice(0, 2).toUpperCase() || "?";
}

/**
 * The account menu in the global header: profile, theme, sign out.
 *
 * It carries no navigation links besides Perfil, so roles with narrow
 * grants (ADMIN_VACACIONES) never see "Roles", "Usuarios" or "Incidentes"
 * leaking through the header.
 */
export function UserMenu() {
  const { data: session } = useSession();
  const { theme, setTheme } = useTheme();
  const user = session?.user;
  const activeTheme = theme ?? "system";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-11 w-11 rounded-full"
          aria-label="Menú de usuario"
        >
          <Avatar className="h-9 w-9">
            <AvatarFallback>
              {userInitials(user?.name, user?.email)}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="font-normal">
          <span className="flex flex-col gap-0.5">
            <span className="font-medium leading-tight">
              {user?.name ?? "Usuario"}
            </span>
            {user?.email && (
              <span className="truncate text-xs text-muted-foreground">
                {user.email}
              </span>
            )}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="min-h-[44px]">
          <Link href="/profile">
            <UserRound className="h-4 w-4" aria-hidden />
            <span>Perfil</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="min-h-[44px]">
            <span
              aria-hidden
              className="h-4 w-4 rounded-full bg-opus-hero ring-1 ring-border"
            />
            <span>Tema</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent aria-label="Tema">
            {THEME_OPTIONS.map(({ value, label, Icon }) => (
              <DropdownMenuItem
                key={value}
                onClick={() => setTheme(value)}
                className="min-h-[44px]"
              >
                {Icon ? (
                  <Icon className="h-4 w-4" aria-hidden />
                ) : (
                  <span
                    aria-hidden
                    className="h-4 w-4 rounded-full bg-opus-hero ring-1 ring-border"
                  />
                )}
                <span>{label}</span>
                {activeTheme === value && (
                  <Check className="ml-auto h-4 w-4" aria-hidden />
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="min-h-[44px]"
        >
          <LogOut className="h-4 w-4" aria-hidden />
          <span>Cerrar sesión</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
