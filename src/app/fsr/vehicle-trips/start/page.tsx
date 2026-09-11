import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { TripStartForm } from "@/components/vehicle-trips/trip-start-form";

export default function StartTripPage() {
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

      <TripStartForm />
    </PageContainer>
  );
}
