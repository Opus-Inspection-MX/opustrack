"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { RoleForm } from "@/components/roles/role-form"
import { Spinner } from "@/components/ui/spinner"

export default function EditRolePage() {
  const params = useParams()
  const [isLoading, setIsLoading] = useState(true)
  const [role, setRole] = useState<any>(null)

  useEffect(() => {
    const fetchRole = async () => {
      setIsLoading(true)
      try {
        await new Promise((resolve) => setTimeout(resolve, 500))

        const mockRole = {
          id: Number(params.id),
          name: "Admin",
          defaultPath: "/admin",
          active: true,
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

  const handleSubmit = async (data: any) => {
    console.log("Updating role:", data)
    // Implement API call to update role
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner size="lg" />
      </div>
    )
  }

  return <RoleForm role={role} onSubmit={handleSubmit} />
}
