import { getStates } from "@/lib/actions/vics";
import { VICForm } from "@/components/admin/vics/vic-form";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function NewVICCenterPage() {
  const states = await getStates();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/vic-centers">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Nuevo Centro de Verificación</h1>
          <p className="text-muted-foreground">
            Agregar un nuevo VIC al sistema
          </p>
        </div>
      </div>

      <VICForm states={states} />
    </div>
  );
}
