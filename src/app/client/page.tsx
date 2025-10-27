import { getClientIncidents } from "@/lib/actions/incidents";
import { requireRouteAccess } from "@/lib/auth/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, AlertTriangle, Clock, CheckCircle, Building } from "lucide-react";
import Link from "next/link";
import { getMyProfile } from "@/lib/actions/users";

export default async function ClientDashboard() {
  await requireRouteAccess("/client");
  const incidents = await getClientIncidents();
  const user = await getMyProfile();

  // Calculate stats
  const stats = {
    open: incidents.filter((i) => i.status?.name === "ABIERTO").length,
    inProgress: incidents.filter((i) => i.status?.name === "EN_PROGRESO" || i.status?.name === "PENDIENTE").length,
    closed: incidents.filter((i) => i.status?.name === "CERRADO").length,
    total: incidents.length,
  };

  const getPriorityBadge = (priority: number) => {
    if (priority >= 8) {
      return <Badge variant="destructive">Critical</Badge>;
    }
    if (priority >= 5) {
      return <Badge variant="default" className="bg-orange-500">High</Badge>;
    }
    if (priority >= 3) {
      return <Badge variant="secondary">Medium</Badge>;
    }
    return <Badge variant="outline">Low</Badge>;
  };

  const getStatusBadge = (statusName: string | undefined) => {
    if (!statusName) return <Badge variant="outline">Unknown</Badge>;

    if (statusName === "ABIERTO") {
      return <Badge variant="default" className="bg-blue-600">Open</Badge>;
    }
    if (statusName === "EN_PROGRESO" || statusName === "PENDIENTE") {
      return <Badge variant="secondary">In Progress</Badge>;
    }
    if (statusName === "CERRADO") {
      return <Badge variant="default" className="bg-green-600">Closed</Badge>;
    }
    return <Badge variant="outline">{statusName}</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">My Incidents</h1>
          <p className="text-muted-foreground mt-2">
            Track and report incidents for your VIC
          </p>
        </div>
        <Button asChild>
          <Link href="/client/new">
            <Plus className="h-4 w-4 mr-2" />
            Report Incident
          </Link>
        </Button>
      </div>

      {/* VIC Info */}
      {user?.vic && (
        <Card className="bg-muted/30">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <Building className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Your VIC</p>
                <p className="font-medium">{user.vic.name} ({user.vic.code})</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Incidents</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open</CardTitle>
            <AlertTriangle className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.open}</div>
            <p className="text-xs text-muted-foreground">Awaiting response</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.inProgress}</div>
            <p className="text-xs text-muted-foreground">Being resolved</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resolved</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.closed}</div>
            <p className="text-xs text-muted-foreground">Completed</p>
          </CardContent>
        </Card>
      </div>

      {/* Incidents List */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Incidents</CardTitle>
          <CardDescription>Your reported incidents and their status</CardDescription>
        </CardHeader>
        <CardContent>
          {incidents.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <AlertTriangle className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p>No incidents reported yet</p>
              <Button asChild variant="outline" className="mt-4">
                <Link href="/client/new">
                  <Plus className="h-4 w-4 mr-2" />
                  Report Your First Incident
                </Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {incidents.map((incident) => (
                <div
                  key={incident.id}
                  className="flex items-start justify-between p-4 border rounded-lg hover:bg-accent transition-colors"
                >
                  <div className="space-y-2 flex-1">
                    {/* Badges */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm text-muted-foreground">
                        #{incident.id}
                      </span>
                      {getPriorityBadge(incident.priority)}
                      {getStatusBadge(incident.status?.name)}
                      {incident.type && (
                        <Badge variant="outline">{incident.type.name}</Badge>
                      )}
                    </div>

                    {/* Title */}
                    <h3 className="font-semibold text-lg">{incident.title}</h3>

                    {/* Description */}
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {incident.description}
                    </p>

                    {/* Details */}
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>
                        Reported: {new Date(incident.reportedAt).toLocaleDateString()}
                      </span>
                      <span>SLA: {incident.sla}h</span>
                      {incident._count?.workOrders && incident._count.workOrders > 0 && (
                        <span>Work Orders: {incident._count.workOrders}</span>
                      )}
                    </div>
                  </div>

                  {/* Action Button */}
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/client/incidents/${incident.id}`}>
                      View Details
                    </Link>
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button asChild variant="outline" className="h-auto py-4">
              <Link href="/client/new" className="flex flex-col items-center gap-2">
                <Plus className="h-6 w-6" />
                <span>Report New Incident</span>
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-auto py-4">
              <Link href="/profile" className="flex flex-col items-center gap-2">
                <Building className="h-6 w-6" />
                <span>My Profile</span>
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
