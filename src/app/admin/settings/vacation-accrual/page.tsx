import { BackButton } from "@/components/common/back-button";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { VacationAccrualClient } from "@/components/vacations/vacation-accrual-client";
import {
  getAccrualRules,
  getVacationSetting,
} from "@/lib/actions/vacation-accrual-rules";
import { requireRouteAccess } from "@/lib/auth/auth";

export default async function VacationAccrualSettingsPage() {
  await requireRouteAccess("/admin/settings");

  const [rules, setting] = await Promise.all([
    getAccrualRules(),
    getVacationSetting(),
  ]);

  return (
    <PageContainer>
      <PageHeader
        title="Días de Vacaciones"
        description="Días otorgados por antigüedad y vigencia de los períodos"
        breadcrumbs={[
          { label: "Configuración", href: "/admin/settings" },
          { label: "Días de Vacaciones" },
        ]}
      />
      <div>
        <BackButton fallback="/admin/settings" />
      </div>

      <VacationAccrualClient
        initialRules={rules}
        initialGraceWindowMonths={setting.graceWindowMonths}
      />
    </PageContainer>
  );
}
