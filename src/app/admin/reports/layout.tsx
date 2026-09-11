import type React from "react";
import { SubnavTabs } from "@/components/common/subnav-tabs";
import { MENU } from "@/lib/navigation/menu";

/**
 * Report area sub-navigation.
 *
 * The sidebar lists only the "Reportes" index; every individual report
 * lives here as a tab, so the ten pages stay one tap away without
 * bloating the menu. Tabs the session cannot open filter themselves out.
 */
export default function ReportsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const group = MENU.find((entry) => entry.title === "Reportes");
  const tabs =
    group?.sections.flatMap((section) =>
      section.items.map((item) => ({ title: item.title, href: item.url })),
    ) ?? [];

  return (
    <div className="space-y-4">
      <SubnavTabs items={tabs} label="Reportes" />
      {children}
    </div>
  );
}
