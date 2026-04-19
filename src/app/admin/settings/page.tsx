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
      title: "Line Status",
      description: "Manage verification line statuses",
      icon: Layers,
      href: "/admin/settings/line-status",
      color: "text-blue-600",
    },
    {
      title: "Equipment Status",
      description: "Manage equipment statuses",
      icon: Wrench,
      href: "/admin/settings/equipment-status",
      color: "text-green-600",
    },
    {
      title: "Vehicle Status",
      description: "Manage vehicle statuses",
      icon: Truck,
      href: "/admin/settings/vehicle-status",
      color: "text-orange-600",
    },
    {
      title: "Work Order Status",
      description: "Manage work order statuses",
      icon: ClipboardList,
      href: "/admin/settings/work-order-status",
      color: "text-amber-600",
    },
    {
      title: "Vehicle Trip Status",
      description: "Manage vehicle trip statuses",
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
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground">
            Manage system configuration and lookup tables
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
                    Manage →
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
