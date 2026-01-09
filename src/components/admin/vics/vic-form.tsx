"use client";

import { Check, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
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
    stateId: number;
    users?: Array<{
      id: string;
      name: string;
      email: string;
    }>;
  };
  states: Array<{ id: number; name: string }>;
  fsrUsers: Array<{
    id: string;
    name: string;
    email: string;
    vicIds: string[];
  }>;
  clientUsers: Array<{
    id: string;
    name: string;
    email: string;
    vicId: string | null;
  }>;
};

export function VICForm({ vic, states, fsrUsers, clientUsers }: VICFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get currently assigned FSR IDs (FSRs that have this VIC in their vicIds array)
  const assignedFSRIds = vic
    ? fsrUsers.filter((fsr) => fsr.vicIds.includes(vic.id)).map((fsr) => fsr.id)
    : [];

  // Get currently assigned CLIENT user IDs
  const assignedClientIds = vic
    ? clientUsers
        .filter((client) => client.vicId === vic.id)
        .map((client) => client.id)
    : [];

  const [selectedFSRs, setSelectedFSRs] = useState<string[]>(assignedFSRIds);
  const [selectedClients, setSelectedClients] =
    useState<string[]>(assignedClientIds);
  const [fsrSearchQuery, setFsrSearchQuery] = useState("");
  const [clientSearchQuery, setClientSearchQuery] = useState("");

  const [formData, setFormData] = useState<VICFormData>({
    code: vic?.code || "",
    name: vic?.name || "",
    address: vic?.address || "",
    rfc: vic?.rfc || "",
    companyName: vic?.companyName || "",
    phone: vic?.phone || "",
    contact: vic?.contact || "",
    email: vic?.email || "",
    stateId: vic?.stateId || states[0]?.id || 0,
  });

  // Filter FSRs based on search query
  const filteredFSRs = fsrUsers.filter(
    (fsr) =>
      fsr.name.toLowerCase().includes(fsrSearchQuery.toLowerCase()) ||
      fsr.email.toLowerCase().includes(fsrSearchQuery.toLowerCase()),
  );

  // Filter CLIENTs based on search query
  const filteredClients = clientUsers.filter(
    (client) =>
      client.name.toLowerCase().includes(clientSearchQuery.toLowerCase()) ||
      client.email.toLowerCase().includes(clientSearchQuery.toLowerCase()),
  );

  const toggleFSR = (fsrId: string) => {
    setSelectedFSRs((prev) =>
      prev.includes(fsrId)
        ? prev.filter((id) => id !== fsrId)
        : [...prev, fsrId],
    );
  };

  const removeFSR = (fsrId: string) => {
    setSelectedFSRs((prev) => prev.filter((id) => id !== fsrId));
  };

  const toggleClient = (clientId: string) => {
    setSelectedClients((prev) =>
      prev.includes(clientId)
        ? prev.filter((id) => id !== clientId)
        : [...prev, clientId],
    );
  };

  const removeClient = (clientId: string) => {
    setSelectedClients((prev) => prev.filter((id) => id !== clientId));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const dataWithUsers = {
        ...formData,
        fsrIds: selectedFSRs,
        clientIds: selectedClients,
      };

      if (vic) {
        await updateVIC(vic.id, dataWithUsers);
      } else {
        await createVIC(dataWithUsers);
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
                  setFormData({
                    ...formData,
                    rfc: e.target.value.toUpperCase(),
                  })
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
                  setFormData({ ...formData, stateId: parseInt(value, 10) })
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

      <Card>
        <CardHeader>
          <CardTitle>Asignación de FSRs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Selected FSRs */}
          {selectedFSRs.length > 0 && (
            <div className="space-y-2">
              <Label>FSRs Asignados ({selectedFSRs.length})</Label>
              <div className="flex flex-wrap gap-2">
                {selectedFSRs.map((fsrId) => {
                  const fsr = fsrUsers.find((f) => f.id === fsrId);
                  if (!fsr) return null;
                  return (
                    <Badge
                      key={fsrId}
                      variant="secondary"
                      className="px-3 py-1 flex items-center gap-2"
                    >
                      <span>{fsr.name}</span>
                      <button
                        type="button"
                        onClick={() => removeFSR(fsrId)}
                        className="hover:bg-destructive/20 rounded-full p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  );
                })}
              </div>
            </div>
          )}

          {/* Search input */}
          <div className="space-y-2">
            <Label htmlFor="fsrSearch">Buscar FSRs</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="fsrSearch"
                type="text"
                value={fsrSearchQuery}
                onChange={(e) => setFsrSearchQuery(e.target.value)}
                placeholder="Buscar por nombre o correo..."
                className="pl-10"
              />
            </div>
          </div>

          {/* FSR List */}
          <div className="space-y-2">
            <Label>FSRs Disponibles</Label>
            <div className="border rounded-lg max-h-64 overflow-y-auto">
              {filteredFSRs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  {fsrSearchQuery
                    ? "No se encontraron FSRs"
                    : "No hay FSRs disponibles"}
                </p>
              ) : (
                <div className="divide-y">
                  {filteredFSRs.map((fsr) => {
                    const isSelected = selectedFSRs.includes(fsr.id);
                    const otherVicsCount = fsr.vicIds.filter(
                      (vicId) => vicId !== vic?.id,
                    ).length;

                    return (
                      <button
                        key={fsr.id}
                        type="button"
                        onClick={() => toggleFSR(fsr.id)}
                        className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/50 transition-colors cursor-pointer"
                      >
                        <div className="flex-1 text-left">
                          <p className="font-medium text-sm">{fsr.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {fsr.email}
                          </p>
                          {otherVicsCount > 0 && (
                            <p className="text-xs text-blue-600 mt-1">
                              Asignado a {otherVicsCount} otro
                              {otherVicsCount > 1 ? "s" : ""} CVV
                            </p>
                          )}
                        </div>
                        <div
                          className={`flex items-center justify-center w-5 h-5 rounded border-2 ${
                            isSelected
                              ? "bg-primary border-primary"
                              : "border-muted-foreground/30"
                          }`}
                        >
                          {isSelected && (
                            <Check className="h-3 w-3 text-primary-foreground" />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Asignación de Usuarios Clientes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Selected Clients */}
          {selectedClients.length > 0 && (
            <div className="space-y-2">
              <Label>Usuarios Asignados ({selectedClients.length})</Label>
              <div className="flex flex-wrap gap-2">
                {selectedClients.map((clientId) => {
                  const client = clientUsers.find((c) => c.id === clientId);
                  if (!client) return null;
                  return (
                    <Badge
                      key={clientId}
                      variant="secondary"
                      className="px-3 py-1 flex items-center gap-2"
                    >
                      <span>{client.name}</span>
                      <button
                        type="button"
                        onClick={() => removeClient(clientId)}
                        className="hover:bg-destructive/20 rounded-full p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  );
                })}
              </div>
            </div>
          )}

          {/* Search input */}
          <div className="space-y-2">
            <Label htmlFor="clientSearch">Buscar Usuarios</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="clientSearch"
                type="text"
                value={clientSearchQuery}
                onChange={(e) => setClientSearchQuery(e.target.value)}
                placeholder="Buscar por nombre o correo..."
                className="pl-10"
              />
            </div>
          </div>

          {/* CLIENT List */}
          <div className="space-y-2">
            <Label>Usuarios Disponibles</Label>
            <div className="border rounded-lg max-h-64 overflow-y-auto">
              {filteredClients.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  {clientSearchQuery
                    ? "No se encontraron usuarios"
                    : "No hay usuarios disponibles"}
                </p>
              ) : (
                <div className="divide-y">
                  {filteredClients.map((client) => {
                    const isSelected = selectedClients.includes(client.id);
                    const isAssignedToOther =
                      client.vicId && client.vicId !== vic?.id;

                    return (
                      <button
                        key={client.id}
                        type="button"
                        onClick={() => toggleClient(client.id)}
                        className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/50 transition-colors cursor-pointer"
                      >
                        <div className="flex-1 text-left">
                          <p className="font-medium text-sm">{client.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {client.email}
                          </p>
                          {isAssignedToOther && (
                            <p className="text-xs text-blue-600 mt-1">
                              Ya asignado a otro CVV
                            </p>
                          )}
                        </div>
                        <div
                          className={`flex items-center justify-center w-5 h-5 rounded border-2 ${
                            isSelected
                              ? "bg-primary border-primary"
                              : "border-muted-foreground/30"
                          }`}
                        >
                          {isSelected && (
                            <Check className="h-3 w-3 text-primary-foreground" />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
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
