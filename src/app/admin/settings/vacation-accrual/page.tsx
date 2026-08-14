import { Palmtree } from "lucide-react";
import { BackButton } from "@/components/common/back-button";
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
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <BackButton fallback="/admin/settings" />
        <div className="flex items-center gap-3">
          <Palmtree className="h-8 w-8" />
          <div>
            <h1 className="text-3xl font-bold">Días de Vacaciones</h1>
            <p className="text-muted-foreground">
              Días otorgados por antigüedad y vigencia de los períodos
            </p>
          </div>
        </div>
      </div>

      <VacationAccrualClient
        initialRules={rules}
        initialGraceWindowMonths={setting.graceWindowMonths}
      />
    </div>
  );
}
