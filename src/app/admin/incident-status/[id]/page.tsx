"use client";

import { ArrowLeft, Calendar, CheckCircle, Edit, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

interface IncidentStatus {
  id: number;
  name: string;
  color: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function ViewIncidentStatusPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [incidentStatus, setIncidentStatus] = useState<IncidentStatus | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Mock data fetch
    const fetchIncidentStatus = async () => {
      setIsLoading(true);
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Mock data
      setIncidentStatus({
        id: Number.parseInt(id, 10),
        name: "In Progress",
        color: "#3B82F6",
        active: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      setIsLoading(false);
    };

    fetchIncidentStatus();
  }, [id]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Spinner size="lg" text="Loading incident status..." />
      </div>
    );
  }

  if (!incidentStatus) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/admin/incident-status")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-3xl font-bold">Incident Status Not Found</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/admin/incident-status")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{incidentStatus.name}</h1>
            <p className="text-muted-foreground">Incident Status Details</p>
          </div>
        </div>
        <Button
          onClick={() => router.push(`/admin/incident-status/${id}/edit`)}
        >
          <Edit className="h-4 w-4 mr-2" />
          Edit
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-2">Status Name</p>
              <Badge
                style={{
                  backgroundColor: incidentStatus.color,
                  color: "#FFFFFF",
                  borderColor: incidentStatus.color,
                }}
              >
                {incidentStatus.name}
              </Badge>
            </div>

            <div>
              <p className="text-sm text-muted-foreground mb-2">Color</p>
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-lg border-2 border-gray-300 shadow-sm"
                  style={{ backgroundColor: incidentStatus.color }}
                  title={incidentStatus.color}
                />
                <div>
                  <p className="font-mono font-medium text-lg">
                    {incidentStatus.color}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Hex Color Code
                  </p>
                </div>
              </div>
            </div>

            <div>
              <p className="text-sm text-muted-foreground mb-2">Status</p>
              <Badge variant={incidentStatus.active ? "default" : "secondary"}>
                {incidentStatus.active ? (
                  <>
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Active
                  </>
                ) : (
                  <>
                    <XCircle className="h-3 w-3 mr-1" />
                    Inactive
                  </>
                )}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>System Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Created At
              </p>
              <p className="font-medium">
                {new Date(incidentStatus.createdAt).toLocaleString()}
              </p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Last Updated
              </p>
              <p className="font-medium">
                {new Date(incidentStatus.updatedAt).toLocaleString()}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
