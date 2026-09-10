"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { setRoleBroadcastTargets } from "@/lib/actions/broadcasts";
import { isFailure } from "@/lib/actions/result";

interface BroadcastTargetsFormProps {
  roleId: number;
  roleName: string;
  allRoles: Array<{ id: number; name: string; description: string | null }>;
  initialTargetIds: number[];
}

/**
 * "Puede difundir a" — which roles this role may broadcast to. Rendered only
 * for ROOT (the page hides it otherwise); the action re-checks with
 * `assertCanManageRoles`, so a crafted request still fails closed.
 */
export function BroadcastTargetsForm({
  roleId,
  roleName,
  allRoles,
  initialTargetIds,
}: BroadcastTargetsFormProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<number[]>(initialTargetIds);
  const [saving, setSaving] = useState(false);

  const toggle = (id: number) => {
    setSelected((ids) =>
      ids.includes(id) ? ids.filter((i) => i !== id) : [...ids, id],
    );
  };

  const save = async () => {
    setSaving(true);
    try {
      const result = await setRoleBroadcastTargets(roleId, selected);
      if (isFailure(result)) {
        toast.error("No se pudo guardar", result.error);
        return;
      }
      toast.success("Destinos de difusión actualizados");
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Puede difundir a</CardTitle>
        <CardDescription>
          Roles a los que {roleName} puede enviar difusiones. Sin selección, no
          llega a nadie.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {allRoles.map((role) => (
            <div
              key={role.id}
              className="flex items-center gap-2 text-sm"
              title={role.description ?? undefined}
            >
              <Checkbox
                id={`broadcast-target-${role.id}`}
                checked={selected.includes(role.id)}
                onCheckedChange={() => toggle(role.id)}
                disabled={saving}
              />
              <label htmlFor={`broadcast-target-${role.id}`}>{role.name}</label>
            </div>
          ))}
        </div>
        <div className="flex justify-end">
          <Button onClick={save} disabled={saving}>
            {saving ? "Guardando..." : "Guardar destinos"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
