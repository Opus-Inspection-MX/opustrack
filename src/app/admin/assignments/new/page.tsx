import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { AssignmentForm } from "@/components/admin/assignments/assignment-form";
import { Button } from "@/components/ui/button";
import { getAssignmentFormOptions } from "@/lib/actions/assignments";

export default async function NewAssignmentPage() {
  const { incidents, users, assignmentStatuses } =
    await getAssignmentFormOptions();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/assignments">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Nueva Asignación</h1>
          <p className="text-muted-foreground">Crear una nueva asignación</p>
        </div>
      </div>

      <AssignmentForm
        incidents={incidents}
        users={users}
        assignmentStatuses={assignmentStatuses}
      />
    </div>
  );
}
