// Example: Dynamic Navigation Component
// Location: src/components/layout/dynamic-nav.tsx

import { getMyAccessibleRoutes, getCurrentUserRole } from "@/lib/auth/auth";
import Link from "next/link";

// Define route metadata
const routeMetadata: Record<string, { label: string; icon?: string }> = {
  "/admin": { label: "Admin Dashboard", icon: "🔧" },
  "/fsr": { label: "FSR Dashboard", icon: "📊" },
  "/client": { label: "Client Dashboard", icon: "👤" },
  "/guest": { label: "Guest Dashboard", icon: "👋" },
  "/incidents": { label: "Incidents", icon: "🚨" },
  "/users": { label: "Users", icon: "👥" },
  "/work-orders": { label: "Work Orders", icon: "📋" },
  "/parts": { label: "Parts", icon: "🔩" },
  "/schedules": { label: "Schedules", icon: "📅" },
  "/vics": { label: "VICs", icon: "🏢" },
  "/reports": { label: "Reports", icon: "📈" },
};

export default async function DynamicNav() {
  // Get accessible routes for current user
  const routes = await getMyAccessibleRoutes();
  const role = await getCurrentUserRole();

  return (
    <nav className="bg-white shadow-lg">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between py-4">
          <div className="text-xl font-bold">OpusTrack</div>

          {/* User role badge */}
          <div className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
            {role?.name}
          </div>
        </div>

        {/* Dynamic navigation links */}
        <div className="flex space-x-4 pb-4">
          {routes.map((route) => {
            const metadata = routeMetadata[route] || {
              label: route,
              icon: "📄",
            };

            return (
              <Link
                key={route}
                href={route}
                className="flex items-center space-x-2 px-4 py-2 rounded-lg hover:bg-gray-100 transition"
              >
                <span>{metadata.icon}</span>
                <span>{metadata.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

// Example: Sidebar with permission-based features
export async function DynamicSidebar() {
  const routes = await getMyAccessibleRoutes();

  // Group routes by category
  const dashboards = routes.filter((r) => r.includes("admin") || r.includes("fsr") || r.includes("client") || r.includes("guest"));
  const modules = routes.filter((r) => !dashboards.includes(r));

  return (
    <aside className="w-64 bg-gray-800 text-white h-screen">
      <div className="p-4">
        <h2 className="text-2xl font-bold mb-8">OpusTrack</h2>

        {/* Dashboards section */}
        {dashboards.length > 0 && (
          <div className="mb-6">
            <h3 className="text-xs uppercase text-gray-400 mb-2">Dashboards</h3>
            <ul className="space-y-2">
              {dashboards.map((route) => (
                <li key={route}>
                  <Link
                    href={route}
                    className="block px-3 py-2 rounded hover:bg-gray-700"
                  >
                    {routeMetadata[route]?.label || route}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Modules section */}
        {modules.length > 0 && (
          <div>
            <h3 className="text-xs uppercase text-gray-400 mb-2">Modules</h3>
            <ul className="space-y-2">
              {modules.map((route) => (
                <li key={route}>
                  <Link
                    href={route}
                    className="block px-3 py-2 rounded hover:bg-gray-700"
                  >
                    {routeMetadata[route]?.label || route}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </aside>
  );
}
