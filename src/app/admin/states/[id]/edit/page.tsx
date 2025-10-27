"use client"

import { use, useState, useEffect } from "react"
import { StateForm } from "@/components/states/state-form"
import { Spinner } from "@/components/ui/spinner"
import { getStateById } from "@/lib/actions/lookups"

export default function EditStatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [isLoading, setIsLoading] = useState(true)
  const [state, setState] = useState<any>(null)

  useEffect(() => {
    const fetchState = async () => {
      setIsLoading(true)
      try {
        const data = await getStateById(Number(id))
        setState(data)
      } catch (error) {
        console.error("Error fetching state:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchState()
  }, [id])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Edit State</h1>
        <p className="text-muted-foreground">Update state information</p>
      </div>

      <StateForm initialData={state} isEditing />
    </div>
  )
}
