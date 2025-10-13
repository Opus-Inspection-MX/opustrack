// Example: Protected Page with Route Access Control
// Location: src/app/example/page.tsx

import { requireRouteAccess, getMyAccessibleRoutes, canPerform } from "@/lib/auth/auth";
import { redirect } from "next/navigation";

export default async function ExamplePage() {
  // Method 1: Require route access (redirects if unauthorized)
  const user = await requireRouteAccess("/example");

  // Method 2: Get all accessible routes for navigation
  const accessibleRoutes = await getMyAccessibleRoutes();

  // Method 3: Check specific permissions
  const canCreateIncidents = await canPerform("incidents:create");
  const canManageUsers = await canPerform("users:create");

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Welcome, {user.name}</h1>
      <p className="mb-4">Email: {user.email}</p>
      <p className="mb-4">Role: {user.role.name}</p>

      {/* Conditional rendering based on permissions */}
      <div className="space-y-4">
        {canCreateIncidents && (
          <button className="px-4 py-2 bg-blue-500 text-white rounded">
            Create Incident
          </button>
        )}

        {canManageUsers && (
          <button className="px-4 py-2 bg-green-500 text-white rounded">
            Manage Users
          </button>
        )}
      </div>

      {/* Dynamic navigation menu */}
      <nav className="mt-8">
        <h2 className="text-xl font-semibold mb-2">Your Accessible Routes:</h2>
        <ul className="space-y-2">
          {accessibleRoutes.map((route) => (
            <li key={route}>
              <a href={route} className="text-blue-600 hover:underline">
                {route}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {/* Display user's permissions */}
      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-2">Your Permissions:</h2>
        <ul className="grid grid-cols-2 gap-2">
          {user.role.permissions.map((perm) => (
            <li key={perm.id} className="text-sm bg-gray-100 p-2 rounded">
              <span className="font-medium">{perm.name}</span>
              {perm.description && (
                <span className="text-gray-600 ml-2">- {perm.description}</span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
