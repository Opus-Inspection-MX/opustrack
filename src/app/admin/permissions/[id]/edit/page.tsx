"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { PermissionForm } from "@/components/permissions/permission-form"
import { Spinner } from "@/components/ui/spinner"

export default function EditPermissionPage() {
  const params = useParams()
  const [isLoading, setIsLoading] = useState(true)
  const [permission, setPermission] = useState<any>(null)

  useEffect(() => {
    const fetchPermission = async () => {
      setIsLoading(true)
      try {
        await new Promise((resolve) => setTimeout(resolve, 500))

        const mockPermission = {
          id: Number(params.id),
          name: "user.create",
          description: "Allows users to create new user accounts",
          active: true,
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

  return <PermissionForm permission={permission} />
}
