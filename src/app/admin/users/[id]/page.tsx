"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import { ArrowLeft, Edit, Mail, Calendar, Building2, Shield, UserIcon } from "lucide-react"

export default function UserDetailPage() {
  const router = useRouter()
  const params = useParams()
  const [isLoading, setIsLoading] = useState(true)
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    const fetchUser = async () => {
      setIsLoading(true)
      try {
        // Simulate API call
        await new Promise((resolve) => setTimeout(resolve, 500))

        // Mock data
        const mockUser = {
          id: params.id,
          name: "John Doe",
          email: "john.doe@example.com",
          role: { id: 1, name: "Admin" },
          userStatus: { id: 1, name: "Active" },
          vicCenter: { id: "vic_1", name: "VIC Centro", code: "VIC001" },
          active: true,
          createdAt: "2024-01-15T10:30:00Z",
          updatedAt: "2024-03-20T14:45:00Z",
        }

        setUser(mockUser)
      } catch (error) {
        console.error("Error fetching user:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchUser()
  }, [params.id])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!user) {
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
            <p className="text-center text-muted-foreground">User not found</p>
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
            <h1 className="text-3xl font-bold">{user.name}</h1>
            <p className="text-muted-foreground">User details and information</p>
          </div>
        </div>
        <Button onClick={() => router.push(`/admin/users/${user.id}/edit`)}>
          <Edit className="h-4 w-4 mr-2" />
          Edit User
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
            <CardDescription>User account details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
              <UserIcon className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-muted-foreground">Full Name</p>
                <p className="text-base">{user.name}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-muted-foreground">Email Address</p>
                <p className="text-base">{user.email}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Shield className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-muted-foreground">Role</p>
                <Badge variant="secondary">{user.role.name}</Badge>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center mt-0.5">
                <div className="h-2 w-2 rounded-full bg-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-muted-foreground">Status</p>
                <Badge variant={user.userStatus.name === "Active" ? "default" : "secondary"}>
                  {user.userStatus.name}
                </Badge>
              </div>
            </div>

            {user.vicCenter && (
              <div className="flex items-start gap-3">
                <Building2 className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-muted-foreground">VIC Center</p>
                  <p className="text-base">
                    {user.vicCenter.name} ({user.vicCenter.code})
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-start gap-3">
              <div className="h-5 w-5 rounded-full flex items-center justify-center mt-0.5">
                <div className={`h-3 w-3 rounded-full ${user.active ? "bg-green-500" : "bg-red-500"}`} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-muted-foreground">Account Active</p>
                <Badge variant={user.active ? "default" : "destructive"}>{user.active ? "Yes" : "No"}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>System Information</CardTitle>
            <CardDescription>Timestamps and metadata</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-muted-foreground">Created At</p>
                <p className="text-base">{new Date(user.createdAt).toLocaleString()}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-muted-foreground">Last Updated</p>
                <p className="text-base">{new Date(user.updatedAt).toLocaleString()}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="h-5 w-5 flex items-center justify-center mt-0.5">
                <div className="text-lg font-bold text-primary">#</div>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-muted-foreground">User ID</p>
                <p className="text-base font-mono">{user.id}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
