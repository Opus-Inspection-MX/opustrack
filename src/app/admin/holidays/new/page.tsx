import { BackButton } from "@/components/common/back-button";
import { HolidayForm } from "@/components/holidays/holiday-form";
import { requireRouteAccess } from "@/lib/auth/auth";

export default async function NewHolidayPage() {
  await requireRouteAccess("/admin/holidays");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <BackButton fallback="/admin/holidays" />
        <div>
          <h1 className="text-3xl font-bold">Nuevo Festivo</h1>
          <p className="text-muted-foreground">
            Registre un nuevo día festivo oficial
          </p>
        </div>
      </div>

      <HolidayForm redirectPath="/admin/holidays" />
    </div>
  );
}
