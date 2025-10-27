import { requireRouteAccess } from "@/lib/auth/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Lock, User } from "lucide-react";
import Link from "next/link";

export default async function GuestDashboard() {
  await requireRouteAccess("/guest");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Guest Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Limited access account
        </p>
      </div>

      {/* Access Restriction Notice */}
      <div className="flex items-center justify-center min-h-[calc(100vh-16rem)]">
        <Card className="max-w-2xl w-full border-orange-200 bg-orange-50/30">
          <CardHeader className="text-center pb-4">
            <div className="flex justify-center mb-4">
              <div className="h-16 w-16 rounded-full bg-orange-100 flex items-center justify-center">
                <Lock className="h-8 w-8 text-orange-600" />
              </div>
            </div>
            <CardTitle className="text-2xl">Access Restricted</CardTitle>
            <CardDescription className="text-base">
              Your account has limited permissions
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-white rounded-lg p-4 border">
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <Badge variant="outline" className="bg-yellow-50">GUEST Role</Badge>
              </h3>
              <p className="text-sm text-muted-foreground">
                Guest accounts are currently limited to profile management only.
                If you need additional access to view incidents, work orders, or other resources,
                please contact your system administrator.
              </p>
            </div>

            <div className="border-t pt-4">
              <h4 className="text-sm font-medium mb-3">What you can do:</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-1">✓</span>
                  <span>View and edit your profile information</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-1">✓</span>
                  <span>Change your password</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-1">✓</span>
                  <span>Update contact information</span>
                </li>
              </ul>
            </div>

            <div className="border-t pt-4">
              <h4 className="text-sm font-medium mb-3">Currently unavailable:</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-red-500 mt-1">✗</span>
                  <span>View or create incidents</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 mt-1">✗</span>
                  <span>Access work orders</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 mt-1">✗</span>
                  <span>View parts or schedules</span>
                </li>
              </ul>
            </div>

            <div className="flex justify-center pt-4">
              <Button asChild>
                <Link href="/profile">
                  <User className="h-4 w-4 mr-2" />
                  Go to My Profile
                </Link>
              </Button>
            </div>

            <div className="text-center text-xs text-muted-foreground border-t pt-4">
              To request additional permissions, contact your administrator
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
