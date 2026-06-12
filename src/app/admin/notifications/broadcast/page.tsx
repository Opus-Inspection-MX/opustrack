import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { BroadcastForm } from "@/components/notifications/broadcast-form";
import { Button } from "@/components/ui/button";
import { requireRouteAccess } from "@/lib/auth/auth";
import { prisma } from "@/lib/database/prisma.singleton";

export default async function BroadcastPage() {
  await requireRouteAccess("/admin/notifications/broadcast");

  const roles = await prisma.role.findMany({
    where: { active: true },
    select: { id: true, name: true, description: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Difusión de Notificaciones</h1>
          <p className="text-muted-foreground">
            Enviar una notificación a todos los usuarios o a un grupo específico
          </p>
        </div>
      </div>

      <BroadcastForm roles={roles} />
    </div>
  );
}
