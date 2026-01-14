import { Badge } from "@/components/ui/badge";

interface VehicleStatusBadgeProps {
  status: string | { id: number; name: string; active?: boolean };
}

const statusConfig: Record<
  string,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
  }
> = {
  AVAILABLE: { label: "Available", variant: "default" },
  IN_USE: { label: "In Use", variant: "secondary" },
  MAINTENANCE: { label: "Maintenance", variant: "outline" },
  INACTIVE: { label: "Inactive", variant: "destructive" },
};

export function VehicleStatusBadge({ status }: VehicleStatusBadgeProps) {
  const statusName = typeof status === "string" ? status : status.name;
  const config = statusConfig[statusName] || {
    label: statusName,
    variant: "outline" as const,
  };

  return <Badge variant={config.variant}>{config.label}</Badge>;
}
