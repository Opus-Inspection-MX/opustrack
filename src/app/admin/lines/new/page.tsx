import { BackButton } from "@/components/common/back-button";
import { LineForm } from "@/components/lines/line-form";

export default function NewLinePage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <BackButton fallback="/admin/lines" />
        <div>
          <h1 className="text-3xl font-bold">Nueva Línea</h1>
          <p className="text-muted-foreground">
            Crea una nueva línea de inspección
          </p>
        </div>
      </div>

      <LineForm mode="create" />
    </div>
  );
}
