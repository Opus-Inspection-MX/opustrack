"use client";

import { ArrowLeft, Calendar, Mail, MapPin, Phone, User } from "lucide-react";
import { useRouter } from "next/navigation";
import type React from "react";
import { use, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FormError } from "@/components/ui/form-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";

// Mock data - replace with actual API call
const mockUserProfile = {
  id: "1",
  name: "John Doe",
  email: "john.doe@example.com",
  phone: "+1 (555) 123-4567",
  address: "123 Main St, City, State 12345",
  bio: "Experienced technician with 5+ years in vehicle inspection systems.",
  role: { name: "Admin" },
  userEstado: { name: "Active" },
  vic: { name: "VIC Centro", code: "VIC001" },
  createdAt: "2024-01-15T10:30:00Z",
  lastLogin: "2024-01-20T14:22:00Z",
};

export default function UserProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const _params = use(params);
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState({
    name: mockUserProfile.name,
    email: mockUserProfile.email,
    phone: mockUserProfile.phone,
    address: mockUserProfile.address,
    bio: mockUserProfile.bio,
  });

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = "Name is required";
    }

    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "Email is invalid";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      console.log("Profile updated:", formData);
      setIsEditing(false);
    } catch (error) {
      console.error("Error updating profile:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "active":
        return "bg-green-100 text-green-800";
      case "inactive":
        return "bg-gray-100 text-gray-800";
      case "suspended":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Regresar
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Perfil de Usuario</h1>
          <p className="text-muted-foreground">
            Ver y gestionar información del perfil de usuario
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Overview */}
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto h-20 w-20 rounded-full bg-muted flex items-center justify-center mb-4">
              <User className="h-10 w-10" />
            </div>
            <CardTitle>{mockUserProfile.name}</CardTitle>
            <CardDescription>{mockUserProfile.email}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Rol:</span>
              <Badge
                variant="outline"
                className="bg-purple-100 text-purple-800"
              >
                {mockUserProfile.role.name}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Estado:</span>
              <Badge
                variant="outline"
                className={getStatusColor(mockUserProfile.userStatus.name)}
              >
                {mockUserProfile.userStatus.name}
              </Badge>
            </div>
            {mockUserProfile.vic && (
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Centro VIC:</span>
                <div className="text-right text-sm">
                  <div className="font-medium">{mockUserProfile.vic.name}</div>
                  <div className="text-muted-foreground">
                    {mockUserProfile.vic.code}
                  </div>
                </div>
              </div>
            )}
            <div className="pt-4 border-t space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                Joined{" "}
                {new Date(mockUserProfile.createdAt).toLocaleDateString()}
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <User className="h-4 w-4" />
                Last login{" "}
                {new Date(mockUserProfile.lastLogin).toLocaleDateString()}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Profile Details */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Información del Perfil</CardTitle>
                <CardDescription>
                  {isEditing
                    ? "Actualizar tu información de perfil"
                    : "Tu información personal"}
                </CardDescription>
              </div>
              {!isEditing && (
                <Button onClick={() => setIsEditing(true)}>
                  Editar Perfil
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {isEditing ? (
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="name">Nombre Completo *</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) =>
                          handleInputChange("name", e.target.value)
                        }
                        placeholder="Ingresa el nombre completo"
                      />
                      {errors.name && <FormError message={errors.name} />}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email">Correo Electrónico *</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) =>
                          handleInputChange("email", e.target.value)
                        }
                        placeholder="Ingresa el correo electrónico"
                      />
                      {errors.email && <FormError message={errors.email} />}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="phone">Número de Teléfono</Label>
                      <Input
                        id="phone"
                        value={formData.phone}
                        onChange={(e) =>
                          handleInputChange("phone", e.target.value)
                        }
                        placeholder="Ingresa el número de teléfono"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="address">Dirección</Label>
                      <Input
                        id="address"
                        value={formData.address}
                        onChange={(e) =>
                          handleInputChange("address", e.target.value)
                        }
                        placeholder="Ingresa la dirección"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="bio">Bio</Label>
                    <Textarea
                      id="bio"
                      value={formData.bio}
                      onChange={(e) => handleInputChange("bio", e.target.value)}
                      placeholder="Cuéntanos sobre ti"
                      rows={4}
                    />
                  </div>

                  <div className="flex justify-end gap-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsEditing(false)}
                    >
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={isLoading}>
                      {isLoading && <Spinner size="sm" className="mr-2" />}
                      Guardar Cambios
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                        <User className="h-4 w-4" />
                        Nombre Completo
                      </div>
                      <p className="text-sm">{mockUserProfile.name}</p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                        <Mail className="h-4 w-4" />
                        Email Dirección
                      </div>
                      <p className="text-sm">{mockUserProfile.email}</p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                        <Phone className="h-4 w-4" />
                        Número de Teléfono
                      </div>
                      <p className="text-sm">{mockUserProfile.phone}</p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                        <MapPin className="h-4 w-4" />
                        Dirección
                      </div>
                      <p className="text-sm">{mockUserProfile.address}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-sm font-medium text-muted-foreground">
                      Bio
                    </div>
                    <p className="text-sm">{mockUserProfile.bio}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
