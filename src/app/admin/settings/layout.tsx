import type React from "react";
import { SubnavTabs } from "@/components/common/subnav-tabs";

const SETTINGS_TABS = [
  { title: "Estado de Equipo", href: "/admin/settings/equipment-status" },
  { title: "Estado de Vehículo", href: "/admin/settings/vehicle-status" },
  { title: "Estado de Asignación", href: "/admin/settings/assignment-status" },
  {
    title: "Estado de Viaje Vehicular",
    href: "/admin/settings/vehicle-trip-status",
  },
  { title: "Días de Vacaciones", href: "/admin/settings/vacation-accrual" },
  { title: "Canales de Notificación", href: "/admin/settings/notifications" },
];

/**
 * Settings area sub-navigation.
 *
 * Replaces the grid of link cards on the index: every status catalog stays
 * one tap away on every settings page. Tabs the session cannot open filter
 * themselves out.
 */
export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <SubnavTabs items={SETTINGS_TABS} label="Configuración" />
      {children}
    </div>
  );
}
