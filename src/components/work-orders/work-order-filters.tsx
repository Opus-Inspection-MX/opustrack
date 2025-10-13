"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, Filter } from "lucide-react"

interface WorkOrderFiltersProps {
  searchTerm: string
  setSearchTerm: (value: string) => void
  statusFilter: string
  setStatusFilter: (value: string) => void
  assigneeFilter: string
  setAssigneeFilter: (value: string) => void
  dateFromFilter: string
  setDateFromFilter: (value: string) => void
  dateToFilter: string
  setDateToFilter: (value: string) => void
  dateFilterType: string
  setDateFilterType: (value: string) => void
  sortField: string
  setSortField: (value: string) => void
  sortDirection: string
  setSortDirection: (value: string) => void
  uniqueAssignees: string[]
}

export function WorkOrderFilters({
  searchTerm,
  setSearchTerm,
  statusFilter,
  setStatusFilter,
  assigneeFilter,
  setAssigneeFilter,
  dateFromFilter,
  setDateFromFilter,
  dateToFilter,
  setDateToFilter,
  dateFilterType,
  setDateFilterType,
  sortField,
  setSortField,
  sortDirection,
  setSortDirection,
  uniqueAssignees,
}: WorkOrderFiltersProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Filter className="h-5 w-5" />
          Filters & Search
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search work orders..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Assignee" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Assignees</SelectItem>
                {uniqueAssignees.map((assignee) => (
                  <SelectItem key={assignee} value={assignee}>
                    {assignee}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={`${sortField}-${sortDirection}`}
              onValueChange={(value) => {
                const [field, direction] = value.split("-")
                setSortField(field)
                setSortDirection(direction)
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="createdAt-desc">Latest First</SelectItem>
                <SelectItem value="createdAt-asc">Oldest First</SelectItem>
                <SelectItem value="startedAt-desc">Started Latest</SelectItem>
                <SelectItem value="startedAt-asc">Started Earliest</SelectItem>
                <SelectItem value="incident.title-asc">Incident A-Z</SelectItem>
                <SelectItem value="assignedTo.name-asc">Assignee A-Z</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Date Filters Row */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4 border-t">
            <Select value={dateFilterType} onValueChange={setDateFilterType}>
              <SelectTrigger>
                <SelectValue placeholder="Date Filter Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="createdAt">Created Date</SelectItem>
                <SelectItem value="startedAt">Started Date</SelectItem>
                <SelectItem value="finishedAt">Finished Date</SelectItem>
                <SelectItem value="updatedAt">Updated Date</SelectItem>
              </SelectContent>
            </Select>
            <div className="space-y-1">
              <Label htmlFor="dateFrom" className="text-xs text-muted-foreground">
                From Date
              </Label>
              <Input
                id="dateFrom"
                type="date"
                value={dateFromFilter}
                onChange={(e) => setDateFromFilter(e.target.value)}
                placeholder="From date"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="dateTo" className="text-xs text-muted-foreground">
                To Date
              </Label>
              <Input
                id="dateTo"
                type="date"
                value={dateToFilter}
                onChange={(e) => setDateToFilter(e.target.value)}
                placeholder="To date"
              />
            </div>
            {/* Clear All Filters Button */}
            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={() => {
                  setSearchTerm("")
                  setStatusFilter("all")
                  setAssigneeFilter("all")
                  setDateFromFilter("")
                  setDateToFilter("")
                  setDateFilterType("createdAt")
                  setSortField("createdAt")
                  setSortDirection("desc")
                }}
                className="w-full"
              >
                Clear All Filters
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
