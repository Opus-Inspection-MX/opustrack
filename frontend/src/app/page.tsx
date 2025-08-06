import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AlertTriangle, FileText, Users, Settings } from "lucide-react";

export default function HomePage() {
  return (
    <div className="container mx-auto p-6">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold">Incident Management System</h1>
          <p className="text-xl text-muted-foreground">
            Comprehensive admin interface for managing incidents and work orders
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-600" />
                Incident Management
              </CardTitle>
              <CardDescription>
                Create, track, and manage incidents with comprehensive filtering
                and search capabilities
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/admin/incidents">
                <Button className="w-full">Manage Incidents</Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-600" />
                Work Order Management
              </CardTitle>
              <CardDescription>
                Track work orders, assign technicians, and monitor progress with
                detailed reporting
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/admin/work-orders">
                <Button className="w-full">Manage Work Orders</Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="text-center">
              <AlertTriangle className="h-8 w-8 mx-auto text-orange-600" />
              <CardTitle className="text-lg">Incident Tracking</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-sm text-muted-foreground">
                Full lifecycle incident management with priority levels, SLA
                tracking, and status updates
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="text-center">
              <Users className="h-8 w-8 mx-auto text-blue-600" />
              <CardTitle className="text-lg">Team Assignment</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-sm text-muted-foreground">
                Assign work orders to technicians, track progress, and manage
                workload distribution
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="text-center">
              <Settings className="h-8 w-8 mx-auto text-green-600" />
              <CardTitle className="text-lg">Advanced Filtering</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-sm text-muted-foreground">
                Powerful search and filtering capabilities with pagination and
                sorting options
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
