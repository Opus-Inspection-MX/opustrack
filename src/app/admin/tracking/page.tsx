"use client"

import { useState, useEffect } from "react"
import { TrackingFilters } from "@/components/tracking/tracking-filters"
import { TrackingTable } from "@/components/tracking/tracking-table"
import { getIncidentsForTracking, getFSRsByVicId } from "@/lib/actions/tracking"
import { getVICs } from "@/lib/actions/vics"
import { getIncidentTypes, getIncidentStatuses } from "@/lib/actions/lookups"
import { Loader2, ClipboardList, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export default function TrackingPage() {
  const [incidents, setIncidents] = useState<any[]>([])
  const [vics, setVics] = useState<any[]>([])
  const [incidentTypes, setIncidentTypes] = useState<any[]>([])
  const [incidentStatuses, setIncidentStatuses] = useState<any[]>([])
  const [allFsrs, setAllFsrs] = useState<any[]>([])
  const [fsrsByVic, setFsrsByVic] = useState<Record<string, any[]>>({})
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<any>({})

  useEffect(() => {
    loadInitialData()
  }, [])

  useEffect(() => {
    loadIncidents(filters)
  }, [filters])

  const loadInitialData = async () => {
    try {
      const today = new Date().toISOString().split('T')[0]

      const [vicsData, typesData, statusesData] = await Promise.all([
        getVICs(),
        getIncidentTypes(),
        getIncidentStatuses(),
      ])

      setVics(vicsData)
      setIncidentTypes(typesData)
      setIncidentStatuses(statusesData)

      // Load FSRs for each VIC
      const fsrsMap: Record<string, any[]> = {}
      const allFsrsArray: any[] = []

      for (const vic of vicsData) {
        try {
          const vicFsrs = await getFSRsByVicId(vic.id)
          fsrsMap[vic.id] = vicFsrs
          allFsrsArray.push(...vicFsrs)
        } catch (error) {
          console.error(`Error loading FSRs for VIC ${vic.id}:`, error)
          fsrsMap[vic.id] = []
        }
      }

      setFsrsByVic(fsrsMap)
      // Remove duplicates from allFsrs
      const uniqueFsrs = allFsrsArray.filter(
        (fsr, index, self) => index === self.findIndex((f) => f.id === fsr.id)
      )
      setAllFsrs(uniqueFsrs)

      // Load initial incidents for today only
      await loadIncidents({ startDate: today, endDate: today })
    } catch (error) {
      console.error("Error loading initial data:", error)
    } finally {
      setLoading(false)
    }
  }

  const loadIncidents = async (filterParams: any) => {
    try {
      const data = await getIncidentsForTracking(filterParams)
      setIncidents(data)
    } catch (error) {
      console.error("Error loading incidents:", error)
    }
  }

  const handleFilterChange = (newFilters: any) => {
    setFilters(newFilters)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
          <ClipboardList className="h-5 w-5 text-blue-500" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">Seguimiento de Atención</h1>
          <p className="text-muted-foreground">
            Monitorea y gestiona el seguimiento de incidentes
          </p>
        </div>
      </div>

      <div>
        <TrackingFilters
          vics={vics}
          incidentTypes={incidentTypes}
          incidentStatuses={incidentStatuses}
          fsrs={allFsrs}
          onFilterChange={handleFilterChange}
          createButton={
            <Button asChild>
              <Link href="/admin/incidents/new">
                <Plus className="h-4 w-4 mr-2" />
                Crear Incidente
              </Link>
            </Button>
          }
        />
      </div>

      <div className="bg-muted/30 rounded-lg p-4">
        <div className="text-sm text-muted-foreground">
          Total de incidentes: <span className="font-semibold text-foreground">{incidents.length}</span>
        </div>
      </div>

      <div>
        <TrackingTable
          incidents={incidents}
          fsrsByVic={fsrsByVic}
          incidentStatuses={incidentStatuses}
          onDataChange={() => loadIncidents(filters)}
        />
      </div>
    </div>
  )
}
