import { Badge } from "@/components/ui/badge";

interface VehicleStatusBadgeProps {
  status: string;
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
  const config = statusConfig[status] || {
    label: status,
    variant: "outline" as const,
  };

  return <Badge variant={config.variant}>{config.label}</Badge>;
}
