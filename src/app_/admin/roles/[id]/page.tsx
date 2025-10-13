"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import { ArrowLeft, Edit, Calendar, Shield, Users } from "lucide-react"

export default function RoleDetailPage() {
  const router = useRouter()
  const params = useParams()
  const [isLoading, setIsLoading] = useState(true)
  const [role, setRole] = useState<any>(null)

  useEffect(() => {
    const fetchRole = async () => {
      setIsLoading(true)
      try {
        await new Promise((resolve) => setTimeout(resolve, 500))

        const mockRole = {
          id: params.id,
          name: "Admin",
          defaultPath: "/admin",
          active: true,
          userCount: 12,
          permissionCount: 45,
          createdAt: "2024-01-10T08:00:00Z",
          updatedAt: "2024-03-15T16:30:00Z",
        }

        setRole(mockRole)
      } catch (error) {
        console.error("Error fetching role:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchRole()
  }, [params.id])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!role) {
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
            <p className="text-center text-muted-foreground">Role not found</p>
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
            <h1 className="text-3xl font-bold">{role.name}</h1>
            <p className="text-muted-foreground">Role details and permissions</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push(`/admin/roles/${role.id}/permissions`)}>
            <Shield className="h-4 w-4 mr-2" />
            Manage Permissions
          </Button>
          <Button onClick={() => router.push(`/admin/roles/${role.id}/edit`)}>
            <Edit className="h-4 w-4 mr-2" />
            Edit Role
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Role Information</CardTitle>
            <CardDescription>Basic role details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
              <Shield className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-muted-foreground">Role Name</p>
                <p className="text-base">{role.name}</p>
              </div>
            </div>

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
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-muted-foreground">Default Path</p>
                <p className="text-base font-mono">{role.defaultPath}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="h-5 w-5 rounded-full flex items-center justify-center mt-0.5">
                <div className={`h-3 w-3 rounded-full ${role.active ? "bg-green-500" : "bg-red-500"}`} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-muted-foreground">Status</p>
                <Badge variant={role.active ? "default" : "destructive"}>{role.active ? "Active" : "Inactive"}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Statistics</CardTitle>
            <CardDescription>Usage and permissions</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
              <Users className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-muted-foreground">Users with this Role</p>
                <p className="text-2xl font-bold">{role.userCount}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Shield className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-muted-foreground">Assigned Permissions</p>
                <p className="text-2xl font-bold">{role.permissionCount}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-muted-foreground">Created</p>
                <p className="text-base">{new Date(role.createdAt).toLocaleString()}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-muted-foreground">Last Updated</p>
                <p className="text-base">{new Date(role.updatedAt).toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
