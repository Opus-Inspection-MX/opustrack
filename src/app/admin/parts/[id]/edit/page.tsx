import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PartForm } from "@/components/admin/parts/part-form";
import { Button } from "@/components/ui/button";
import { getPartById } from "@/lib/actions/parts";
import { requireRouteAccess } from "@/lib/auth/auth";

export default async function EditPartPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRouteAccess("/admin/parts");

  const { id } = await params;
  const part = await getPartById(id);

  if (!part) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/parts">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Editar Parte</h1>
          <p className="text-muted-foreground">
            Actualizar informacion de: {part.name}
          </p>
        </div>
      </div>

      <PartForm part={part} />
    </div>
  );
}
