"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Check, X, Shield, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"

interface Permission {
  id: number
  name: string
  description?: string
  active: boolean
}

interface RolePermission {
  id: number
  roleId: number
  permissionId: number
  active: boolean
}

interface RolePermissionsProps {
  role: {
    id: number
    name: string
  }
  permissions: Permission[]
  rolePermissions: RolePermission[]
  onSave: (roleId: number, permissionIds: number[]) => Promise<void>
}

export function RolePermissions({ role, permissions, rolePermissions, onSave }: RolePermissionsProps) {
  const [selectedPermissions, setSelectedPermissions] = useState<Set<number>>(
    new Set(rolePermissions.filter((rp) => rp.active).map((rp) => rp.permissionId)),
  )
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handlePermissionToggle = (permissionId: number) => {
    const newSelected = new Set(selectedPermissions)
    if (newSelected.has(permissionId)) {
      newSelected.delete(permissionId)
    } else {
      newSelected.add(permissionId)
    }
    setSelectedPermissions(newSelected)
  }

  const handleSave = async () => {
    setIsLoading(true)
    try {
      await onSave(role.id, Array.from(selectedPermissions))
      router.push("/admin/roles")
    } catch (error) {
      console.error("Error saving permissions:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const groupedPermissions = permissions.reduce(
    (acc, permission) => {
      const category = permission.name.split(".")[0] || "general"
      if (!acc[category]) {
        acc[category] = []
      }
      acc[category].push(permission)
      return acc
    },
    {} as Record<string, Permission[]>,
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Manage Permissions</h1>
          <p className="text-muted-foreground">
            Configure permissions for role: <Badge variant="outline">{role.name}</Badge>
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push("/admin/roles")}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isLoading}>
            {isLoading && <Spinner size="sm" />}
            <Save className="mr-2 h-4 w-4" />
            Save Permissions
          </Button>
        </div>
      </div>

      <div className="grid gap-6">
        {Object.entries(groupedPermissions).map(([category, categoryPermissions]) => (
          <Card key={category}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 capitalize">
                <Shield className="h-5 w-5" />
                {category} Permissions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                {categoryPermissions.map((permission) => (
                  <div key={permission.id} className="flex items-start space-x-3">
                    <Checkbox
                      id={`permission-${permission.id}`}
                      checked={selectedPermissions.has(permission.id)}
                      onCheckedChange={() => handlePermissionToggle(permission.id)}
                      disabled={!permission.active}
                    />
                    <div className="grid gap-1.5 leading-none flex-1">
                      <label
                        htmlFor={`permission-${permission.id}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        {permission.name}
                      </label>
                      {permission.description && (
                        <p className="text-xs text-muted-foreground">{permission.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {selectedPermissions.has(permission.id) ? (
                        <Badge variant="default" className="text-xs">
                          <Check className="mr-1 h-3 w-3" />
                          Granted
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">
                          <X className="mr-1 h-3 w-3" />
                          Denied
                        </Badge>
                      )}
                      {!permission.active && (
                        <Badge variant="destructive" className="text-xs">
                          Inactive
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
        <div>
          <p className="font-medium">Permission Summary</p>
          <p className="text-sm text-muted-foreground">
            {selectedPermissions.size} of {permissions.filter((p) => p.active).length} permissions granted
          </p>
        </div>
        <Button onClick={handleSave} disabled={isLoading}>
          {isLoading && <Spinner size="sm" />}
          <Save className="mr-2 h-4 w-4" />
          Save Changes
        </Button>
      </div>
    </div>
  )
}
