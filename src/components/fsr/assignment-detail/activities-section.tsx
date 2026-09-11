import { Activity, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { EmptyState } from "@/components/common/empty-state";
import { SectionCard } from "@/components/common/section-card";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";

export interface DetailActivity {
  id: string;
}

interface ActivitiesSectionProps<T extends DetailActivity> {
  activities: T[];
  showForm: boolean;
  form: ReactNode;
  renderEditor: (activity: T) => ReactNode;
  canEdit: boolean;
  onToggleForm: () => void;
  onDeleteActivity: (id: string) => void;
}

/** Work-activity log of one assignment with its inline form. */
export function ActivitiesSection<T extends DetailActivity>({
  activities,
  showForm,
  form,
  renderEditor,
  canEdit,
  onToggleForm,
  onDeleteActivity,
}: ActivitiesSectionProps<T>) {
  return (
    <SectionCard
      title={`Actividades de Trabajo (${activities.length})`}
      description="Documenta todo el trabajo realizado en esta orden"
      actions={
        canEdit ? (
          <Button
            onClick={onToggleForm}
            variant={showForm ? "outline" : "default"}
            className="min-h-[44px] w-full sm:w-auto"
          >
            {showForm ? "Cancelar" : "Agregar Actividad"}
          </Button>
        ) : undefined
      }
    >
      <div className="space-y-4">
        {showForm && form}
        {activities.length === 0 && !showForm && (
          <EmptyState
            icon={Activity}
            title="Sin actividades"
            description='Sin actividades aún. Haz clic en "Agregar Actividad" para registrar el trabajo.'
          />
        )}
        {activities.map((activity) => (
          <Card key={activity.id}>
            <CardHeader>
              <div className="flex items-end justify-end gap-2">
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDeleteActivity(activity.id)}
                    className="text-destructive"
                    aria-label="Eliminar actividad"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </Button>
                )}
              </div>
              {renderEditor(activity)}
            </CardHeader>
          </Card>
        ))}
      </div>
    </SectionCard>
  );
}
