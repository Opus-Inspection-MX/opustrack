"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Save, X, Edit as EditIcon } from "lucide-react";
import { updateWorkActivity } from "@/lib/actions/work-activities";
import { FormError } from "@/components/ui/form-error";

type WorkActivityEditProps = {
  activity: {
    id: string;
    description: string;
    performedAt: Date;
  };
  onSuccess?: () => void;
  onCancel?: () => void;
  readOnly?: boolean;
};

export function WorkActivityEdit({
  activity,
  onSuccess,
  onCancel,
  readOnly = false,
}: WorkActivityEditProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    description: activity.description,
    performedAt: new Date(activity.performedAt).toISOString().slice(0, 16), // Format for datetime-local input
  });

  const handleSave = async () => {
    setLoading(true);
    setError(null);

    try {
      if (!formData.description.trim()) {
        setError("Description is required");
        setLoading(false);
        return;
      }

      const result = await updateWorkActivity(activity.id, {
        workOrderId: "", // Not used in update
        description: formData.description.trim(),
        performedAt: new Date(formData.performedAt),
      });

      if (!result.success) {
        throw new Error("Failed to update activity");
      }

      setIsEditing(false);
      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      console.error("Error updating activity:", err);
      setError((err as Error).message || "Failed to update activity");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      description: activity.description,
      performedAt: new Date(activity.performedAt).toISOString().slice(0, 16),
    });
    setError(null);
    setIsEditing(false);
    if (onCancel) {
      onCancel();
    }
  };

  if (!isEditing) {
    return (
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="font-medium text-base">
            {new Date(activity.performedAt).toLocaleString()}
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            {activity.description}
          </p>
        </div>
        {!readOnly && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsEditing(true)}
          >
            <EditIcon className="h-4 w-4" />
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && <FormError message={error} />}

      <div className="space-y-2">
        <Label htmlFor="performedAt">
          Date & Time <span className="text-red-500">*</span>
        </Label>
        <Input
          id="performedAt"
          type="datetime-local"
          value={formData.performedAt}
          onChange={(e) =>
            setFormData({ ...formData, performedAt: e.target.value })
          }
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">
          Description <span className="text-red-500">*</span>
        </Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) =>
            setFormData({ ...formData, description: e.target.value })
          }
          placeholder="Describe the work performed..."
          rows={4}
          required
        />
      </div>

      <div className="flex justify-end gap-2">
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
