"use client"

import { useState, useEffect, use } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Edit, Calendar, CheckCircle, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"

interface IncidentType {
  id: number
  name: string
  description: string | null
  active: boolean
  createdAt: string
  updatedAt: string
}

export default function ViewIncidentTypePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter()
  const [incidentType, setIncidentType] = useState<IncidentType | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Mock data fetch
    const fetchIncidentType = async () => {
      setIsLoading(true)
      await new Promise((resolve) => setTimeout(resolve, 500))

      // Mock data
      setIncidentType({
        id: Number.parseInt(id),
        name: "Hardware Failure",
        description: "Issues related to hardware components and equipment failures",
        active: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })

      setIsLoading(false)
    }

    fetchIncidentType()
  }, [id])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Spinner size="lg" text="Loading incident type..." />
      </div>
    )
  }

  if (!incidentType) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push("/admin/incident-types")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-3xl font-bold">Incident Type Not Found</h1>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push("/admin/incident-types")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{incidentType.name}</h1>
            <p className="text-muted-foreground">Incident Type Details</p>
          </div>
        </div>
        <Button onClick={() => router.push(`/admin/incident-types/${id}/edit`)}>
          <Edit className="h-4 w-4 mr-2" />
          Edit
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Name</p>
              <p className="font-medium">{incidentType.name}</p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">Description</p>
              <p className="font-medium">{incidentType.description || "No description provided"}</p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground mb-2">Status</p>
              <Badge variant={incidentType.active ? "default" : "secondary"}>
                {incidentType.active ? (
                  <>
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Active
                  </>
                ) : (
                  <>
                    <XCircle className="h-3 w-3 mr-1" />
                    Inactive
                  </>
                )}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>System Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Created At
              </p>
              <p className="font-medium">{new Date(incidentType.createdAt).toLocaleString()}</p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Last Updated
              </p>
              <p className="font-medium">{new Date(incidentType.updatedAt).toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
