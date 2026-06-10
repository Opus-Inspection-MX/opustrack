import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { ClienteForm } from "@/components/admin/clientes/cliente-form";
import { Button } from "@/components/ui/button";
import { getClientUsers, getFSRUsers, getStates } from "@/lib/actions/clientes";

export default async function NewClientePage() {
  const [states, fsrUsers, clientUsers] = await Promise.all([
    getStates(),
    getFSRUsers(),
    getClientUsers(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/clientes">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Nuevo Centro de Verificación</h1>
          <p className="text-muted-foreground">
            Agregar un nuevo Cliente al sistema
          </p>
        </div>
      </div>

      <ClienteForm
        states={states}
        fsrUsers={fsrUsers}
        clientUsers={clientUsers}
      />
    </div>
  );
}
