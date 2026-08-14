import { notFound } from "next/navigation";
import { BackButton } from "@/components/common/back-button";
import { LineForm } from "@/components/lines/line-form";
import { getLineById } from "@/lib/actions/lines";

interface EditLinePageProps {
  params: Promise<{ id: string }>;
}

export default async function EditLinePage({ params }: EditLinePageProps) {
  const { id } = await params;

  try {
    const line = await getLineById(parseInt(id, 10));

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <BackButton fallback="/admin/lines" />
          <div>
            <h1 className="text-3xl font-bold">Editar Línea</h1>
            <p className="text-muted-foreground">
              Actualiza la información de la línea
            </p>
          </div>
        </div>

        <LineForm mode="edit" line={line} />
      </div>
    );
  } catch (_error) {
    notFound();
  }
}
