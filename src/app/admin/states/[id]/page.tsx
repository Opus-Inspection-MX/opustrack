"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Edit, Trash2, Building2 } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { getStateById, deleteState } from "@/lib/actions/lookups";

export default function StateDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [state, setState] = useState<any>(null);

  useEffect(() => {
    const fetchState = async () => {
      try {
        const data = await getStateById(Number(params.id));
        setState(data);
      } catch (error) {
        console.error("Error fetching state:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchState();
  }, [params.id]);

  const handleDelete = async () => {
    if (
      !confirm(
        "Are you sure you want to delete this state? This action cannot be undone."
      )
    ) {
      return;
    }

    setIsDeleting(true);
    try {
      await deleteState(Number(params.id));
      router.push("/admin/states");
    } catch (error) {
      console.error("Error deleting state:", error);
      alert(error instanceof Error ? error.message : "Failed to delete state");
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" text="Loading state..." />
      </div>
    );
  }

  if (!state) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">State Not Found</h1>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{state.name}</h1>
            <p className="text-muted-foreground">State details and VICs</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => router.push(`/admin/states/${params.id}/edit`)}
          >
            <Edit className="mr-2 h-4 w-4" />
            Edit
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {isDeleting ? "Deleting..." : "Delete"}
          </Button>
        </div>
      </div>

      <div className="grid gap-6">
        {/* State Information */}
        <Card>
          <CardHeader>
            <CardTitle>State Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  State ID
                </p>
                <p className="text-sm">{state.id}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  State Code
                </p>
                <p className="text-sm font-mono">{state.code}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  State Name
                </p>
                <p className="text-sm font-medium">{state.name}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Status
                </p>
                <p className="text-sm">
                  {state.active ? (
                    <span className="text-green-600">Active</span>
                  ) : (
                    <span className="text-red-600">Inactive</span>
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* VICs in this State */}
        {state.vehicleInspectionCenters &&
          state.vehicleInspectionCenters.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Vehicle Inspection Centers (
                  {state.vehicleInspectionCenters.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {state.vehicleInspectionCenters.map((vic: any) => (
                    <div
                      key={vic.id}
                      className="flex justify-between items-center p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => router.push(`/admin/vic-centers/${vic.id}`)}
                    >
                      <div>
                        <p className="font-medium">{vic.name}</p>
                        <p className="text-sm text-muted-foreground">
                          Code: {vic.code}
                        </p>
                        {vic.address && (
                          <p className="text-sm text-muted-foreground">
                            {vic.address}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        {vic.phone && (
                          <p className="text-sm text-muted-foreground">
                            {vic.phone}
                          </p>
                        )}
                        {vic.lines && (
                          <p className="text-sm font-medium">
                            {vic.lines} lines
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

        {/* No VICs */}
        {(!state.vehicleInspectionCenters ||
          state.vehicleInspectionCenters.length === 0) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Vehicle Inspection Centers
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                No VICs are currently registered in this state.
              </p>
              <Button
                variant="link"
                className="mt-2 p-0 h-auto"
                onClick={() => router.push("/admin/vic-centers/new")}
              >
                Create a new VIC
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
