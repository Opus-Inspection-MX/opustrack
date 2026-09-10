import { notFound } from "next/navigation";
import { ClientForm } from "@/components/admin/clientes/client-form";
import { BackButton } from "@/components/common/back-button";
import {
  getClientById,
  getFSRUsers,
  getReporterUsers,
  getStates,
} from "@/lib/actions/clients";

export default async function EditClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [client, states, fsrUsers, reporterUsers] = await Promise.all([
    getClientById(id),
    getStates(),
    getFSRUsers(),
    getReporterUsers(),
  ]);

  if (!client) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <BackButton fallback="/admin/clients" />
        <div>
          <h1 className="text-3xl font-bold">Editar Centro de Verificación</h1>
          <p className="text-muted-foreground">
            Actualizar información del Cliente: {client.name}
          </p>
        </div>
      </div>

      <ClientForm
        client={client}
        states={states}
        fsrUsers={fsrUsers}
        reporterUsers={reporterUsers}
      />
    </div>
  );
}
