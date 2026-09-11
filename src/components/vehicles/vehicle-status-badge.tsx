import { StatusBadge, type StatusTone } from "@/components/common/status-badge";

interface VehicleStatusBadgeProps {
  status: string | { id: number; name: string; active?: boolean };
}

const statusConfig: Record<string, { label: string; tone: StatusTone }> = {
  AVAILABLE: { label: "Available", tone: "success" },
  IN_USE: { label: "In Use", tone: "info" },
  MAINTENANCE: { label: "Maintenance", tone: "warning" },
  INACTIVE: { label: "Inactive", tone: "neutral" },
};

export function VehicleStatusBadge({ status }: VehicleStatusBadgeProps) {
  const statusName = typeof status === "string" ? status : status.name;
  const config = statusConfig[statusName] || {
    label: statusName,
    tone: "neutral" as const,
  };

  return <StatusBadge tone={config.tone}>{config.label}</StatusBadge>;
}
