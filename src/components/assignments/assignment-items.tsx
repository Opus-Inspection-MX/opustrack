"use client";

import { Package, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import {
  createAssignmentItem,
  deleteAssignmentItem,
} from "@/lib/actions/assignment-items";
import { isFailure } from "@/lib/actions/result";

export interface AssignmentItemRow {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

/**
 * Parts and equipment used, as an open list.
 *
 * Free text rather than a picker: there is no catalogue behind it, because a
 * catalogue with stock is a warehouse. The technician writes what was used.
 */
export function AssignmentItems({
  assignmentId,
  items,
  onChange,
  readOnly = false,
}: {
  assignmentId: string;
  items: AssignmentItemRow[];
  onChange?: () => void;
  readOnly?: boolean;
}) {
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unitPrice, setUnitPrice] = useState("0");
  const [saving, setSaving] = useState(false);

  const total = items.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0,
  );

  const add = async () => {
    setSaving(true);
    try {
      const result = await createAssignmentItem({
        assignmentId,
        name,
        quantity: Number.parseInt(quantity, 10),
        unitPrice: Number.parseFloat(unitPrice),
      });
      if (isFailure(result)) {
        toast.error(result.error);
        return;
      }
      setName("");
      setQuantity("1");
      setUnitPrice("0");
      onChange?.();
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    const result = await deleteAssignmentItem(id);
    if (isFailure(result)) {
      toast.error(result.error);
      return;
    }
    onChange?.();
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Package className="h-6 w-6" />
          Refacciones y Equipo ({items.length})
        </h2>
        <p className="text-sm text-muted-foreground">
          Total: ${total.toFixed(2)}
        </p>
      </div>

      <Card>
        <CardContent className="p-0">
          {items.length === 0 ? (
            <p className="p-6 text-center text-muted-foreground">
              Sin refacciones ni equipo registrados.
            </p>
          ) : (
            <div className="divide-y">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="p-4 flex items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <p className="font-medium truncate">{item.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {item.quantity} × ${item.unitPrice.toFixed(2)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <p className="font-bold">
                      ${(item.quantity * item.unitPrice).toFixed(2)}
                    </p>
                    {!readOnly && (
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Eliminar ${item.name}`}
                        onClick={() => remove(item.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {!readOnly && (
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto_auto] gap-3 md:items-end">
              <div className="space-y-2">
                <Label htmlFor="itemName">Refacción o equipo</Label>
                <Input
                  id="itemName"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej: Sensor de proximidad"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="itemQuantity">Cantidad</Label>
                <Input
                  id="itemQuantity"
                  type="number"
                  min="1"
                  className="md:w-28"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="itemUnitPrice">Precio unitario</Label>
                <Input
                  id="itemUnitPrice"
                  type="number"
                  min="0"
                  step="0.01"
                  className="md:w-32"
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(e.target.value)}
                />
              </div>
              <Button onClick={add} disabled={saving || !name.trim()}>
                <Plus className="h-4 w-4 mr-2" />
                {saving ? "Agregando..." : "Agregar"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
