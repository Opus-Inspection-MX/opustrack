"use client";

import {
  Building,
  Edit2,
  Lock,
  Mail,
  Phone,
  Save,
  Shield,
  User,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { EmptyState } from "@/components/common/empty-state";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { SectionCard } from "@/components/common/section-card";
import { StatusBadge } from "@/components/common/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { isFailure } from "@/lib/actions/result";
import { isUserActive } from "@/lib/constants/status-codes";
import {
  getMyProfile,
  updateMyPassword,
  updateMyProfile,
} from "@/lib/actions/users";
import { logger } from "@/lib/observability/logger";
import { formatMX } from "@/lib/utils/datetime";

interface UserStatus {
  id: number;
  name: string;
}

interface Role {
  id: number;
  name: string;
}

interface Client {
  id: string;
  name: string;
  code: string;
}

interface UserProfileDetails {
  telephone?: string | null;
  secondaryTelephone?: string | null;
  emergencyContact?: string | null;
  jobPosition?: string | null;
}

interface UserProfile {
  id: string;
  name: string;
  email: string;
  telephone?: string | null;
  secondaryTelephone?: string | null;
  userStatus?: UserStatus | null;
  role?: Role | null;
  clients?: Client[];
  client?: Client | null;
  userProfile?: UserProfileDetails | null;
  createdAt?: Date | string;
}

export default function FSRProfilePage() {
  const [user, setUser] = useState<UserProfile | null>(null);
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

  const fetchProfile = useCallback(async () => {
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
      logger.error("Error fetching profile:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

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
      logger.error("Error updating profile:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Error al actualizar el perfil",
      );
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
        newErrors.newPassword =
          "La contraseña debe tener al menos 8 caracteres";
      }

      if (passwordData.newPassword !== passwordData.confirmPassword) {
        newErrors.confirmPassword = "Las contraseñas no coinciden";
      }

      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        setIsSaving(false);
        return;
      }

      const result = await updateMyPassword(
        passwordData.currentPassword,
        passwordData.newPassword,
      );

      if (isFailure(result)) {
        toast.error(result.error);
        return;
      }
      setIsChangingPassword(false);
      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      setSuccessMessage("¡Contraseña cambiada exitosamente!");
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (error) {
      logger.error("Error changing password:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Error al cambiar la contraseña",
      );
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <PageContainer>
        <div className="flex h-64 items-center justify-center">
          <Spinner size="lg" text="Cargando perfil..." />
        </div>
      </PageContainer>
    );
  }

  if (!user) {
    return (
      <PageContainer>
        <PageHeader title="Mi Perfil" />
        <EmptyState title="Sin perfil" description="Perfil no encontrado" />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Mi Perfil"
        description="Administra tu información personal"
        actions={
          !isEditing && !isChangingPassword ? (
            <>
              <Button
                variant="outline"
                onClick={() => setIsChangingPassword(true)}
                className="w-full sm:w-auto"
              >
                <Lock className="mr-2 h-4 w-4" aria-hidden />
                Cambiar Contraseña
              </Button>
              <Button
                onClick={() => setIsEditing(true)}
                className="w-full sm:w-auto"
              >
                <Edit2 className="mr-2 h-4 w-4" aria-hidden />
                Editar Perfil
              </Button>
            </>
          ) : undefined
        }
      />

      {successMessage && (
        <div className="rounded-lg border border-success/40 bg-success-muted p-4 text-success-muted-foreground">
          {successMessage}
        </div>
      )}

      <Tabs defaultValue="info" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="info">Información</TabsTrigger>
          <TabsTrigger value="seguridad">Seguridad</TabsTrigger>
        </TabsList>
        <TabsContent value="info" className="space-y-6 pt-4">
          <div className="grid gap-6">
            {/* Personal Information Card */}
            <SectionCard title="Información Personal">
              <div className="space-y-4">
                {isEditing ? (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="name">
                        Nombre <span className="text-destructive">*</span>
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
                        <p className="text-sm text-muted-foreground mb-2">
                          Correo Electrónico
                        </p>
                        <p className="font-medium">{user.email}</p>
                        <p className="text-xs text-muted-foreground">
                          El correo no puede ser cambiado
                        </p>
                      </div>

                      <div>
                        <p className="text-sm text-muted-foreground mb-2">
                          Rol
                        </p>
                        <Badge variant="outline">
                          {user.role?.name || "N/A"}
                        </Badge>
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
                        <p className="text-sm text-muted-foreground">
                          Correo Electrónico
                        </p>
                        <p className="font-medium">{user.email}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <Shield className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Rol</p>
                        <Badge variant="outline">
                          {user.role?.name || "N/A"}
                        </Badge>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <Building
                        className="h-5 w-5 text-muted-foreground"
                        aria-hidden
                      />
                      <div>
                        <p className="text-sm text-muted-foreground">Cliente</p>
                        <p className="font-medium">
                          {user.client
                            ? `${user.client.name} (${user.client.code})`
                            : "No asignado"}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </SectionCard>

            {/* Contact Information Card */}
            <SectionCard title="Información de Contacto">
              <div className="space-y-4">
                {isEditing ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="telephone">Teléfono</Label>
                      <Input
                        id="telephone"
                        value={formData.telephone}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            telephone: e.target.value,
                          })
                        }
                        placeholder="+52-555-0123"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="secondaryTelephone">
                        Teléfono Secundario
                      </Label>
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
                          setFormData({
                            ...formData,
                            jobPosition: e.target.value,
                          })
                        }
                        placeholder="ej., Técnico Senior"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="emergencyContact">
                        Contacto de Emergencia
                      </Label>
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
                          <p className="text-sm text-muted-foreground">
                            Teléfono
                          </p>
                          <p className="font-medium">
                            {user.userProfile.telephone}
                          </p>
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
                          <p className="text-sm text-muted-foreground">
                            Puesto de Trabajo
                          </p>
                          <p className="font-medium">
                            {user.userProfile.jobPosition}
                          </p>
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
              </div>
            </SectionCard>

            {/* Edit Profile Actions */}
            {isEditing && (
              <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-20 flex flex-col gap-2 rounded-xl border bg-background/95 p-3 shadow-lg backdrop-blur sm:static sm:flex-row sm:justify-end md:bottom-0">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsEditing(false);
                    setErrors({});
                    setFormData({
                      name: user.name || "",
                      telephone: user.userProfile?.telephone || "",
                      secondaryTelephone:
                        user.userProfile?.secondaryTelephone || "",
                      emergencyContact:
                        user.userProfile?.emergencyContact || "",
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
                      <Save className="mr-2 h-4 w-4" aria-hidden />
                      Guardar Cambios
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </TabsContent>
        <TabsContent value="seguridad" className="space-y-6 pt-4">
          <div className="grid gap-6">
            {/* Change Password Card */}
            {isChangingPassword && (
              <SectionCard title="Cambiar Contraseña">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="currentPassword">
                      Contraseña Actual{" "}
                      <span className="text-destructive">*</span>
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
                      Nueva Contraseña{" "}
                      <span className="text-destructive">*</span>
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
                    {errors.newPassword && (
                      <FormError message={errors.newPassword} />
                    )}
                    <p className="text-xs text-muted-foreground">
                      Debe tener al menos 8 caracteres
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">
                      Confirmar Nueva Contraseña{" "}
                      <span className="text-destructive">*</span>
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
                          <Lock className="mr-2 h-4 w-4" aria-hidden />
                          Cambiar Contraseña
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </SectionCard>
            )}

            {/* Account Status Card */}
            <SectionCard title="Estado de la Cuenta">
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <StatusBadge
                      tone={
                        isUserActive(user.userStatus) ? "success" : "neutral"
                      }
                    >
                      {user.userStatus?.name || "N/A"}
                    </StatusBadge>
                  </div>

                  {user.createdAt && (
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Miembro desde
                      </p>
                      <p className="font-medium">
                        {formatMX(user.createdAt, {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </SectionCard>
          </div>
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}
