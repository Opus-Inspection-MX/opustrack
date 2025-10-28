"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User, Mail, Building, Phone, Shield, Edit2, Save, X, Lock } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { FormError } from "@/components/ui/form-error";
import { getMyProfile, updateMyProfile, updateMyPassword } from "@/lib/actions/users";

export default function ClientProfilePage() {
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [successMessage, setSuccessMessage] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    telephone: "",
    secondaryTelephone: "",
    emergencyContact: "",
    jobPosition: "",
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const data = await getMyProfile();
      setUser(data);
      if (data) {
        setFormData({
          name: data.name || "",
          telephone: data.userProfile?.telephone || "",
          secondaryTelephone: data.userProfile?.secondaryTelephone || "",
          emergencyContact: data.userProfile?.emergencyContact || "",
          jobPosition: data.userProfile?.jobPosition || "",
        });
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    setErrors({});
    setSuccessMessage("");
    setIsSaving(true);

    try {
      const newErrors: Record<string, string> = {};

      if (!formData.name.trim()) {
        newErrors.name = "El nombre es requerido";
      }

      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        setIsSaving(false);
        return;
      }

      await updateMyProfile(formData);
      await fetchProfile();
      setIsEditing(false);
      setSuccessMessage("¡Perfil actualizado exitosamente!");
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (error) {
      console.error("Error updating profile:", error);
      setErrors({
        submit: error instanceof Error ? error.message : "Error al actualizar el perfil",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async () => {
    setErrors({});
    setSuccessMessage("");
    setIsSaving(true);

    try {
      const newErrors: Record<string, string> = {};

      if (!passwordData.currentPassword) {
        newErrors.currentPassword = "La contraseña actual es requerida";
      }

      if (!passwordData.newPassword) {
        newErrors.newPassword = "La nueva contraseña es requerida";
      } else if (passwordData.newPassword.length < 8) {
        newErrors.newPassword = "La contraseña debe tener al menos 8 caracteres";
      }

      if (passwordData.newPassword !== passwordData.confirmPassword) {
        newErrors.confirmPassword = "Las contraseñas no coinciden";
      }

      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        setIsSaving(false);
        return;
      }

      await updateMyPassword(passwordData.currentPassword, passwordData.newPassword);
      setIsChangingPassword(false);
      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      setSuccessMessage("¡Contraseña cambiada exitosamente!");
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (error) {
      console.error("Error changing password:", error);
      setErrors({
        submit: error instanceof Error ? error.message : "Error al cambiar la contraseña",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" text="Cargando perfil..." />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="space-y-6">
        <p>Perfil no encontrado</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Mi Perfil</h1>
          <p className="text-muted-foreground">Administra tu información personal</p>
        </div>
        {!isEditing && !isChangingPassword && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setIsChangingPassword(true)}>
              <Lock className="mr-2 h-4 w-4" />
              Cambiar Contraseña
            </Button>
            <Button onClick={() => setIsEditing(true)}>
              <Edit2 className="mr-2 h-4 w-4" />
              Editar Perfil
            </Button>
          </div>
        )}
      </div>

      {successMessage && (
        <div className="p-4 bg-green-50 text-green-800 border border-green-200 rounded-lg dark:bg-green-950 dark:text-green-200 dark:border-green-800">
          {successMessage}
        </div>
      )}

      {errors.submit && <FormError message={errors.submit} />}

      <div className="grid gap-6">
        {/* Personal Information Card */}
        <Card>
          <CardHeader>
            <CardTitle>Información Personal</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isEditing ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="name">
                    Nombre <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                  />
                  {errors.name && <FormError message={errors.name} />}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Correo Electrónico</p>
                    <p className="font-medium">{user.email}</p>
                    <p className="text-xs text-muted-foreground">
                      El correo no puede ser cambiado
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Rol</p>
                    <Badge variant="outline">{user.role.name}</Badge>
                  </div>
                </div>
              </>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-3">
                  <User className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Nombre</p>
                    <p className="font-medium">{user.name}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Mail className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Correo Electrónico</p>
                    <p className="font-medium">{user.email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Shield className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Rol</p>
                    <Badge variant="outline">{user.role.name}</Badge>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Building className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">CVV</p>
                    <p className="font-medium">
                      {user.vic ? `${user.vic.name} (${user.vic.code})` : "No asignado"}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Contact Information Card */}
        <Card>
          <CardHeader>
            <CardTitle>Información de Contacto</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isEditing ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="telephone">Teléfono</Label>
                  <Input
                    id="telephone"
                    value={formData.telephone}
                    onChange={(e) =>
                      setFormData({ ...formData, telephone: e.target.value })
                    }
                    placeholder="+52-555-0123"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="secondaryTelephone">Teléfono Secundario</Label>
                  <Input
                    id="secondaryTelephone"
                    value={formData.secondaryTelephone}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        secondaryTelephone: e.target.value,
                      })
                    }
                    placeholder="+52-555-0124"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="jobPosition">Puesto de Trabajo</Label>
                  <Input
                    id="jobPosition"
                    value={formData.jobPosition}
                    onChange={(e) =>
                      setFormData({ ...formData, jobPosition: e.target.value })
                    }
                    placeholder="ej., Técnico Senior"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="emergencyContact">Contacto de Emergencia</Label>
                  <Input
                    id="emergencyContact"
                    value={formData.emergencyContact}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        emergencyContact: e.target.value,
                      })
                    }
                    placeholder="Nombre - Teléfono"
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {user.userProfile?.telephone && (
                  <div className="flex items-center gap-3">
                    <Phone className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Teléfono</p>
                      <p className="font-medium">{user.userProfile.telephone}</p>
                    </div>
                  </div>
                )}

                {user.userProfile?.secondaryTelephone && (
                  <div className="flex items-center gap-3">
                    <Phone className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Teléfono Secundario
                      </p>
                      <p className="font-medium">
                        {user.userProfile.secondaryTelephone}
                      </p>
                    </div>
                  </div>
                )}

                {user.userProfile?.jobPosition && (
                  <div className="flex items-center gap-3">
                    <Building className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Puesto de Trabajo</p>
                      <p className="font-medium">{user.userProfile.jobPosition}</p>
                    </div>
                  </div>
                )}

                {user.userProfile?.emergencyContact && (
                  <div className="flex items-center gap-3">
                    <Phone className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Contacto de Emergencia
                      </p>
                      <p className="font-medium">
                        {user.userProfile.emergencyContact}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Edit Profile Actions */}
        {isEditing && (
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setIsEditing(false);
                setErrors({});
                setFormData({
                  name: user.name || "",
                  telephone: user.userProfile?.telephone || "",
                  secondaryTelephone: user.userProfile?.secondaryTelephone || "",
                  emergencyContact: user.userProfile?.emergencyContact || "",
                  jobPosition: user.userProfile?.jobPosition || "",
                });
              }}
              disabled={isSaving}
            >
              <X className="mr-2 h-4 w-4" />
              Cancelar
            </Button>
            <Button onClick={handleSaveProfile} disabled={isSaving}>
              {isSaving ? (
                "Guardando..."
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Guardar Cambios
                </>
              )}
            </Button>
          </div>
        )}

        {/* Change Password Card */}
        {isChangingPassword && (
          <Card>
            <CardHeader>
              <CardTitle>Cambiar Contraseña</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">
                  Contraseña Actual <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="currentPassword"
                  type="password"
                  value={passwordData.currentPassword}
                  onChange={(e) =>
                    setPasswordData({
                      ...passwordData,
                      currentPassword: e.target.value,
                    })
                  }
                />
                {errors.currentPassword && (
                  <FormError message={errors.currentPassword} />
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="newPassword">
                  Nueva Contraseña <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={passwordData.newPassword}
                  onChange={(e) =>
                    setPasswordData({
                      ...passwordData,
                      newPassword: e.target.value,
                    })
                  }
                />
                {errors.newPassword && <FormError message={errors.newPassword} />}
                <p className="text-xs text-muted-foreground">
                  Debe tener al menos 8 caracteres
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">
                  Confirmar Nueva Contraseña <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={(e) =>
                    setPasswordData({
                      ...passwordData,
                      confirmPassword: e.target.value,
                    })
                  }
                />
                {errors.confirmPassword && (
                  <FormError message={errors.confirmPassword} />
                )}
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsChangingPassword(false);
                    setErrors({});
                    setPasswordData({
                      currentPassword: "",
                      newPassword: "",
                      confirmPassword: "",
                    });
                  }}
                  disabled={isSaving}
                >
                  <X className="mr-2 h-4 w-4" />
                  Cancelar
                </Button>
                <Button onClick={handleChangePassword} disabled={isSaving}>
                  {isSaving ? (
                    "Cambiando..."
                  ) : (
                    <>
                      <Lock className="mr-2 h-4 w-4" />
                      Cambiar Contraseña
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Account Status Card */}
        <Card>
          <CardHeader>
            <CardTitle>Estado de la Cuenta</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Estado</p>
                <Badge
                  variant={
                    user.userStatus.name === "ACTIVO" ? "default" : "secondary"
                  }
                >
                  {user.userStatus.name}
                </Badge>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">Miembro desde</p>
                <p className="font-medium">
                  {new Date(user.createdAt).toLocaleDateString("es-MX", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
