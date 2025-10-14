"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileUpload } from "@/components/ui/file-upload";
import { Plus, Save } from "lucide-react";
import { createWorkActivity } from "@/lib/actions/work-activities";
import { uploadWorkOrderAttachment } from "@/lib/actions/work-orders";
import { fileToBase64 } from "@/lib/upload";
import { FormError } from "@/components/ui/form-error";

type WorkActivityFormProps = {
  workOrderId: string;
  onSuccess?: () => void;
  onCancel?: () => void;
};

export function WorkActivityForm({
  workOrderId,
  onSuccess,
  onCancel,
}: WorkActivityFormProps) {
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Validate description
      if (!description.trim()) {
        setError("Description is required");
        setLoading(false);
        return;
      }

      // Create work activity
      const result = await createWorkActivity({
        workOrderId,
        description: description.trim(),
        performedAt: new Date(),
      });

      if (!result.success) {
        throw new Error("Failed to create work activity");
      }

      // Upload files if any
      if (files.length > 0) {
        const uploadPromises = files.map(async (file) => {
          const base64Data = await fileToBase64(file);
          return uploadWorkOrderAttachment(workOrderId, {
            filename: file.name,
            base64Data,
            mimetype: file.type,
            size: file.size,
            description: `Attached to activity: ${description.substring(0, 50)}`,
          });
        });

        await Promise.all(uploadPromises);
      }

      // Reset form
      setDescription("");
      setFiles([]);

      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      console.error("Error creating work activity:", err);
      setError((err as Error).message || "Failed to create work activity");
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plus className="h-5 w-5" />
          Add Work Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <FormError message={error} />}

          <div className="space-y-2">
            <Label htmlFor="description">
              Description <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the work performed..."
              rows={4}
              required
            />
            <p className="text-xs text-muted-foreground">
              Provide a detailed description of the work activity performed
            </p>
          </div>

          <FileUpload
            onFilesSelected={setFiles}
            maxFiles={10}
            maxSizeMB={10}
            label="Evidence Files (Photos, Videos, Documents)"
            showCamera={true}
          />

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
            <Button type="submit" disabled={loading}>
              {loading ? (
                "Saving..."
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Activity
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
