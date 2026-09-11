import type { Metadata, Viewport } from "next";
import { Outfit, Roboto } from "next/font/google";
import type React from "react";
import "./globals.css";
import { HydrationMarker } from "@/components/hydration-marker";
import { MotionProvider } from "@/components/motion/motion-provider";
import { SessionProvider } from "@/components/providers/session-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/toaster";

const roboto = Roboto({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-roboto",
});

const outfit = Outfit({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display-opus",
});

export const metadata: Metadata = {
  title: "OpusTrack - OpusInspection",
  description:
    "Sistema profesional de gestión de incidentes y seguimiento de asignaciones",
};

export const viewport: Viewport = {
  // Un solo color de marca: con dos temas elegibles, la barra del navegador
  // ya no depende de si el tema elegido coincide con el del sistema.
  themeColor: "#004851",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${roboto.variable} ${outfit.variable}`}>
        <HydrationMarker />
        <SessionProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            themes={["light", "dark"]}
            value={{ light: "light", dark: "dark" }}
          >
            <MotionProvider>
              {children}
              {/* Single viewport for every business-rule message in the app. */}
              <Toaster />
            </MotionProvider>
          </ThemeProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
