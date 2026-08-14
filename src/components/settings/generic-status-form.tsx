"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";

type StatusFormData = {
  name: string;
  active?: boolean;
};

interface GenericStatusFormProps {
  initialData?: StatusFormData;
  onSubmit: (data: StatusFormData) => Promise<{
    success: boolean;
    data?: StatusFormData;
  }>;
  redirectPath: string;
  title: string;
  isEdit?: boolean;
}

export function GenericStatusForm({
  initialData,
  onSubmit,
  redirectPath,
  title,
  isEdit = false,
}: GenericStatusFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState<StatusFormData>({
    name: initialData?.name || "",
    active: initialData?.active ?? true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const result = await onSubmit(formData);
      if (result.success) {
        router.push(redirectPath);
        router.refresh();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              required
              placeholder="Enter status name"
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="active" className="cursor-pointer">
              Active Status
            </Label>
            <Switch
              id="active"
              checked={formData.active}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, active: checked })
              }
            />
          </div>
        </CardContent>
      </Card>

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
          {isSubmitting
            ? isEdit
              ? "Updating..."
              : "Creating..."
            : isEdit
              ? "Update Status"
              : "Create Status"}
        </Button>
      </div>
    </form>
  );
}
