"use client"

import { useState } from "react"
import { Search, Filter, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface WorkPartFiltersProps {
  onFiltersChange: (filters: {
    search: string
    partId: string
    workOrderStatus: string
    active: string
  }) => void
}

export function WorkPartFilters({ onFiltersChange }: WorkPartFiltersProps) {
  const [search, setSearch] = useState("")
  const [partId, setPartId] = useState("all")
  const [workOrderStatus, setWorkOrderStatus] = useState("all")
  const [active, setActive] = useState("all")

  const mockParts = [
    { id: "part_001", name: "Brake Pad Set" },
    { id: "part_002", name: "Oil Filter" },
    { id: "part_003", name: "Air Filter" },
    { id: "part_004", name: "Spark Plugs" },
  ]

  const workOrderStatuses = [
    { value: "pending", label: "Pending" },
    { value: "in_progress", label: "In Progress" },
    { value: "completed", label: "Completed" },
    { value: "cancelled", label: "Cancelled" },
  ]

  const handleFiltersChange = () => {
    onFiltersChange({
      search,
      partId,
      workOrderStatus,
      active,
    })
  }

  const clearAllFilters = () => {
    setSearch("")
    setPartId("all")
    setWorkOrderStatus("all")
    setActive("all")
    onFiltersChange({
      search: "",
      partId: "all",
      workOrderStatus: "all",
      active: "all",
    })
  }

  const getActiveFilterCount = () => {
    let count = 0
    if (search) count++
    if (partId !== "all") count++
    if (workOrderStatus !== "all") count++
    if (active !== "all") count++
    return count
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="h-4 w-4" />
          <span className="font-medium">Filters</span>
          {getActiveFilterCount() > 0 && <Badge variant="secondary">{getActiveFilterCount()} active</Badge>}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search parts..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  handleFiltersChange()
                }}
                className="pl-10"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Part</label>
            <Select
              value={partId}
              onValueChange={(value) => {
                setPartId(value)
                handleFiltersChange()
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="All parts" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All parts</SelectItem>
                {mockParts.map((part) => (
                  <SelectItem key={part.id} value={part.id}>
                    {part.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Work Order Status</label>
            <Select
              value={workOrderStatus}
              onValueChange={(value) => {
                setWorkOrderStatus(value)
                handleFiltersChange()
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {workOrderStatuses.map((status) => (
                  <SelectItem key={status.value} value={status.value}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Status</label>
            <Select
              value={active}
              onValueChange={(value) => {
                setActive(value)
                handleFiltersChange()
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="true">Active</SelectItem>
                <SelectItem value="false">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {getActiveFilterCount() > 0 && (
          <div className="flex justify-end mt-4">
            <Button variant="outline" size="sm" onClick={clearAllFilters}>
              <X className="mr-2 h-4 w-4" />
              Clear All Filters
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
