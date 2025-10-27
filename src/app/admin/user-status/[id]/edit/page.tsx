"use client"

import { use, useState, useEffect } from "react"
import { UserStatusForm } from "@/components/user-status/user-status-form"
import { Spinner } from "@/components/ui/spinner"
import { getUserStatusById } from "@/lib/actions/lookups"

export default function EditUserStatusPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [isLoading, setIsLoading] = useState(true)
  const [userStatus, setUserStatus] = useState<any>(null)

  useEffect(() => {
    const fetchUserStatus = async () => {
      setIsLoading(true)
      try {
        const data = await getUserStatusById(Number(id))
        setUserStatus(data)
      } catch (error) {
        console.error("Error fetching user status:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchUserStatus()
  }, [id])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner size="lg" />
      </div>
    )
  }

  return <UserStatusForm initialData={userStatus} />
}
