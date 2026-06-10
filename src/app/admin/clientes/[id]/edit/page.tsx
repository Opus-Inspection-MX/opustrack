import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ClienteForm } from "@/components/admin/clientes/cliente-form";
import { Button } from "@/components/ui/button";
import {
  getClienteById,
  getClientUsers,
  getFSRUsers,
  getStates,
} from "@/lib/actions/clientes";

export default async function EditClientePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [cliente, states, fsrUsers, clientUsers] = await Promise.all([
    getClienteById(id),
    getStates(),
    getFSRUsers(),
    getClientUsers(),
  ]);

  if (!cliente) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/clientes">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Editar Centro de Verificación</h1>
          <p className="text-muted-foreground">
            Actualizar información del Cliente: {cliente.name}
          </p>
        </div>
      </div>

      <ClienteForm
        cliente={cliente}
        states={states}
        fsrUsers={fsrUsers}
        clientUsers={clientUsers}
      />
    </div>
  );
}
