"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Plus } from "lucide-react";
import Link from "next/link";
import { IncidentTable } from "@/components/incidents/incident-table";
import { IncidentFilters } from "@/components/incidents/incident-filters";
import { TablePagination } from "@/components/common/table-pagination";

// Mock data - replace with actual API calls
const mockIncidents = [
  {
    id: "inc_001",
    title: "Equipment Malfunction",
    description: "Inspection equipment not working properly",
    priority: "HIGH",
    sla: 24,
    type: { name: "Technical" },
    status: { name: "Open" },
    vic: { name: "VIC Centro", code: "VIC001" },
    reportedBy: { name: "John Doe" },
    reportedAt: "2024-01-15T10:30:00Z",
    resolvedAt: null,
    workOrders: [
      {
        id: "wo_001",
        status: "IN_PROGRESS",
        assignedTo: { name: "Tech Support" },
        startedAt: "2024-01-15T11:00:00Z",
        finishedAt: null,
      },
    ],
  },
  {
    id: "inc_002",
    title: "System Outage",
    description: "Complete system failure affecting all operations",
    priority: "CRITICAL",
    sla: 4,
    type: { name: "System" },
    status: { name: "In Progress" },
    vic: { name: "VIC Norte", code: "VIC002" },
    reportedBy: { name: "Jane Smith" },
    reportedAt: "2024-01-14T14:20:00Z",
    resolvedAt: null,
    workOrders: [
      {
        id: "wo_002",
        status: "COMPLETED",
        assignedTo: { name: "System Admin" },
        startedAt: "2024-01-14T14:30:00Z",
        finishedAt: "2024-01-14T18:45:00Z",
      },
      {
        id: "wo_003",
        status: "PENDING",
        assignedTo: { name: "Network Team" },
        startedAt: null,
        finishedAt: null,
      },
    ],
  },
];

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState(mockIncidents);
  const [filteredIncidents, setFilteredIncidents] = useState(mockIncidents);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [dateFromFilter, setDateFromFilter] = useState("");
  const [dateToFilter, setDateToFilter] = useState("");
  const [dateFilterType, setDateFilterType] = useState("reportedAt");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [sortField, setSortField] = useState("reportedAt");
  const [sortDirection, setSortDirection] = useState("desc");

  // Filter and search logic
  useEffect(() => {
    const filtered = incidents.filter((incident) => {
      const matchesSearch =
        incident.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        incident.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus =
        statusFilter === "all" || incident.status.name === statusFilter;
      const matchesPriority =
        priorityFilter === "all" || incident.priority === priorityFilter;
      const matchesType =
        typeFilter === "all" || incident.type.name === typeFilter;

      // Date filtering
      let matchesDate = true;
      if (dateFromFilter || dateToFilter) {
        const incidentDate = new Date(incident[dateFilterType]);
        if (dateFromFilter) {
          const fromDate = new Date(dateFromFilter);
          matchesDate = matchesDate && incidentDate >= fromDate;
        }
        if (dateToFilter) {
          const toDate = new Date(dateToFilter);
          toDate.setHours(23, 59, 59, 999); // Include the entire day
          matchesDate = matchesDate && incidentDate <= toDate;
        }
      }

      return (
        matchesSearch &&
        matchesStatus &&
        matchesPriority &&
        matchesType &&
        matchesDate
      );
    });

    // Sort
    filtered.sort((a, b) => {
      const aValue = a[sortField];
      const bValue = b[sortField];
      const direction = sortDirection === "asc" ? 1 : -1;

      if (aValue < bValue) return -1 * direction;
      if (aValue > bValue) return 1 * direction;
      return 0;
    });

    setFilteredIncidents(filtered);
    setCurrentPage(1);
  }, [
    incidents,
    searchTerm,
    statusFilter,
    priorityFilter,
    typeFilter,
    sortField,
    sortDirection,
    dateFromFilter,
    dateToFilter,
    dateFilterType,
  ]);

  // Pagination
  const totalPages = Math.ceil(filteredIncidents.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(
    startIndex + itemsPerPage,
    filteredIncidents.length
  );
  const paginatedIncidents = filteredIncidents.slice(
    startIndex,
    startIndex + itemsPerPage
  );

  const handleDelete = (incidentId: string) => {
    if (confirm("Are you sure you want to delete this incident?")) {
      setIncidents(incidents.filter((inc) => inc.id !== incidentId));
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Incident Management</h1>
          <p className="text-muted-foreground">
            Manage and track all incidents and work orders
          </p>
        </div>
        <Link href="/admin/incidents/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Incident
          </Button>
        </Link>
      </div>

      <IncidentFilters
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        priorityFilter={priorityFilter}
        setPriorityFilter={setPriorityFilter}
        typeFilter={typeFilter}
        setTypeFilter={setTypeFilter}
        dateFromFilter={dateFromFilter}
        setDateFromFilter={setDateFromFilter}
        dateToFilter={dateToFilter}
        setDateToFilter={setDateToFilter}
        dateFilterType={dateFilterType}
        setDateFilterType={setDateFilterType}
        sortField={sortField}
        setSortField={setSortField}
        sortDirection={sortDirection}
        setSortDirection={setSortDirection}
      />

      <Card>
        <CardHeader>
          <CardTitle>Incidents ({filteredIncidents.length})</CardTitle>
          <CardDescription>
            Showing {startIndex + 1}-{endIndex} of {filteredIncidents.length}{" "}
            incidents
          </CardDescription>
        </CardHeader>
        <CardContent>
          <IncidentTable
            incidents={paginatedIncidents}
            onDelete={handleDelete}
          />
          <TablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            itemsPerPage={itemsPerPage}
            totalItems={filteredIncidents.length}
            onPageChange={setCurrentPage}
            onItemsPerPageChange={(newItemsPerPage) => {
              setItemsPerPage(newItemsPerPage);
              setCurrentPage(1);
            }}
            startIndex={startIndex}
            endIndex={endIndex}
          />
        </CardContent>
      </Card>
    </div>
  );
}
