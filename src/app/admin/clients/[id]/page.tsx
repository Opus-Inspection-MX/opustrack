import {
  AlertTriangle,
  Building,
  Calendar,
  Edit,
  Mail,
  MapPin,
  Package,
  Phone,
  User,
  Users,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BackButton } from "@/components/common/back-button";
import { EmptyState } from "@/components/common/empty-state";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { ResponsiveTable } from "@/components/common/responsive-table";
import { SectionCard } from "@/components/common/section-card";
import { StatCard } from "@/components/common/stat-card";
import { StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RoleBadges } from "@/components/users/role-badges";
import { getClientById } from "@/lib/actions/clients";
import { requireRouteAccess } from "@/lib/auth/auth";
import { formatIncidentDateTime } from "@/lib/utils/datetime";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRouteAccess("/admin/clients");
  const { id } = await params;
  const client = await getClientById(id);

  if (!client) notFound();

  return (
    <PageContainer>
      <PageHeader
        title={client.name}
        description={`Código Cliente: ${client.code}`}
        breadcrumbs={[
          { label: "Centros de Verificación", href: "/admin/clients" },
          { label: client.code },
        ]}
        actions={
          <Button asChild className="w-full sm:w-auto">
            <Link href={`/admin/clients/${id}/edit`}>
              <Edit className="h-4 w-4 mr-2" aria-hidden />
              Editar
            </Link>
          </Button>
        }
      />
      <div>
        <BackButton fallback="/admin/clients" />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          title="Total Usuarios"
          value={client._count.users}
          description="Usuarios asignados"
          icon={Users}
        />
        <StatCard
          title="Líneas"
          value={client._count.lines}
          description="Líneas de inspección"
          icon={Wrench}
        />
        <StatCard
          title="Incidentes"
          value={client._count.incidents}
          description="Total de incidentes"
          icon={AlertTriangle}
        />
        <StatCard
          title="Calendarios"
          value={client._count.scheduleClients}
          description="Total de calendarios"
          icon={Calendar}
        />
      </div>

      {/* Cliente Information */}
      <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
        <SectionCard title="Información Básica">
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <Building className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">
                  Nombre del Cliente
                </p>
                <p className="font-medium">{client.name}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Building className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Código Cliente</p>
                <p className="font-medium font-mono">{client.code}</p>
              </div>
            </div>

            {client.companyName && (
              <div className="flex items-start gap-3">
                <Building className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Razón Social</p>
                  <p className="font-medium">{client.companyName}</p>
                </div>
              </div>
            )}

            {client.rfc && (
              <div className="flex items-start gap-3">
                <Building
                  className="h-5 w-5 text-muted-foreground mt-0.5"
                  aria-hidden
                />
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">RFC</p>
                  <p className="font-medium font-mono">{client.rfc}</p>
                </div>
              </div>
            )}
          </div>
        </SectionCard>

        <SectionCard title="Información de Contacto">
          <div className="space-y-4">
            {client.address && (
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Dirección</p>
                  <p className="font-medium">{client.address}</p>
                </div>
              </div>
            )}

            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Estado</p>
                <p className="font-medium">{client.state.name}</p>
              </div>
            </div>

            {client.contact && (
              <div className="flex items-start gap-3">
                <User className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">
                    Persona de Contacto
                  </p>
                  <p className="font-medium">{client.contact}</p>
                </div>
              </div>
            )}

            {client.phone && (
              <div className="flex items-start gap-3">
                <Phone className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Teléfono</p>
                  <p className="font-medium">{client.phone}</p>
                </div>
              </div>
            )}

            {client.email && (
              <div className="flex items-start gap-3">
                <Mail
                  className="h-5 w-5 text-muted-foreground mt-0.5"
                  aria-hidden
                />
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">
                    Correo Electrónico
                  </p>
                  <p className="font-medium">{client.email}</p>
                </div>
              </div>
            )}
          </div>
        </SectionCard>
      </div>

      {/* Assigned Users */}
      <SectionCard
        title={`Usuarios Asignados (${client.users.length})`}
        description="Usuarios asignados a este Cliente"
      >
        {client.users.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Sin usuarios"
            description="No hay usuarios asignados a este Cliente"
          />
        ) : (
          <ResponsiveTable
            data={client.users}
            rowKey={(user) => user.id}
            columns={[
              {
                header: "Nombre",
                cell: (user) => (
                  <span className="font-medium">{user.name}</span>
                ),
              },
              {
                header: "Correo Electrónico",
                cell: (user) => <span>{user.email}</span>,
              },
              {
                header: "Rol",
                cell: (user) => <RoleBadges userRoles={user.userRoles} />,
              },
              {
                header: "Estado",
                cell: (user) => (
                  <StatusBadge
                    tone={
                      user.userStatus.name === "ACTIVO" ? "success" : "neutral"
                    }
                  >
                    {user.userStatus.name}
                  </StatusBadge>
                ),
              },
              {
                header: "Acciones",
                headerClassName: "text-right",
                className: "text-right",
                cell: (user) => (
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/admin/users/${user.id}`}>Ver</Link>
                  </Button>
                ),
              },
            ]}
            mobileCard={(user) => (
              <div className="space-y-2 rounded-xl border bg-card p-4">
                <p className="font-medium">{user.name}</p>
                <p className="text-xs text-muted-foreground">{user.email}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <RoleBadges userRoles={user.userRoles} />
                  <StatusBadge
                    tone={
                      user.userStatus.name === "ACTIVO" ? "success" : "neutral"
                    }
                  >
                    {user.userStatus.name}
                  </StatusBadge>
                </div>
                <Button variant="outline" size="sm" asChild className="w-full">
                  <Link href={`/admin/users/${user.id}`}>Ver</Link>
                </Button>
              </div>
            )}
            emptyTitle="Sin usuarios"
            emptyMessage="No hay usuarios asignados a este Cliente"
          />
        )}
      </SectionCard>

      {/* Lines and Equipment */}
      <SectionCard
        title={`Líneas y Equipos (${client.lines.length})`}
        description="Líneas de inspección y sus equipos"
      >
        {client.lines.length === 0 ? (
          <EmptyState
            icon={Wrench}
            title="Sin líneas"
            description="No hay líneas asignadas a este Cliente"
          />
        ) : (
          <div className="space-y-6">
            {client.lines.map((line) => (
              <div key={line.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-lg">{line.name}</h3>
                    {line.description && (
                      <p className="text-sm text-muted-foreground">
                        {line.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge tone="neutral">
                      {line.equipments.length} equipos
                    </StatusBadge>
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/admin/lines/${line.id}`}>Ver Línea</Link>
                    </Button>
                  </div>
                </div>

                {line.equipments.length > 0 ? (
                  <div className="border rounded-lg overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Equipo</TableHead>
                          <TableHead>Descripción</TableHead>
                          <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {line.equipments.map((equipment) => (
                          <TableRow key={equipment.id}>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                <Package className="h-4 w-4 text-muted-foreground" />
                                {equipment.name}
                              </div>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                              {equipment.description || "-"}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button variant="ghost" size="sm" asChild>
                                <Link
                                  href={`/admin/equipments/${equipment.id}/edit`}
                                >
                                  Ver
                                </Link>
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No hay equipos en esta línea
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Recent Incidents */}
      {client.incidents.length > 0 && (
        <SectionCard
          title={`Incidentes Recientes (Últimos ${client.incidents.length})`}
          description="Incidentes más recientes reportados para este Cliente"
        >
          <ResponsiveTable
            data={client.incidents}
            rowKey={(incident) => incident.id}
            columns={[
              {
                header: "ID",
                cell: (incident) => (
                  <span className="font-mono text-sm">INC-{incident.id}</span>
                ),
              },
              {
                header: "Título",
                cell: (incident) => (
                  <span className="font-medium max-w-xs truncate block">
                    {incident.title}
                  </span>
                ),
              },
              {
                header: "Tipo",
                cell: (incident) =>
                  incident.type ? (
                    <StatusBadge tone="neutral">
                      {incident.type.name}
                    </StatusBadge>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  ),
              },
              {
                header: "Estado",
                cell: (incident) =>
                  incident.status ? (
                    <StatusBadge tone="info">
                      {incident.status.name}
                    </StatusBadge>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  ),
              },
              {
                header: "Reportado",
                cell: (incident) => (
                  <span className="text-sm">
                    {/* This page is scoped to one center, so show its own
                        clock (plus CDMX when they differ). */}
                    {formatIncidentDateTime(
                      incident.reportedAt,
                      client.state.code,
                    )}
                  </span>
                ),
              },
              {
                header: "Acciones",
                headerClassName: "text-right",
                className: "text-right",
                cell: (incident) => (
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/admin/incidents/${incident.id}`}>Ver</Link>
                  </Button>
                ),
              },
            ]}
            mobileCard={(incident) => (
              <div className="space-y-2 rounded-xl border bg-card p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-muted-foreground">
                    INC-{incident.id}
                  </span>
                  {incident.status && (
                    <StatusBadge tone="info">
                      {incident.status.name}
                    </StatusBadge>
                  )}
                </div>
                <p className="font-medium">{incident.title}</p>
                <Button variant="outline" size="sm" asChild className="w-full">
                  <Link href={`/admin/incidents/${incident.id}`}>Ver</Link>
                </Button>
              </div>
            )}
            emptyTitle="Sin incidentes"
            emptyMessage="No hay incidentes recientes para este Cliente"
          />
        </SectionCard>
      )}
    </PageContainer>
  );
}
