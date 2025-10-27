"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Save, X, Edit as EditIcon } from "lucide-react";
import { updateWorkPart } from "@/lib/actions/work-parts";
import { FormError } from "@/components/ui/form-error";

type WorkPartEditProps = {
  workPart: {
    id: string;
    quantity: number;
    description: string | null;
    price: number;
    part: {
      id: string;
      name: string;
      stock: number;
    };
  };
  onSuccess?: () => void;
  onCancel?: () => void;
};

export function WorkPartEdit({
  workPart,
  onSuccess,
  onCancel,
}: WorkPartEditProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    quantity: workPart.quantity,
    description: workPart.description || "",
  });

  // Calculate available stock (current stock + quantity currently used)
  const availableStock = workPart.part.stock + workPart.quantity;
  const maxQuantity = availableStock;

  const handleSave = async () => {
    setLoading(true);
    setError(null);

    try {
      if (formData.quantity <= 0) {
        setError("Quantity must be greater than 0");
        setLoading(false);
        return;
      }

      if (formData.quantity > maxQuantity) {
        setError(`Insufficient stock. Maximum available: ${maxQuantity}`);
        setLoading(false);
        return;
      }

      const result = await updateWorkPart(workPart.id, {
        partId: workPart.part.id,
        quantity: formData.quantity,
        description: formData.description || undefined,
      });

      if (!result.success) {
        throw new Error("Failed to update part");
      }

      setIsEditing(false);
      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      console.error("Error updating part:", err);
      setError((err as Error).message || "Failed to update part");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      quantity: workPart.quantity,
      description: workPart.description || "",
    });
    setError(null);
    setIsEditing(false);
    if (onCancel) {
      onCancel();
    }
  };

  if (!isEditing) {
    return (
      <div className="p-4 flex items-center justify-between hover:bg-muted/50">
        <div className="flex-1">
          <p className="font-medium">{workPart.part?.name}</p>
          <p className="text-sm text-muted-foreground">
            Quantity: {workPart.quantity} × ${workPart.price.toFixed(2)}
          </p>
          {workPart.description && (
            <p className="text-xs text-muted-foreground mt-1">
              {workPart.description}
            </p>
          )}
        </div>
        <div className="flex items-center gap-4">
          <span className="font-bold">
            ${(workPart.price * workPart.quantity).toFixed(2)}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsEditing(true)}
          >
            <EditIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 bg-muted/30 border rounded-lg">
      {error && <FormError message={error} />}

      <div className="mb-3">
        <p className="font-medium text-sm">Editing: {workPart.part?.name}</p>
        <p className="text-xs text-muted-foreground">
          Price: ${workPart.price.toFixed(2)} • Available Stock: {maxQuantity}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="quantity">
          Quantity <span className="text-red-500">*</span>
        </Label>
        <Input
          id="quantity"
          type="number"
          min="1"
          max={maxQuantity}
          value={formData.quantity}
          onChange={(e) =>
            setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })
          }
          required
        />
        <p className="text-xs text-muted-foreground">
          Total: ${(workPart.price * formData.quantity).toFixed(2)} •
          Stock after save: {maxQuantity - formData.quantity}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Notes</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) =>
            setFormData({ ...formData, description: e.target.value })
          }
          placeholder="Additional notes about this part usage..."
          rows={2}
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button
          variant="outline"
          onClick={handleCancel}
          disabled={loading}
        >
          <X className="mr-2 h-4 w-4" />
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={loading}>
          {loading ? (
            "Saving..."
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Changes
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
