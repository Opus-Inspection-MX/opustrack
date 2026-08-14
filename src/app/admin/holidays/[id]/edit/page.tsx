import { notFound } from "next/navigation";
import { BackButton } from "@/components/common/back-button";
import { HolidayForm } from "@/components/holidays/holiday-form";
import { getHolidayById } from "@/lib/actions/holidays";
import { requireRouteAccess } from "@/lib/auth/auth";

export default async function EditHolidayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRouteAccess("/admin/holidays");

  const { id } = await params;
  const holiday = await getHolidayById(Number.parseInt(id, 10));

  if (!holiday) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <BackButton fallback="/admin/holidays" />
        <div>
          <h1 className="text-3xl font-bold">Editar Festivo</h1>
          <p className="text-muted-foreground">
            Actualice la información del día festivo
          </p>
        </div>
      </div>

      <HolidayForm
        holiday={{
          id: holiday.id,
          name: holiday.name,
          month: holiday.month,
          day: holiday.day,
          nthMonday: holiday.nthMonday,
          isRecurring: holiday.isRecurring,
          year: holiday.year,
        }}
        redirectPath="/admin/holidays"
      />
    </div>
  );
}
