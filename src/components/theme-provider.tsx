"use client";
import type { ThemeProviderProps } from "next-themes";
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";
import { useEffect } from "react";

/**
 * Migra la preferencia guardada del tema Opus (eliminado) a Claro.
 *
 * Con un valor que ya no está en `themes`, next-themes pone la clase `opus`
 * — que ya no tiene CSS — y el selector no marca nada. Opus era un tema
 * claro, así que `light` es la migración natural.
 */
function OpusThemeMigration() {
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    if (theme === "opus") setTheme("light");
  }, [theme, setTheme]);

  return null;
}

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider {...props}>
      <OpusThemeMigration />
      {children}
    </NextThemesProvider>
  );
}
