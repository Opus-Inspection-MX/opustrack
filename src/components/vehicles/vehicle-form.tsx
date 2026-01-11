"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FormError } from "@/components/ui/form-error";
import { createVehicle, updateVehicle } from "@/lib/actions/vehicles";

interface Vehicle {
  id: string;
  make: string;
  model: string;
  year: number;
  licensePlate: string;
  vin?: string | null;
  color?: string | null;
  status: string;
  notes?: string | null;
}

interface VehicleFormProps {
  vehicle?: Vehicle;
  mode: "create" | "edit";
}

export function VehicleForm({ vehicle, mode }: VehicleFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({
    make: vehicle?.make || "",
    model: vehicle?.model || "",
    year: vehicle?.year || new Date().getFullYear(),
    licensePlate: vehicle?.licensePlate || "",
    vin: vehicle?.vin || "",
    color: vehicle?.color || "",
    status: vehicle?.status || "AVAILABLE",
    notes: vehicle?.notes || "",
  });

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    if (!formData.make || !formData.model || !formData.licensePlate) {
      setError("Make, model, and license plate are required");
      return;
    }

    if (formData.year < 1900 || formData.year > new Date().getFullYear() + 1) {
      setError("Please enter a valid year");
      return;
    }

    setIsSubmitting(true);

    try {
      if (mode === "create") {
        await createVehicle(formData);
        router.push("/admin/vehicles");
      } else if (vehicle) {
        await updateVehicle(vehicle.id, formData);
        router.push(`/admin/vehicles/${vehicle.id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {mode === "create" ? "Create Vehicle" : "Edit Vehicle"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <FormError message={error} />}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="make">Make *</Label>
              <Input
                id="make"
                value={formData.make}
                onChange={(e) =>
                  setFormData({ ...formData, make: e.target.value })
                }
                placeholder="e.g., Toyota"
                required
              />
            </div>

            <div>
              <Label htmlFor="model">Model *</Label>
              <Input
                id="model"
                value={formData.model}
                onChange={(e) =>
                  setFormData({ ...formData, model: e.target.value })
                }
                placeholder="e.g., Corolla"
                required
              />
            </div>

            <div>
              <Label htmlFor="year">Year *</Label>
              <Input
                id="year"
                type="number"
                value={formData.year}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    year: Number.parseInt(e.target.value),
                  })
                }
                min={1900}
                max={new Date().getFullYear() + 1}
                required
              />
            </div>

            <div>
              <Label htmlFor="licensePlate">License Plate *</Label>
              <Input
                id="licensePlate"
                value={formData.licensePlate}
                onChange={(e) =>
                  setFormData({ ...formData, licensePlate: e.target.value })
                }
                placeholder="e.g., ABC-123-XYZ"
                required
              />
            </div>

            <div>
              <Label htmlFor="vin">VIN (Optional)</Label>
              <Input
                id="vin"
                value={formData.vin}
                onChange={(e) =>
                  setFormData({ ...formData, vin: e.target.value })
                }
                placeholder="Vehicle Identification Number"
              />
            </div>

            <div>
              <Label htmlFor="color">Color (Optional)</Label>
              <Input
                id="color"
                value={formData.color}
                onChange={(e) =>
                  setFormData({ ...formData, color: e.target.value })
                }
                placeholder="e.g., White"
              />
            </div>

            <div>
              <Label htmlFor="status">Status *</Label>
              <Select
                value={formData.status}
                onValueChange={(value) =>
                  setFormData({ ...formData, status: value })
                }
              >
                <SelectTrigger id="status">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="AVAILABLE">Available</SelectItem>
                  <SelectItem value="IN_USE">In Use</SelectItem>
                  <SelectItem value="MAINTENANCE">Maintenance</SelectItem>
                  <SelectItem value="INACTIVE">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              placeholder="Additional notes about the vehicle"
              rows={3}
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              disabled={isSubmitting}
              className="w-full sm:w-auto order-2 sm:order-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full sm:w-auto order-1 sm:order-2"
            >
              {isSubmitting
                ? "Saving..."
                : mode === "create"
                  ? "Create Vehicle"
                  : "Update Vehicle"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
