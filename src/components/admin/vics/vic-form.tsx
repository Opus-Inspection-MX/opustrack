"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createVIC, updateVIC, type VICFormData } from "@/lib/actions/vics";

type VICFormProps = {
  vic?: {
    id: string;
    code: string;
    name: string;
    address: string | null;
    rfc: string | null;
    companyName: string | null;
    phone: string | null;
    contact: string | null;
    email: string | null;
    lines: number;
    stateId: number;
  };
  states: Array<{ id: number; name: string }>;
};

export function VICForm({ vic, states }: VICFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<VICFormData>({
    code: vic?.code || "",
    name: vic?.name || "",
    address: vic?.address || "",
    rfc: vic?.rfc || "",
    companyName: vic?.companyName || "",
    phone: vic?.phone || "",
    contact: vic?.contact || "",
    email: vic?.email || "",
    lines: vic?.lines || 1,
    stateId: vic?.stateId || states[0]?.id || 0,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (vic) {
        await updateVIC(vic.id, formData);
      } else {
        await createVIC(formData);
      }
      router.push("/admin/vic-centers");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-destructive/15 text-destructive px-4 py-3 rounded-md">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Información Básica</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="code">Código *</Label>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) =>
                  setFormData({ ...formData, code: e.target.value })
                }
                placeholder="Ej: VIC001"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Nombre *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="Nombre del centro"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="companyName">Razón Social</Label>
              <Input
                id="companyName"
                value={formData.companyName}
                onChange={(e) =>
                  setFormData({ ...formData, companyName: e.target.value })
                }
                placeholder="Nombre de la empresa"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="rfc">RFC</Label>
              <Input
                id="rfc"
                value={formData.rfc}
                onChange={(e) =>
                  setFormData({ ...formData, rfc: e.target.value.toUpperCase() })
                }
                placeholder="RFC de la empresa"
                maxLength={13}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="stateId">Estado *</Label>
              <Select
                value={formData.stateId.toString()}
                onValueChange={(value) =>
                  setFormData({ ...formData, stateId: parseInt(value) })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar estado" />
                </SelectTrigger>
                <SelectContent>
                  {states.map((state) => (
                    <SelectItem key={state.id} value={state.id.toString()}>
                      {state.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="lines">Líneas de Verificación *</Label>
              <Input
                id="lines"
                type="number"
                min={1}
                max={10}
                value={formData.lines}
                onChange={(e) =>
                  setFormData({ ...formData, lines: parseInt(e.target.value) || 1 })
                }
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Dirección</Label>
            <Textarea
              id="address"
              value={formData.address}
              onChange={(e) =>
                setFormData({ ...formData, address: e.target.value })
              }
              placeholder="Dirección completa del centro"
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Información de Contacto</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="contact">Nombre de Contacto</Label>
              <Input
                id="contact"
                value={formData.contact}
                onChange={(e) =>
                  setFormData({ ...formData, contact: e.target.value })
                }
                placeholder="Nombre del responsable"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Teléfono</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
                placeholder="Teléfono de contacto"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="email">Correo Electrónico</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                placeholder="correo@ejemplo.com"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={loading}
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? "Guardando..." : vic ? "Actualizar VIC" : "Crear VIC"}
        </Button>
      </div>
    </form>
  );
}
