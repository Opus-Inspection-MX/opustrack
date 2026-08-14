import { Badge } from "@/components/ui/badge";

/**
 * A user's roles, as badges.
 *
 * Plural on purpose: someone can administer vacations, administer operations
 * and still be an FSR, and every screen that used to print one role name would
 * otherwise show whichever happened to come back first.
 */
export function RoleBadges({
  userRoles,
  className,
}: {
  userRoles: Array<{ role: { name: string } }> | null | undefined;
  className?: string;
}) {
  const names = (userRoles ?? []).map((ur) => ur.role.name);

  if (names.length === 0) {
    return (
      <Badge variant="outline" className="text-muted-foreground">
        Sin rol
      </Badge>
    );
  }

  return (
    <div className={`flex flex-wrap gap-1 ${className ?? ""}`}>
      {names.map((name) => (
        <Badge key={name} variant="outline">
          {name}
        </Badge>
      ))}
    </div>
  );
}
