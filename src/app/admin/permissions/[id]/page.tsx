"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import { ArrowLeft, Edit, Calendar, Shield } from "lucide-react"

export default function PermissionDetailPage() {
  const router = useRouter()
  const params = useParams()
  const [isLoading, setIsLoading] = useState(true)
  const [permission, setPermission] = useState<any>(null)

  useEffect(() => {
    const fetchPermission = async () => {
      setIsLoading(true)
      try {
        await new Promise((resolve) => setTimeout(resolve, 500))

        const mockPermission = {
          id: params.id,
          name: "user.create",
          description: "Allows users to create new user accounts in the system",
          active: true,
          roleCount: 3,
          createdAt: "2024-01-05T10:00:00Z",
          updatedAt: "2024-02-20T14:15:00Z",
        }

        setPermission(mockPermission)
      } catch (error) {
        console.error("Error fetching permission:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchPermission()
  }, [params.id])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!permission) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">Permission not found</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold font-mono">{permission.name}</h1>
            <p className="text-muted-foreground">Permission details and usage</p>
          </div>
        </div>
        <Button onClick={() => router.push(`/admin/permissions/${permission.id}/edit`)}>
          <Edit className="h-4 w-4 mr-2" />
          Edit Permission
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Permission Information</CardTitle>
            <CardDescription>Basic permission details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
              <Shield className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-muted-foreground">Permission Name</p>
                <p className="text-base font-mono">{permission.name}</p>
              </div>
            </div>

            {permission.description && (
              <div className="flex items-start gap-3">
                <div className="h-5 w-5 text-muted-foreground mt-0.5">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                    <polyline points="10 9 9 9 8 9" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-muted-foreground">Description</p>
                  <p className="text-base">{permission.description}</p>
                </div>
              </div>
            )}

            <div className="flex items-start gap-3">
              <div className="h-5 w-5 rounded-full flex items-center justify-center mt-0.5">
                <div className={`h-3 w-3 rounded-full ${permission.active ? "bg-green-500" : "bg-red-500"}`} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-muted-foreground">Status</p>
                <Badge variant={permission.active ? "default" : "destructive"}>
                  {permission.active ? "Active" : "Inactive"}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Usage Statistics</CardTitle>
            <CardDescription>Permission assignment details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
              <Shield className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-muted-foreground">Roles with this Permission</p>
                <p className="text-2xl font-bold">{permission.roleCount}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-muted-foreground">Created</p>
                <p className="text-base">{new Date(permission.createdAt).toLocaleString()}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-muted-foreground">Last Updated</p>
                <p className="text-base">{new Date(permission.updatedAt).toLocaleString()}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="h-5 w-5 flex items-center justify-center mt-0.5">
                <div className="text-lg font-bold text-primary">#</div>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-muted-foreground">Permission ID</p>
                <p className="text-base font-mono">{permission.id}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
