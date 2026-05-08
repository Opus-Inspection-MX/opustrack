import { ArrowLeft, Edit } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAssignmentStatusById } from "@/lib/actions/lookups";
import { requireRouteAccess } from "@/lib/auth/auth";

export default async function AssignmentStatusDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRouteAccess("/admin/settings/assignment-status");

  const { id } = await params;
  const status = await getAssignmentStatusById(Number.parseInt(id, 10));

  if (!status) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/settings/assignment-status">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">{status.name}</h1>
            <p className="text-muted-foreground">Asignación status details</p>
          </div>
        </div>
        <Link href={`/admin/settings/assignment-status/${status.id}/edit`}>
          <Button>
            <Edit className="mr-2 h-4 w-4" />
            Edit
          </Button>
        </Link>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">ID</p>
              <p className="text-lg">{status.id}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Name</p>
              <p className="text-lg">{status.name}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Color</p>
              <div className="flex items-center gap-2">
                <span
                  className="inline-block w-6 h-6 rounded-full border"
                  style={{ backgroundColor: status.color }}
                />
                <span>{status.color}</span>
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Status
              </p>
              <p className="text-lg">
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    status.active
                      ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                      : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
                  }`}
                >
                  {status.active ? "Active" : "Inactive"}
                </span>
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Usage Statistics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Assignments Using This Status
              </p>
              <p className="text-3xl font-bold">
                {status._count?.assignments || 0}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
