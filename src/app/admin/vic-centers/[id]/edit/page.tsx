import { getVICById, getStates } from "@/lib/actions/vics";
import { VICForm } from "@/components/admin/vics/vic-form";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { notFound } from "next/navigation";

export default async function EditVICCenterPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [vic, states] = await Promise.all([
    getVICById(id),
    getStates(),
  ]);

  if (!vic) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/vic-centers">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Editar Centro de Verificación</h1>
          <p className="text-muted-foreground">
            Actualizar información del VIC: {vic.name}
          </p>
        </div>
      </div>

      <VICForm vic={vic} states={states} />
    </div>
  );
}
