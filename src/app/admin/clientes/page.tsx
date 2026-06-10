import { Plus } from "lucide-react";
import Link from "next/link";
import { ClientesTable } from "@/components/admin/clientes/clientes-table";
import { Button } from "@/components/ui/button";
import { getClientes } from "@/lib/actions/clientes";

export default async function ClientesPage() {
  const clientes = await getClientes();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Centros de Verificación</h1>
          <p className="text-muted-foreground">
            Administre los centros de verificación vehicular
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/clientes/new">
            <Plus className="mr-2 h-4 w-4" />
            Agregar Cliente
          </Link>
        </Button>
      </div>

      <ClientesTable clientes={clientes} />
    </div>
  );
}
