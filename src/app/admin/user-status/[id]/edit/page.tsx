"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { UserStatusForm } from "@/components/user-status/user-status-form"
import { Spinner } from "@/components/ui/spinner"

export default function EditUserStatusPage() {
  const params = useParams()
  const [isLoading, setIsLoading] = useState(true)
  const [userStatus, setUserStatus] = useState<any>(null)

  useEffect(() => {
    const fetchUserStatus = async () => {
      setIsLoading(true)
      try {
        await new Promise((resolve) => setTimeout(resolve, 500))

        const mockUserStatus = {
          id: Number(params.id),
          name: "Active",
          active: true,
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

  return <UserStatusForm initialData={userStatus} />
}
