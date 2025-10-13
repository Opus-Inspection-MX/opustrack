"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Menu, Building2 } from "lucide-react"
import { AdminSidebar } from "./admin-sidebar"

export function MobileNavbar() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <nav className="lg:hidden flex items-center justify-between border-b bg-background px-4 h-16 sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setOpen(true)}>
            <Menu className="h-5 w-5" />
            <span className="sr-only">Open menu</span>
          </Button>
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            <span className="font-semibold">OpusTrack</span>
          </div>
        </div>
      </nav>
      <AdminSidebar open={open} onOpenChange={setOpen} isMobile={true} />
    </>
  )
}
