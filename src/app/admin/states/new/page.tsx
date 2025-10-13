import { StateForm } from "@/components/states/state-form"

export default function NewStatePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Create New State</h1>
        <p className="text-muted-foreground">Add a new state to the system</p>
      </div>

      <StateForm />
    </div>
  )
}
