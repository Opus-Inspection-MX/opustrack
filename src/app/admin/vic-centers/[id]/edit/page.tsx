import { VICCenterForm } from "@/components/vic-centers/vic-center-form"

// Mock data - replace with actual API call
const mockVICCenter = {
  id: "1",
  code: "VIC001",
  name: "Centro de Verificación Norte",
  address: "Av. Principal 123, Col. Centro",
  rfc: "ABC123456789",
  companyName: "Verificaciones del Norte SA",
  phone: "+52 55 1234 5678",
  contact: "Juan Pérez",
  email: "norte@vic.com",
  lines: 3,
  stateId: 1,
  active: true,
}

interface EditVICCenterPageProps {
  params: {
    id: string
  }
}

export default function EditVICCenterPage({ params }: EditVICCenterPageProps) {
  // In a real app, fetch the VIC center data using params.id
  const vicCenterData = mockVICCenter

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Edit VIC Center</h1>
        <p className="text-muted-foreground">Update VIC center information</p>
      </div>

      <VICCenterForm initialData={vicCenterData} isEditing />
    </div>
  )
}
