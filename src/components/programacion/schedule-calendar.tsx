"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface ScheduleCalendarProps {
  dateRange: {
    start: Date
    end: Date
    type: "day" | "week" | "month"
  }
  onDateRangeChange: (range: { start: Date; end: Date; type: "day" | "week" | "month" }) => void
}

export function ScheduleCalendar({ dateRange, onDateRangeChange }: ScheduleCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<"day" | "week" | "month">(dateRange.type)

  // Helper functions
  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  }

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay()
  }

  const getMonthName = (date: Date) => {
    return date.toLocaleDateString("es-MX", { month: "long", year: "numeric" })
  }

  const getWeekDays = () => {
    return ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]
  }

  const getWeekRange = (date: Date) => {
    const day = date.getDay()
    const diff = date.getDate() - day
    const start = new Date(date.setDate(diff))
    const end = new Date(date.setDate(diff + 6))
    return { start, end }
  }

  const navigateMonth = (direction: "prev" | "next") => {
    const newDate = new Date(currentDate)
    newDate.setMonth(currentDate.getMonth() + (direction === "next" ? 1 : -1))
    setCurrentDate(newDate)
  }

  const navigateWeek = (direction: "prev" | "next") => {
    const newDate = new Date(currentDate)
    newDate.setDate(currentDate.getDate() + (direction === "next" ? 7 : -7))
    setCurrentDate(newDate)
  }

  const navigateDay = (direction: "prev" | "next") => {
    const newDate = new Date(currentDate)
    newDate.setDate(currentDate.getDate() + (direction === "next" ? 1 : -1))
    setCurrentDate(newDate)
  }

  const handleNavigate = (direction: "prev" | "next") => {
    if (viewMode === "month") navigateMonth(direction)
    else if (viewMode === "week") navigateWeek(direction)
    else navigateDay(direction)
  }

  const handleViewModeChange = (mode: string) => {
    const newMode = mode as "day" | "week" | "month"
    setViewMode(newMode)

    let start = new Date(currentDate)
    let end = new Date(currentDate)

    if (newMode === "week") {
      const range = getWeekRange(new Date(currentDate))
      start = range.start
      end = range.end
    } else if (newMode === "month") {
      start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
      end = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)
    }

    onDateRangeChange({ start, end, type: newMode })
  }

  const handleDateClick = (date: Date) => {
    let start = new Date(date)
    let end = new Date(date)
    let type: "day" | "week" | "month" = "day"

    if (viewMode === "week") {
      const range = getWeekRange(new Date(date))
      start = range.start
      end = range.end
      type = "week"
    } else if (viewMode === "month") {
      start = new Date(date.getFullYear(), date.getMonth(), 1)
      end = new Date(date.getFullYear(), date.getMonth() + 1, 0)
      type = "month"
    }

    setCurrentDate(date)
    onDateRangeChange({ start, end, type })
  }

  // Render month view
  const renderMonthView = () => {
    const daysInMonth = getDaysInMonth(currentDate)
    const firstDay = getFirstDayOfMonth(currentDate)
    const days = []

    // Add empty cells for days before month starts
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="p-2" />)
    }

    // Add days of month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day)
      const isToday = date.toDateString() === new Date().toDateString()
      const isSelected = date.toDateString() === currentDate.toDateString()

      days.push(
        <button
          key={day}
          onClick={() => handleDateClick(date)}
          className={`p-2 text-sm rounded-lg hover:bg-accent transition-colors ${
            isToday ? "bg-purple-500/10 text-purple-600 font-semibold" : ""
          } ${isSelected ? "ring-2 ring-purple-500" : ""}`}
        >
          <div className="flex flex-col items-center">
            <span>{day}</span>
            {/* Mock scheduled items indicator */}
            {day % 5 === 0 && (
              <div className="flex gap-1 mt-1">
                <div className="w-1 h-1 rounded-full bg-blue-500" />
                <div className="w-1 h-1 rounded-full bg-orange-500" />
              </div>
            )}
          </div>
        </button>
      )
    }

    return (
      <div className="grid grid-cols-7 gap-1">
        {getWeekDays().map(day => (
          <div key={day} className="p-2 text-xs font-medium text-center text-muted-foreground">
            {day}
          </div>
        ))}
        {days}
      </div>
    )
  }

  // Render week view
  const renderWeekView = () => {
    const weekRange = getWeekRange(new Date(currentDate))
    const days = []

    for (let i = 0; i < 7; i++) {
      const date = new Date(weekRange.start)
      date.setDate(weekRange.start.getDate() + i)
      const isToday = date.toDateString() === new Date().toDateString()
      const isSelected = date.toDateString() === currentDate.toDateString()

      days.push(
        <button
          key={i}
          onClick={() => handleDateClick(date)}
          className={`p-4 rounded-lg border hover:bg-accent transition-colors ${
            isToday ? "bg-purple-500/10 border-purple-500" : ""
          } ${isSelected ? "ring-2 ring-purple-500" : ""}`}
        >
          <div className="text-xs text-muted-foreground">{getWeekDays()[i]}</div>
          <div className="text-2xl font-bold mt-1">{date.getDate()}</div>
          <div className="mt-2 space-y-1">
            {/* Mock scheduled items */}
            {date.getDate() % 5 === 0 && (
              <>
                <div className="text-xs bg-blue-500/10 text-blue-600 px-2 py-1 rounded">
                  3 Incidentes
                </div>
                <div className="text-xs bg-orange-500/10 text-orange-600 px-2 py-1 rounded">
                  1 Calibración
                </div>
              </>
            )}
          </div>
        </button>
      )
    }

    return <div className="grid grid-cols-7 gap-2">{days}</div>
  }

  // Render day view
  const renderDayView = () => {
    const hours = Array.from({ length: 24 }, (_, i) => i)
    const isToday = currentDate.toDateString() === new Date().toDateString()

    return (
      <div className="space-y-4">
        <div className={`p-4 rounded-lg border ${isToday ? "bg-purple-500/10 border-purple-500" : ""}`}>
          <div className="text-sm text-muted-foreground">
            {currentDate.toLocaleDateString("es-MX", { weekday: "long" })}
          </div>
          <div className="text-3xl font-bold mt-1">
            {currentDate.toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" })}
          </div>
        </div>

        <div className="space-y-2 max-h-96 overflow-y-auto">
          {hours.map(hour => (
            <div key={hour} className="flex gap-4 items-start">
              <div className="w-16 text-sm text-muted-foreground pt-2">
                {hour.toString().padStart(2, "0")}:00
              </div>
              <div className="flex-1 border-l-2 pl-4 py-2 min-h-[60px]">
                {/* Mock scheduled items */}
                {hour === 9 && (
                  <div className="bg-blue-500/10 border-l-4 border-blue-500 p-2 rounded">
                    <div className="font-medium text-sm">Calibración - VIC CDMX Norte</div>
                    <div className="text-xs text-muted-foreground">FSR: Juan Pérez</div>
                  </div>
                )}
                {hour === 14 && (
                  <div className="bg-orange-500/10 border-l-4 border-orange-500 p-2 rounded">
                    <div className="font-medium text-sm">Mantenimiento Preventivo</div>
                    <div className="text-xs text-muted-foreground">FSR: María González</div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="capitalize">{getMonthName(currentDate)}</CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => handleNavigate("prev")}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleDateClick(new Date())}>
              Hoy
            </Button>
            <Button variant="outline" size="icon" onClick={() => handleNavigate("next")}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <Tabs value={viewMode} onValueChange={handleViewModeChange} className="mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="month">Mes</TabsTrigger>
            <TabsTrigger value="week">Semana</TabsTrigger>
            <TabsTrigger value="day">Día</TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent>
        {viewMode === "month" && renderMonthView()}
        {viewMode === "week" && renderWeekView()}
        {viewMode === "day" && renderDayView()}

        {/* Legend */}
        <div className="mt-6 pt-4 border-t space-y-2">
          <div className="text-xs font-medium text-muted-foreground">Leyenda</div>
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <span className="text-xs">Incidentes</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-orange-500" />
              <span className="text-xs">Calibraciones</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="text-xs">Mantenimientos</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
