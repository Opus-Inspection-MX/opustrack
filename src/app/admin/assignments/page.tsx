import { Plus } from "lucide-react";
import Link from "next/link";
import { AssignmentsTable } from "@/components/admin/assignments/assignments-table";
import { Button } from "@/components/ui/button";
import { getAssignments } from "@/lib/actions/assignments";

export default async function AssignmentsPage() {
  const assignments = await getAssignments();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Asignaciones</h1>
          <p className="text-muted-foreground">
            Administre las asignaciones del sistema
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/assignments/new">
            <Plus className="mr-2 h-4 w-4" />
            Agregar Orden
          </Link>
        </Button>
      </div>

      <AssignmentsTable assignments={assignments} />
    </div>
  );
}
