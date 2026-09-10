import { ClientForm } from "@/components/admin/clientes/client-form";
import { BackButton } from "@/components/common/back-button";
import {
  getFSRUsers,
  getReporterUsers,
  getStates,
} from "@/lib/actions/clients";

export default async function NewClientPage() {
  const [states, fsrUsers, reporterUsers] = await Promise.all([
    getStates(),
    getFSRUsers(),
    getReporterUsers(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <BackButton fallback="/admin/clients" />
        <div>
          <h1 className="text-3xl font-bold">Nuevo Centro de Verificación</h1>
          <p className="text-muted-foreground">
            Agregar un nuevo Cliente al sistema
          </p>
        </div>
      </div>

      <ClientForm
        states={states}
        fsrUsers={fsrUsers}
        reporterUsers={reporterUsers}
      />
    </div>
  );
}
