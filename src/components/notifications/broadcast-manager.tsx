"use client";

import { useState } from "react";
import {
  type BroadcastListRow,
  type BroadcastTargetRole,
  listBroadcasts,
} from "@/lib/actions/broadcasts";
import { BroadcastForm } from "./broadcast-form";
import { BroadcastHistory } from "./broadcast-history";

interface BroadcastManagerProps {
  initialRows: BroadcastListRow[];
  allowedRoles: BroadcastTargetRole[];
  canTargetAll: boolean;
}

/**
 * Client owner of the broadcasts screen state: the composer (create or edit)
 * plus the scheduled/history tables. Refreshes the list from the server
 * after every mutation.
 */
export function BroadcastManager({
  initialRows,
  allowedRoles,
  canTargetAll,
}: BroadcastManagerProps) {
  const [rows, setRows] = useState<BroadcastListRow[]>(initialRows);
  const [editing, setEditing] = useState<BroadcastListRow | null>(null);

  const refresh = async () => {
    setRows(await listBroadcasts());
  };

  return (
    <div className="space-y-6">
      <BroadcastForm
        allowedRoles={allowedRoles}
        canTargetAll={canTargetAll}
        editing={editing}
        onCancelEdit={() => setEditing(null)}
        onSaved={refresh}
      />
      <BroadcastHistory rows={rows} onEdit={setEditing} onChanged={refresh} />
    </div>
  );
}
