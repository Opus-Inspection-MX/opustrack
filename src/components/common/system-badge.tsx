import { Badge } from "@/components/ui/badge";

/**
 * Marks a catalog row owned by the system (Fase 3, H-08/H-09).
 *
 * Rows with a stable `code` cannot be deactivated; `name` stays an editable
 * label. Operator-facing copy is Spanish, like the rest of the catalog UI.
 */
export function SystemBadge({ code }: { code?: string | null }) {
  if (!code) return null;
  return (
    <Badge variant="secondary" title={`Código del sistema: ${code}`}>
      Sistema
    </Badge>
  );
}
