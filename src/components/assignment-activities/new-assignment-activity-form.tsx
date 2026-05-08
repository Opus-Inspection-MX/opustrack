"use client";

import { ArrowLeft, Save } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormError } from "@/components/ui/form-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createAssignmentActivity } from "@/lib/actions/assignment-activities";

export default function NewAssignmentActivityForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const assignmentId = searchParams.get("assignmentId");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState({
    assignmentId: assignmentId || "",
    description: "",
    performedAt: new Date().toISOString().slice(0, 16),
  });

  useEffect(() => {
    if (assignmentId) {
      setFormData((prev) => ({ ...prev, assignmentId }));
    }
  }, [assignmentId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setIsSubmitting(true);

    try {
      // Validation
      const newErrors: Record<string, string> = {};

      if (!formData.assignmentId.trim()) {
        newErrors.assignmentId = "Asignación es requerida";
      }

      if (!formData.description.trim()) {
        newErrors.description = "Description is required";
      }

      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        setIsSubmitting(false);
        return;
      }

      const result = await createAssignmentActivity({
        assignmentId: formData.assignmentId,
        description: formData.description,
        performedAt: new Date(formData.performedAt),
      });

      if (result.success) {
        router.push(`/admin/assignments/${formData.assignmentId}`);
      }
    } catch (error) {
      console.error("Error creating work activity:", error);
      setErrors({
        submit:
          error instanceof Error
            ? error.message
            : "Failed to create work activity. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Create Work Activity</h1>
          <p className="text-muted-foreground">
            Add a new activity to a asignación
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Work Activity Information</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {errors.submit && <FormError message={errors.submit} />}

            {/* Assignment ID */}
            <div className="space-y-2">
              <Label htmlFor="assignmentId">
                Assignment ID <span className="text-red-500">*</span>
              </Label>
              <Input
                id="assignmentId"
                value={formData.assignmentId}
                onChange={(e) => {
                  setFormData({ ...formData, assignmentId: e.target.value });
                  if (errors.assignmentId) {
                    setErrors({ ...errors, assignmentId: "" });
                  }
                }}
                placeholder="Assignment ID"
                disabled={!!assignmentId}
              />
              {errors.assignmentId && (
                <FormError message={errors.assignmentId} />
              )}
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">
                Description <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => {
                  setFormData({ ...formData, description: e.target.value });
                  if (errors.description) {
                    setErrors({ ...errors, description: "" });
                  }
                }}
                placeholder="Describe the work performed"
                rows={4}
              />
              {errors.description && <FormError message={errors.description} />}
            </div>

            {/* Performed At */}
            <div className="space-y-2">
              <Label htmlFor="performedAt">Performed At</Label>
              <Input
                id="performedAt"
                type="datetime-local"
                value={formData.performedAt}
                onChange={(e) =>
                  setFormData({ ...formData, performedAt: e.target.value })
                }
              />
            </div>

            <div className="flex justify-end gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <span>Creating...</span>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Create Activity
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
