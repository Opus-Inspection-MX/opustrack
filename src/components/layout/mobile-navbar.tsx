"use client";

import { Building2 } from "lucide-react";

export function MobileNavbar() {
  return (
    <nav className="lg:hidden flex items-center justify-between border-b bg-background px-4 h-16 sticky top-0 z-40">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          <span className="font-semibold">OpusTrack</span>
        </div>
      </div>
    </nav>
  );
}
