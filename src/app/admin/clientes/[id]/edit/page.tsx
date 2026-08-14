import { notFound } from "next/navigation";
import { ClienteForm } from "@/components/admin/clientes/cliente-form";
import { BackButton } from "@/components/common/back-button";
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
        <BackButton fallback="/admin/clientes" />
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
