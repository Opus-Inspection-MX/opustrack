import { VICCenterForm } from "@/components/vic-centers/vic-center-form"

export default function NewVICCenterPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Create New VIC Center</h1>
        <p className="text-muted-foreground">Add a new Vehicle Inspection Center to the system</p>
      </div>

      <VICCenterForm />
    </div>
  )
}
