"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import { ArrowLeft, Edit, Calendar, Users } from "lucide-react"

export default function UserStatusDetailPage() {
  const router = useRouter()
  const params = useParams()
  const [isLoading, setIsLoading] = useState(true)
  const [userStatus, setUserStatus] = useState<any>(null)

  useEffect(() => {
    const fetchUserStatus = async () => {
      setIsLoading(true)
      try {
        await new Promise((resolve) => setTimeout(resolve, 500))

        const mockUserStatus = {
          id: params.id,
          name: "Active",
          active: true,
          userCount: 45,
          createdAt: "2024-01-01T00:00:00Z",
          updatedAt: "2024-03-10T12:00:00Z",
        }

        setUserStatus(mockUserStatus)
      } catch (error) {
        console.error("Error fetching user status:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchUserStatus()
  }, [params.id])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!userStatus) {
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
            <p className="text-center text-muted-foreground">User status not found</p>
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
            <h1 className="text-3xl font-bold">{userStatus.name}</h1>
            <p className="text-muted-foreground">User status details and usage</p>
          </div>
        </div>
        <Button onClick={() => router.push(`/admin/user-status/${userStatus.id}/edit`)}>
          <Edit className="h-4 w-4 mr-2" />
          Edit Status
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Status Information</CardTitle>
            <CardDescription>Basic status details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center mt-0.5">
                <div className="h-2 w-2 rounded-full bg-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-muted-foreground">Status Name</p>
                <p className="text-base">{userStatus.name}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="h-5 w-5 rounded-full flex items-center justify-center mt-0.5">
                <div className={`h-3 w-3 rounded-full ${userStatus.active ? "bg-green-500" : "bg-red-500"}`} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-muted-foreground">Status</p>
                <Badge variant={userStatus.active ? "default" : "destructive"}>
                  {userStatus.active ? "Active" : "Inactive"}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Usage Statistics</CardTitle>
            <CardDescription>Status assignment details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
              <Users className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-muted-foreground">Users with this Status</p>
                <p className="text-2xl font-bold">{userStatus.userCount}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-muted-foreground">Created</p>
                <p className="text-base">{new Date(userStatus.createdAt).toLocaleString()}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-muted-foreground">Last Updated</p>
                <p className="text-base">{new Date(userStatus.updatedAt).toLocaleString()}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="h-5 w-5 flex items-center justify-center mt-0.5">
                <div className="text-lg font-bold text-primary">#</div>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-muted-foreground">Status ID</p>
                <p className="text-base font-mono">{userStatus.id}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
