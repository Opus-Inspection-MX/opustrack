import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { HolidayForm } from "@/components/holidays/holiday-form";
import { Button } from "@/components/ui/button";
import { requireRouteAccess } from "@/lib/auth/auth";

export default async function NewHolidayPage() {
  await requireRouteAccess("/admin/holidays");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/holidays">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
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
