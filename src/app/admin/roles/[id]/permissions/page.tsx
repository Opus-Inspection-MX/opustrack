"use client"

import { RolePermissions } from "@/components/roles/role-permissions"

// Mock data - replace with actual API calls
const mockRole = {
  id: 1,
  name: "Admin",
}

const mockPermissions = [
  { id: 1, name: "user.create", description: "Create new users", active: true },
  { id: 2, name: "user.read", description: "View user information", active: true },
  { id: 3, name: "user.update", description: "Update user information", active: true },
  { id: 4, name: "user.delete", description: "Delete users", active: true },
  { id: 5, name: "incident.create", description: "Create new incidents", active: true },
  { id: 6, name: "incident.read", description: "View incident information", active: true },
  { id: 7, name: "incident.update", description: "Update incident information", active: true },
  { id: 8, name: "incident.delete", description: "Delete incidents", active: true },
  { id: 9, name: "workorder.create", description: "Create new work orders", active: true },
  { id: 10, name: "workorder.read", description: "View work order information", active: true },
  { id: 11, name: "workorder.update", description: "Update work order information", active: true },
  { id: 12, name: "workorder.delete", description: "Delete work orders", active: true },
  { id: 13, name: "admin.access", description: "Access admin panel", active: true },
  { id: 14, name: "admin.settings", description: "Modify system settings", active: true },
]

const mockRolePermissions = [
  { id: 1, roleId: 1, permissionId: 1, active: true },
  { id: 2, roleId: 1, permissionId: 2, active: true },
  { id: 3, roleId: 1, permissionId: 3, active: true },
  { id: 4, roleId: 1, permissionId: 4, active: true },
  { id: 5, roleId: 1, permissionId: 13, active: true },
  { id: 6, roleId: 1, permissionId: 14, active: true },
]

export default function RolePermissionsPage({ params }: { params: { id: string } }) {
  const handleSave = async (roleId: number, permissionIds: number[]) => {
    console.log("Saving permissions for role:", roleId, "permissions:", permissionIds)
    // Implement API call to update role permissions
    // Example: await updateRolePermissions(roleId, permissionIds)
  }

  return (
    <RolePermissions
      role={mockRole}
      permissions={mockPermissions}
      rolePermissions={mockRolePermissions}
      onSave={handleSave}
    />
  )
}
