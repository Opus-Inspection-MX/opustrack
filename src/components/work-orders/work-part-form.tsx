"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Save } from "lucide-react";
import { createWorkPart } from "@/lib/actions/work-parts";
import { FormError } from "@/components/ui/form-error";

type WorkPartFormProps = {
  workOrderId: string;
  workActivityId?: string;
  parts: Array<{
    id: string;
    name: string;
    description?: string | null;
    price: number;
    stock: number;
  }>;
  onSuccess?: () => void;
  onCancel?: () => void;
};

export function WorkPartForm({
  workOrderId,
  workActivityId,
  parts,
  onSuccess,
  onCancel,
}: WorkPartFormProps) {
  const [formData, setFormData] = useState({
    partId: "",
    quantity: 1,
    description: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedPart = parts.find((p) => p.id === formData.partId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Validate
      if (!formData.partId) {
        setError("Please select a part");
        setLoading(false);
        return;
      }

      if (formData.quantity <= 0) {
        setError("Quantity must be greater than 0");
        setLoading(false);
        return;
      }

      if (selectedPart && formData.quantity > selectedPart.stock) {
        setError(`Insufficient stock. Available: ${selectedPart.stock}`);
        setLoading(false);
        return;
      }

      // Create work part
      const result = await createWorkPart({
        workOrderId,
        workActivityId,
        partId: formData.partId,
        quantity: formData.quantity,
        description: formData.description || undefined,
      });

      if (!result.success) {
        throw new Error("Failed to add part");
      }

      // Reset form
      setFormData({
        partId: "",
        quantity: 1,
        description: "",
      });

      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      console.error("Error adding part:", err);
      setError((err as Error).message || "Failed to add part");
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plus className="h-5 w-5" />
          Add Parts Used
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <FormError message={error} />}

          <div className="space-y-2">
            <Label htmlFor="partId">
              Part <span className="text-red-500">*</span>
            </Label>
            <Select
              value={formData.partId}
              onValueChange={(value) =>
                setFormData({ ...formData, partId: value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a part" />
              </SelectTrigger>
              <SelectContent>
                {parts.map((part) => (
                  <SelectItem key={part.id} value={part.id}>
                    {part.name} - ${part.price.toFixed(2)} (Stock: {part.stock})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedPart && (
            <div className="p-3 bg-muted rounded-md space-y-1">
              <p className="text-sm font-medium">{selectedPart.name}</p>
              {selectedPart.description && (
                <p className="text-xs text-muted-foreground">
                  {selectedPart.description}
                </p>
              )}
              <div className="flex gap-4 text-xs">
                <span className="font-medium">
                  Price: ${selectedPart.price.toFixed(2)}
                </span>
                <span className={selectedPart.stock > 0 ? "text-green-600" : "text-red-600"}>
                  Stock: {selectedPart.stock}
                </span>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="quantity">
              Quantity <span className="text-red-500">*</span>
            </Label>
            <Input
              id="quantity"
              type="number"
              min="1"
              max={selectedPart?.stock || 999}
              value={formData.quantity}
              onChange={(e) =>
                setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })
              }
              required
            />
            {selectedPart && (
              <p className="text-xs text-muted-foreground">
                Total: ${(selectedPart.price * formData.quantity).toFixed(2)}
              </p>
            )}
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

          <div className="flex justify-end gap-2 pt-4">
            {onCancel && (
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={loading}
              >
                Cancel
              </Button>
            )}
            <Button type="submit" disabled={loading || !formData.partId}>
              {loading ? (
                "Adding..."
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Add Part
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
