import {
  ClipboardList,
  Layers,
  Route,
  Settings2,
  Truck,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireRouteAccess } from "@/lib/auth/auth";

export default async function SettingsPage() {
  await requireRouteAccess("/admin/settings");

  const statusCategories = [
    {
      title: "Estado de Línea",
      description: "Gestionar estados de línea de verificación",
      icon: Layers,
      href: "/admin/settings/line-status",
      color: "text-blue-600",
    },
    {
      title: "Estado de Equipo",
      description: "Gestionar estados de equipo",
      icon: Wrench,
      href: "/admin/settings/equipment-status",
      color: "text-green-600",
    },
    {
      title: "Estado de Vehículo",
      description: "Gestionar estados de vehículo",
      icon: Truck,
      href: "/admin/settings/vehicle-status",
      color: "text-orange-600",
    },
    {
      title: "Estado de Asignación",
      description: "Gestionar estados de asignación",
      icon: ClipboardList,
      href: "/admin/settings/assignment-status",
      color: "text-amber-600",
    },
    {
      title: "Estado de Viaje Vehicular",
      description: "Gestionar estados de viaje vehicular",
      icon: Route,
      href: "/admin/settings/vehicle-trip-status",
      color: "text-purple-600",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Settings2 className="h-8 w-8" />
        <div>
          <h1 className="text-3xl font-bold">Configuración</h1>
          <p className="text-muted-foreground">
            Gestionar configuración del sistema y tablas de referencia
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {statusCategories.map((category) => {
          const Icon = category.icon;
          return (
            <Link key={category.href} href={category.href}>
              <Card className="hover:border-primary transition-colors cursor-pointer">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <Icon className={`h-6 w-6 ${category.color}`} />
                    <CardTitle className="text-lg">{category.title}</CardTitle>
                  </div>
                  <CardDescription>{category.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="ghost" className="w-full">
                    Gestionar →
                  </Button>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
