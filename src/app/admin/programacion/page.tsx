"use client"

import { useState } from "react"
import { Calendar, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScheduleCalendar } from "@/components/programacion/schedule-calendar"
import { ScheduleActivities } from "@/components/programacion/schedule-activities"
import { CreateScheduleDialog } from "@/components/programacion/create-schedule-dialog"

export default function ProgramacionPage() {
  const [selectedDateRange, setSelectedDateRange] = useState<{
    start: Date
    end: Date
    type: "day" | "week" | "month"
  }>({
    start: new Date(),
    end: new Date(),
    type: "day"
  })
  const [createDialogOpen, setCreateDialogOpen] = useState(false)

  return (
    <div className="space-y-4 h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
            <Calendar className="h-5 w-5 text-purple-500" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Programación</h1>
            <p className="text-muted-foreground">
              Gestiona y programa actividades, calibraciones y mantenimientos
            </p>
          </div>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nueva Programación
        </Button>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-[calc(100vh-12rem)]">
        {/* Left: Activities */}
        <div className="overflow-auto">
          <ScheduleActivities dateRange={selectedDateRange} />
        </div>

        {/* Right: Calendar */}
        <div className="overflow-auto">
          <ScheduleCalendar
            dateRange={selectedDateRange}
            onDateRangeChange={setSelectedDateRange}
          />
        </div>
      </div>

      {/* Create Schedule Dialog */}
      <CreateScheduleDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        dateRange={selectedDateRange}
      />
    </div>
  )
}
