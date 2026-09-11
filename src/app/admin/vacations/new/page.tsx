import { BackButton } from "@/components/common/back-button";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { VacationForm } from "@/components/vacations/vacation-form";
import { getEmployeesForVacations } from "@/lib/actions/vacations";
import { requireRouteAccess } from "@/lib/auth/auth";

export default async function AdminNewVacationPage() {
  await requireRouteAccess("/admin/vacations");
  const fsrs = await getEmployeesForVacations();

  return (
    <PageContainer size="narrow">
      <PageHeader
        title="Nueva Solicitud de Vacaciones"
        description="Cree una solicitud de vacaciones en nombre de un FSR"
        breadcrumbs={[
          { label: "Solicitudes de Vacaciones", href: "/admin/vacations" },
          { label: "Nueva" },
        ]}
      />
      <div>
        <BackButton fallback="/admin/vacations" />
      </div>

      <VacationForm
        showFsrSelect={true}
        fsrs={fsrs}
        redirectPath="/admin/vacations"
      />
    </PageContainer>
  );
}
