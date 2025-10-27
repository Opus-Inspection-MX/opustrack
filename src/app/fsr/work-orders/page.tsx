import { getMyWorkOrders } from "@/lib/actions/work-orders";
import { requireRouteAccess } from "@/lib/auth/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Wrench, Calendar, CheckCircle, Clock, AlertTriangle } from "lucide-react";
import Link from "next/link";

export default async function FSRWorkOrdersPage() {
  await requireRouteAccess("/fsr");
  const workOrders = await getMyWorkOrders();

  // Calculate stats
  const stats = {
    total: workOrders.length,
    notStarted: workOrders.filter(wo => !wo.startedAt).length,
    inProgress: workOrders.filter(wo => wo.startedAt && !wo.finishedAt).length,
    completed: workOrders.filter(wo => wo.finishedAt).length,
  };

  const getStatusBadge = (workOrder: any) => {
    if (workOrder.finishedAt) {
      return <Badge variant="default" className="bg-green-600">Completed</Badge>;
    }
    if (workOrder.startedAt) {
      return <Badge variant="secondary">In Progress</Badge>;
    }
    return <Badge variant="outline">Not Started</Badge>;
  };

  const getPriorityColor = (priority: number) => {
    if (priority >= 8) return "text-red-600 font-bold";
    if (priority >= 5) return "text-orange-600 font-semibold";
    return "text-blue-600";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">My Work Orders</h1>
        <p className="text-muted-foreground mt-2">
          Work orders assigned to you
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <Wrench className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Not Started</CardTitle>
            <Clock className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.notStarted}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.inProgress}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completed}</div>
          </CardContent>
        </Card>
      </div>

      {/* Work Orders List */}
      <Card>
        <CardHeader>
          <CardTitle>Work Orders ({workOrders.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {workOrders.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Wrench className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p>No work orders assigned yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {workOrders.map((wo) => (
                <div
                  key={wo.id}
                  className="border rounded-lg p-4 hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-3">
                      {/* Status and Priority */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {getStatusBadge(wo)}
                        <Badge variant="outline" className={getPriorityColor(wo.incident?.priority || 0)}>
                          Priority: {wo.incident?.priority || 0}/10
                        </Badge>
                        {wo.incident?.type && (
                          <Badge variant="outline">{wo.incident.type.name}</Badge>
                        )}
                        {wo.status && (
                          <Badge variant="secondary">{wo.status.name}</Badge>
                        )}
                      </div>

                      {/* Incident Title */}
                      <div>
                        <h3 className="font-semibold text-lg">
                          {wo.incident?.title || "No incident"}
                        </h3>
                        {wo.notes && (
                          <p className="text-sm text-muted-foreground mt-1">{wo.notes}</p>
                        )}
                      </div>

                      {/* Details */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm text-muted-foreground">
                        {wo.incident?.vic && (
                          <div>
                            <span className="font-medium">VIC:</span> {wo.incident.vic.name}
                          </div>
                        )}
                        <div>
                          <span className="font-medium">Activities:</span> {wo._count?.workActivities || 0}
                        </div>
                        <div>
                          <span className="font-medium">Parts:</span> {wo._count?.workParts || 0}
                        </div>
                      </div>

                      {/* Dates */}
                      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Created: {new Date(wo.createdAt).toLocaleDateString()}
                        </div>
                        {wo.startedAt && (
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Started: {new Date(wo.startedAt).toLocaleDateString()}
                          </div>
                        )}
                        {wo.finishedAt && (
                          <div className="flex items-center gap-1">
                            <CheckCircle className="h-3 w-3" />
                            Completed: {new Date(wo.finishedAt).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action Button */}
                    <div>
                      <Button asChild>
                        <Link href={`/fsr/work-orders/${wo.id}`}>
                          {wo.finishedAt ? "View" : "Work On It"}
                        </Link>
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
