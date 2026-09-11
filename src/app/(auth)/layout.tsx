import { Building2 } from "lucide-react";
import type React from "react";

/**
 * Shared frame for the signed-out pages (login, logout, unauthorized).
 *
 * Brand panel on the left at `lg` and up, centered card below it: the form
 * pages keep their own inputs and ids untouched, only the full-screen gray
 * wrappers move here.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-opus-hero p-10 text-white lg:flex">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15">
            <Building2 className="h-6 w-6" aria-hidden />
          </div>
          <span className="text-xl font-semibold">OpusTrack</span>
        </div>
        <div className="space-y-3">
          <p className="font-display text-3xl font-semibold leading-tight">
            Incidentes, asignaciones y viajes en un solo lugar.
          </p>
          <p className="max-w-md text-white/80">
            Seguimiento de la operación de inspección vehicular en México:
            reporta fallas, atiende órdenes de trabajo y registra tus
            recorridos.
          </p>
        </div>
        <p className="text-sm text-white/60">OpusInspection · México</p>
      </aside>
      <main className="flex flex-col items-center justify-center gap-6 p-6">
        <div className="flex items-center gap-2 lg:hidden">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <Building2
              className="h-5 w-5 text-primary-foreground"
              aria-hidden
            />
          </div>
          <span className="text-lg font-semibold">OpusTrack</span>
        </div>
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}
