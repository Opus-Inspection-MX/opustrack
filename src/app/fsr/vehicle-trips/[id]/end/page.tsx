import { notFound } from "next/navigation";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { TripEndForm } from "@/components/vehicle-trips/trip-end-form";
import { getVehicleTripById } from "@/lib/actions/vehicle-trips";

interface VehicleTrip {
  id: string;
  startOdometer: number;
  endOdometer?: number | null;
  startedAt: string;
  endedAt?: string | null;
  vehicleId: string;
  vehicle: {
    make: string;
    model: string;
    licensePlate: string;
  };
  assignment?: {
    folio: number;
    incident: { title: string };
  } | null;
}

export default async function EndTripPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let trip: VehicleTrip | null = null;
  try {
    trip = (await getVehicleTripById(id)) as VehicleTrip;
  } catch (_error) {
    notFound();
  }

  if (!trip) {
    notFound();
  }

  if (trip.endedAt) {
    return (
      <PageContainer size="narrow">
        <PageHeader
          title="Finalizar Viaje"
          description="Este viaje ya fue completado o cancelado."
          breadcrumbs={[
            { label: "Mis Viajes", href: "/fsr/vehicle-trips" },
            { label: "Finalizar Viaje" },
          ]}
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer size="narrow">
      <PageHeader
        title="Finalizar Viaje"
        description="Registra la lectura final del odómetro"
        breadcrumbs={[
          { label: "Mis Viajes", href: "/fsr/vehicle-trips" },
          { label: "Finalizar Viaje" },
        ]}
      />

      <TripEndForm trip={trip} />
    </PageContainer>
  );
}
