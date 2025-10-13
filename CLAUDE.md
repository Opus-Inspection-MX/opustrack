# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

OpusTrack is a professional incident management and work order tracking system for Vehicle Inspection Centers (VICs) in Mexico. Built with Next.js 15, Prisma, NextAuth, and PostgreSQL with a **database-driven role-based access control (RBAC)** system.

## Development Commands

### Running the Application
```bash
npm run dev          # Start development server with Turbopack
npm run build        # Build for production with Turbopack
npm start            # Start production server
```

### Code Quality
```bash
npm run lint         # Check code with Biome
npm run format       # Format code with Biome (writes changes)
```

### Database Operations
```bash
npm run db:migrate   # Run Prisma migrations (also generates client)
npm run db:studio    # Open Prisma Studio (database GUI)
npm run db:reset     # Reset database and re-run migrations
npm run db:seed      # Seed database with initial data
```

**Important**: After schema changes, always run `npm run db:migrate` to create a migration and regenerate the Prisma client.

The seed script (`prisma/seed.ts`) creates:
- 1 VIC (Vehicle Inspection Center) in CDMX
- 1 Part for testing
- 4 roles: ADMINISTRADOR, USUARIO_SISTEMA, USUARIO_PERSONAL, USUARIO_EXTERNO
- 4 test users (one per role) with email pattern: `{role}@opusinspection.com` / password: `password123`
- Comprehensive permission system with route and resource-based permissions

## Architecture

### Database-Driven RBAC System

**Core Principle**: All permissions, roles, and access rules are stored in the database and loaded at runtime. No hardcoded permission checks in code.

#### Permission Model (`prisma/schema.prisma:42-56`)
Permissions have multiple dimensions:
- `name`: Unique identifier (e.g., "incidents:read", "route:admin")
- `resource`: Resource type (e.g., "incidents", "users")
- `action`: Action type (e.g., "read", "create", "update", "delete")
- `routePath`: Route the permission grants access to (e.g., "/admin", "/incidents")

#### Role Model (`prisma/schema.prisma:33-43`)
- Roles have a `defaultPath` where users are redirected after login
- Roles connect to permissions via `RolePermission` junction table
- All role configuration is stored in database

### Authentication Flow

**NextAuth Configuration** (`src/app/api/auth/[...nextauth]/route.ts`)
1. Credentials-based authentication with bcrypt password hashing
2. JWT session strategy with 30-day expiration
3. User status check (must be "ACTIVO")
4. Session includes: `id`, `email`, `name`, `roleId`, `defaultPath`

**Login Flow**:
1. User submits credentials → `/api/auth/callback/credentials`
2. `authorize()` validates credentials and user status
3. JWT token created with user data
4. Middleware intercepts next request
5. Middleware loads user's role and permissions from database
6. User redirected to their `defaultPath` or requested route (if authorized)

### Authorization System

**Authorization Library** (`src/lib/authz/authz.ts`)
Database-driven functions with 5-minute caching:
- `getAllRoles()` - Get all roles with permissions
- `getRoleById(roleId)` - Get specific role with permissions
- `roleCanAccessRoute(role, path)` - Check route access
- `getAccessibleRoutes(role)` - Get all routes user can access
- `roleHasPermission(role, name)` - Check specific permission
- `clearPermissionsCache()` - Clear cache after updates

**Authentication Helpers** (`src/lib/auth/auth.ts`)
Server-side functions for route handlers and pages:

For API Routes:
```typescript
// Basic auth
const user = await requireAuth();

// Auth + permission check
const user = await requirePermission("incidents:create");

// Auth + resource action check
const user = await requireAction("incidents", "update");

// Wrapper pattern
export const POST = withPermission("incidents:create", async (req, user) => {
  // user is authenticated and authorized
});
```

For Pages:
```typescript
// In page.tsx
const user = await requireRouteAccess("/admin");

// Get accessible routes
const routes = await getMyAccessibleRoutes();

// Check specific permission
const canCreate = await canPerform("incidents:create");
```

**Middleware** (`src/middleware.ts`)
Runs on every request:
1. Allow public routes (`/login`, `/signup`, `/api/auth/*`, `/_next/*`)
2. Check authentication (JWT token)
3. Load user's role with permissions from database
4. Redirect `/` to user's `defaultPath`
5. Admin role (`ADMINISTRADOR`) gets access to all routes
6. Check route access via `roleCanAccessRoute()`
7. Redirect to `/unauthorized` if access denied

### Database Layer

**Prisma Client** (`src/lib/database/prisma.singleton.ts`)
- Always import from: `@/lib/database/prisma.singleton`
- Singleton pattern with HMR-safe globalThis caching
- Query logging in development, errors only in production

**Schema Structure** (`prisma/schema.prisma`):
Key models:
- **User** - Links to Role (roleId), VIC (vicId), UserStatus
- **Role** - Has many Permissions via RolePermission
- **Permission** - Defines access rules with resource, action, routePath
- **RolePermission** - Junction table between Role and Permission

### Application Structure

**App Router**: Next.js 15 App Router with role-based routing
- `/login`, `/signup`, `/logout` - Authentication pages
- `/admin` - Administrator dashboard (requires `route:admin` permission)
- `/fsr` - System user dashboard (requires `route:fsr` permission)
- `/client` - External user dashboard (requires `route:client` permission)
- `/guest` - Guest/staff dashboard (requires `route:guest` permission)
- `/incidents` - Incident management (requires `incidents:read` permission)
- `/unauthorized` - Access denied page

Each role has a `defaultPath` stored in database that determines where users land after login.

**Component Organization**:
- `src/components/ui/` - shadcn/ui components (New York style)
- `src/components/{entity}/` - Domain-specific components
- `src/components/layout/` - Navigation sidebars and navbars per role
- `src/components/common/` - Shared components

**Styling**: Tailwind CSS 4 with shadcn/ui
- Theme provider with dark mode support (`next-themes`)
- CSS variables for theming
- Path aliases: `@/*` maps to `src/*`

## Common Development Patterns

### Adding New Permissions

Permissions are managed in the database. To add new permissions:

1. Update seed file (`prisma/seed.ts`) with new permission:
```typescript
{ name: "resource:action", description: "...", resource: "resource", action: "action" }
```

2. Assign permission to roles in seed file:
```typescript
permissions: ["resource:action", ...otherPermissions]
```

3. Reset and seed database:
```bash
npm run db:reset
npm run db:seed
```

Alternatively, create permissions via API or admin UI (when built).

### Protecting Pages

```typescript
// src/app/some-page/page.tsx
import { requireRouteAccess } from "@/lib/auth/auth";

export default async function SomePage() {
  const user = await requireRouteAccess("/some-page");

  // user is authenticated and authorized
  // If not, user is redirected to /unauthorized

  return <div>Protected content</div>;
}
```

### Protecting API Routes

```typescript
// src/app/api/incidents/route.ts
import { withPermission } from "@/lib/auth/auth";

export const POST = withPermission("incidents:create", async (req, user) => {
  // user has incidents:create permission
  const body = await req.json();

  // ... create incident

  return Response.json({ success: true });
});

// Alternative with resource/action check
import { withAction } from "@/lib/auth/auth";

export const PUT = withAction("incidents", "update", async (req, user) => {
  // user can update incidents
  return Response.json({ success: true });
});
```

### Checking Permissions in Components

```typescript
import { canPerform, getMyAccessibleRoutes } from "@/lib/auth/auth";

export default async function MyComponent() {
  const canCreateIncidents = await canPerform("incidents:create");
  const accessibleRoutes = await getMyAccessibleRoutes();

  return (
    <div>
      {canCreateIncidents && <button>Create Incident</button>}
      <nav>
        {accessibleRoutes.map(route => <a href={route}>{route}</a>)}
      </nav>
    </div>
  );
}
```

### Getting User's Accessible Routes

```typescript
import { getMyAccessibleRoutes } from "@/lib/auth/auth";

// In a server component
const routes = await getMyAccessibleRoutes();
// Returns: ["/admin", "/incidents", "/users", ...]
```

This is useful for building dynamic navigation menus.

### Creating New Roles

1. Add role to database via seed file or admin UI:
```typescript
{
  name: "NEW_ROLE",
  description: "Description",
  defaultPath: "/new-role-home",
  permissions: ["permission1", "permission2", ...]
}
```

2. Create the route in `src/app/new-role-home/page.tsx`

3. Add route permission:
```typescript
{ name: "route:new-role-home", routePath: "/new-role-home" }
```

### Admin Access Pattern

Admin users (role: `ADMINISTRADOR`) automatically have access to ALL routes and permissions. This is enforced in:
- `src/middleware.ts:56` - Admin check in middleware
- `src/lib/authz/authz.ts:167` - Admin check in route access
- `src/lib/auth/auth.ts:147` - Admin check in requireRouteAccess

### Database Queries

Always use the singleton Prisma client:
```typescript
import { prisma } from "@/lib/database/prisma.singleton";

const incidents = await prisma.incident.findMany({
  where: { active: true },
  include: { type: true, status: true }
});
```

### Modifying the Schema

1. Edit `prisma/schema.prisma`
2. Create and apply migration:
```bash
npm run db:migrate -- --name description_of_change
```
3. Update seed file if needed (`prisma/seed.ts`)
4. Re-seed database:
```bash
npm run db:seed
```

## Environment Variables

Required in `.env`:
- `DATABASE_URL` - PostgreSQL connection string
- `NEXTAUTH_SECRET` - Secret for JWT signing (generate with: `openssl rand -base64 32`)
- `NEXTAUTH_URL` - Base URL for NextAuth (e.g., `http://localhost:3000`)

## Important Notes

- **All permissions are database-driven** - No hardcoded permission checks
- Admin role has unrestricted access to all routes and resources
- Permissions are cached for 5 minutes - call `clearPermissionsCache()` after updates
- TypeScript strict mode enabled
- Biome used for linting and formatting
- All database models have `active` boolean for soft deletes
- VIC (Vehicle Inspection Center) is the central organizational unit
- JWT tokens expire after 30 days
- Middleware runs on every request to enforce authorization

## Testing Credentials

After seeding, use these credentials to test different roles:
- **Admin**: admin@opusinspection.com / password123
- **System User**: system@opusinspection.com / password123
- **Staff**: staff@opusinspection.com / password123
- **Client**: client@opusinspection.com / password123
