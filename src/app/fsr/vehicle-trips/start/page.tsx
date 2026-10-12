import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { TripStartForm } from "@/components/vehicle-trips/trip-start-form";
import { canPerform } from "@/lib/auth/auth";

export default async function StartTripPage() {
  const canManage = await canPerform("vehicle-trips:manage-all");
  return (
    <PageContainer size="narrow">
      <PageHeader
        title="Iniciar Viaje"
        description="Registra la lectura inicial del odómetro"
        breadcrumbs={[
          { label: "Mis Viajes", href: "/fsr/vehicle-trips" },
          { label: "Iniciar Viaje" },
        ]}
      />

      <TripStartForm canManage={canManage} />
    </PageContainer>
  );
}
