import type { Metadata, Viewport } from "next";
import { Outfit, Roboto } from "next/font/google";
import type React from "react";
import "./globals.css";
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
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${roboto.variable} ${outfit.variable}`}>
        <SessionProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            themes={["light", "dark", "opus"]}
            value={{ light: "light", dark: "dark", opus: "opus" }}
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
