"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { UserForm } from "@/components/users/user-form"
import { Spinner } from "@/components/ui/spinner"

export default function EditUserPage() {
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
          id: params.id as string,
          name: "John Doe",
          email: "john.doe@example.com",
          roleId: 1,
          userStatusId: 1,
          vicId: "vic_1",
          active: true,
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

  return <UserForm user={user} isEditing={true} />
}
