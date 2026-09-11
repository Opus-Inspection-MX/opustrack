import { SearchX } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";

/** Unknown routes under the app: a way back instead of a blank 404. */
export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <EmptyState
        icon={SearchX}
        title="Página no encontrada"
        description="La dirección que buscas no existe o fue movida."
        action={{ label: "Volver al inicio", href: "/" }}
      />
    </div>
  );
}
