"use client";

import { Building2, Edit, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";
import { BackButton } from "@/components/common/back-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/hooks/use-toast";
import { deleteState, getStateById } from "@/lib/actions/lookups";
import { isFailure } from "@/lib/actions/result";

interface ClienteCenter {
  id: string;
  name: string;
  code: string;
  address?: string | null;
  phone?: string | null;
  lines?: number | null;
  equipments?: number | null;
}

interface State {
  id: number;
  name: string;
  code: string;
  active: boolean;
  clientes: ClienteCenter[];
}

export default function StateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [state, setState] = useState<State | null>(null);

  useEffect(() => {
    const fetchState = async () => {
      try {
        const data = await getStateById(Number(id));
        setState(data);
      } catch (error) {
        console.error("Error fetching state:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchState();
  }, [id]);

  const handleDelete = async () => {
    if (
      !confirm(
        "¿Estás seguro de que deseas eliminar este estado? Esta acción no se puede deshacer.",
      )
    ) {
      return;
    }

    setIsDeleting(true);
    try {
      const result = await deleteState(Number(id));

      if (isFailure(result)) {
        toast.error(result.error);
        setIsDeleting(false);
        return;
      }
      router.push("/admin/states");
    } catch (error) {
      console.error("Error deleting state:", error);
      toast.error("Error al eliminar el estado");
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" text="Cargando estado..." />
      </div>
    );
  }

  if (!state) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <BackButton fallback="/admin/states" />
          <div>
            <h1 className="text-3xl font-bold">Estado No Encontrado</h1>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <BackButton fallback="/admin/states" />
          <div>
            <h1 className="text-3xl font-bold">{state.name}</h1>
            <p className="text-muted-foreground">
              Detalles del estado y centros Cliente
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => router.push(`/admin/states/${id}/edit`)}
          >
            <Edit className="mr-2 h-4 w-4" />
            Editar
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {isDeleting ? "Eliminando..." : "Eliminar"}
          </Button>
        </div>
      </div>

      <div className="grid gap-6">
        {/* State Information */}
        <Card>
          <CardHeader>
            <CardTitle>Información del Estado</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  ID del Estado
                </p>
                <p className="text-sm">{state.id}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Código del Estado
                </p>
                <p className="text-sm font-mono">{state.code}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Nombre del Estado
                </p>
                <p className="text-sm font-medium">{state.name}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Estado
                </p>
                <p className="text-sm">
                  {state.active ? (
                    <span className="text-green-600">Activo</span>
                  ) : (
                    <span className="text-red-600">Inactivo</span>
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Clientes in this State */}
        {state.clientes && state.clientes.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Centros de Inspección Vehicular ({state.clientes.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {state.clientes.map((cliente: ClienteCenter) => (
                  <button
                    type="button"
                    key={cliente.id}
                    className="flex justify-between items-center w-full text-left p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => router.push(`/admin/clientes/${cliente.id}`)}
                  >
                    <div>
                      <p className="font-medium">{cliente.name}</p>
                      <p className="text-sm text-muted-foreground">
                        Código: {cliente.code}
                      </p>
                      {cliente.address && (
                        <p className="text-sm text-muted-foreground">
                          {cliente.address}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      {cliente.phone && (
                        <p className="text-sm text-muted-foreground">
                          {cliente.phone}
                        </p>
                      )}
                      {cliente.lines && (
                        <p className="text-sm font-medium">
                          {cliente.lines} líneas
                        </p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* No Clientes */}
        {(!state.clientes || state.clientes.length === 0) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Centros de Inspección Vehicular
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                No hay centros Cliente registrados en este estado.
              </p>
              <Button
                variant="link"
                className="mt-2 p-0 h-auto"
                onClick={() => router.push("/admin/clientes/new")}
              >
                Crear un nuevo centro Cliente
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
