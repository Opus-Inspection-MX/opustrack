import { BackButton } from "@/components/common/back-button";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { VacationForm } from "@/components/vacations/vacation-form";
import { requireRouteAccess } from "@/lib/auth/auth";

export default async function FsrNewVacationPage() {
  await requireRouteAccess("/vacations");

  return (
    <PageContainer size="narrow">
      <PageHeader
        title="Solicitar Vacaciones"
        description="Envíe una nueva solicitud de vacaciones"
        breadcrumbs={[
          { label: "Mis Vacaciones", href: "/vacations" },
          { label: "Solicitar" },
        ]}
      />
      <div>
        <BackButton fallback="/vacations" />
      </div>

      <VacationForm showFsrSelect={false} redirectPath="/vacations" />
    </PageContainer>
  );
}
