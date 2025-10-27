"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Save } from "lucide-react";
import { FormError } from "@/components/ui/form-error";
import { Spinner } from "@/components/ui/spinner";
import {
  getWorkActivityById,
  updateWorkActivity,
} from "@/lib/actions/work-activities";

export default function EditWorkActivityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState({
    description: "",
    performedAt: "",
  });

  useEffect(() => {
    const fetchActivity = async () => {
      try {
        const activity = await getWorkActivityById(id);
        if (activity) {
          setFormData({
            description: activity.description,
            performedAt: new Date(activity.performedAt)
              .toISOString()
              .slice(0, 16),
          });
        }
      } catch (error) {
        console.error("Error fetching work activity:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchActivity();
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setIsSubmitting(true);

    try {
      // Validation
      const newErrors: Record<string, string> = {};

      if (!formData.description.trim()) {
        newErrors.description = "Description is required";
      }

      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        setIsSubmitting(false);
        return;
      }

      const result = await updateWorkActivity(id, {
        description: formData.description,
        performedAt: new Date(formData.performedAt),
      });

      if (result.success) {
        router.push(`/admin/work-activities/${id}`);
      }
    } catch (error) {
      console.error("Error updating work activity:", error);
      setErrors({
        submit:
          error instanceof Error
            ? error.message
            : "Failed to update work activity. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" text="Loading work activity..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Edit Work Activity</h1>
          <p className="text-muted-foreground">
            Update work activity information
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
              {errors.description && (
                <FormError message={errors.description} />
              )}
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
                  <span>Updating...</span>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Update Activity
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
