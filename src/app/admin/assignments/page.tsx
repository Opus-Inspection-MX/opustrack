import { Plus } from "lucide-react";
import Link from "next/link";
import { AssignmentsTable } from "@/components/admin/assignments/assignments-table";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { SectionCard } from "@/components/common/section-card";
import { Button } from "@/components/ui/button";
import { getAssignments } from "@/lib/actions/assignments";

export default async function AssignmentsPage() {
  const assignments = await getAssignments();

  return (
    <PageContainer>
      <PageHeader
        title="Asignaciones"
        description="Administre las asignaciones del sistema"
        actions={
          <Button asChild className="w-full sm:w-auto">
            <Link href="/admin/assignments/new">
              <Plus className="mr-2 h-4 w-4" aria-hidden />
              Agregar Orden
            </Link>
          </Button>
        }
      />

      <SectionCard title={`Asignaciones (${assignments.length})`}>
        <AssignmentsTable assignments={assignments} />
      </SectionCard>
    </PageContainer>
  );
}
