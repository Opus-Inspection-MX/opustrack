import { StateForm } from "@/components/states/state-form"

// Mock data - replace with actual API call
const mockState = {
  id: 1,
  name: "Ciudad de México",
  code: "CDMX",
  active: true,
}

interface EditStatePageProps {
  params: {
    id: string
  }
}

export default function EditStatePage({ params }: EditStatePageProps) {
  // In a real app, fetch the state data using params.id
  const stateData = mockState

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Edit State</h1>
        <p className="text-muted-foreground">Update state information</p>
      </div>

      <StateForm initialData={stateData} isEditing />
    </div>
  )
}
