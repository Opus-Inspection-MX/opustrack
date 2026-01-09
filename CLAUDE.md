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
- 4 roles: ADMINISTRADOR, FSR, CLIENT, GUEST
- 4 test users (one per role) with email pattern: `{role}@opusinspection.com` / password: `password123`
- Comprehensive permission system with route and resource-based permissions

**Role Structure**:
- **ADMINISTRADOR**: Full system access, not related to any VIC
- **FSR** (Field Service Representative): System user with management capabilities, assigned to VIC
- **CLIENT**: Raises incidents from VIC, has create permissions
- **GUEST**: Read-only access, no create permissions

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

### JWT + Edge Runtime Architecture

**Critical Design Decision**: Middleware runs on Edge Runtime (cannot use Prisma directly).

**The Pattern**:
1. **JWT Token** stores: `id`, `email`, `name`, `roleId`, `defaultPath`, `roleName`
2. **Middleware** uses JWT data for fast route protection (1-5ms, no DB calls)
3. **API Routes/Pages** still query database for fine-grained permission checks
4. **Trade-off**: Role/permission changes require user to re-login to take effect

**Why This Matters**:
- Middleware runs on EVERY request - must be fast
- Direct Prisma calls in middleware would be 25x slower (50-200ms vs 1-5ms)
- Hybrid approach: JWT for routing speed, DB for permission accuracy

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
- **Incident** - One-to-many with WorkOrder
- **WorkOrder** - Contains WorkActivity, WorkPart, and Attachment records
- **Part** - Inventory management with stock tracking

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

### Core Business Workflows

#### Incident-to-Resolution Flow
1. **CLIENT** creates incident (with photos/evidence)
2. **ADMIN** reviews and creates work order(s), assigns to FSR
3. **FSR** performs work, documents activities, records parts used, uploads evidence
4. **System** automatically closes incident when ALL work orders are completed
5. All stakeholders track real-time progress

#### Incident-Work Order Relationship
- **One incident → Many work orders** (one-to-many)
- Bidirectional navigation: Incident detail shows all work orders, work order shows parent incident
- **Automatic closure logic**: Incident status changes when all related work orders complete
- Work orders can be created independently or from incidents

#### Work Order Management

**Work Activities** - Document work performed:
- Free-text description of work done
- Timestamps for audit trail
- Multiple activities per work order

**Work Parts** - Inventory management:
- Link parts used to work orders
- **Stock Management**: Adding part to work order decrements stock automatically
- **Stock Restoration**: Deleting work part record restores stock
- Quantity tracking per work order

**File Attachments** - Evidence and documentation:
- Multiple file uploads per work order (10MB limit per file)
- Support for images, PDFs, and common file types
- **Mobile Camera Support**: HTML5 `capture="environment"` attribute for rear camera
- Provider-specific storage (Vercel Blob or Filesystem)
- Each attachment stores which provider was used

## Common Development Patterns

### CRITICAL: Security-First Development

**EVERY PAGE AND API MUST HAVE RBAC/AUTH CHECKS**:
- ✅ **ALWAYS** use `requireRouteAccess()`, `requirePermission()`, or `requireAuth()`
- ✅ **ALWAYS** check permissions before ANY database operation
- ✅ **NEVER** trust client-side data or assume user has permission
- ❌ **NEVER** skip authorization checks "temporarily" or for "testing"

**Example violations to avoid**:
```typescript
// ❌ BAD - No auth check
export async function DELETE(req: Request) {
  await prisma.incident.delete({ where: { id } });
}

// ✅ GOOD - Auth + permission check
export async function DELETE(req: Request) {
  await requirePermission("incidents:delete");
  await prisma.incident.delete({ where: { id } });
}
```

### CRUD Implementation Pattern (Preferred)

**Choose the right approach based on interactivity needs**:

#### 1. React Server Components (PREFERRED for low interactivity)

**Use for**: CRUD pages, list views, detail pages, forms without complex interactions

**Benefits**:
- Direct database access (no API layer needed)
- Faster performance (no client-server roundtrips)
- SEO-friendly
- Simpler code

**Structure**:
```
src/app/admin/incidents/
├── page.tsx                    # Server component - list view
├── [id]/page.tsx              # Server component - detail view
├── new/page.tsx               # Server component - create form
├── [id]/edit/page.tsx         # Server component - edit form
```

**Pattern with Server Actions**:
```typescript
// src/app/admin/incidents/new/page.tsx
import { requireRouteAccess } from "@/lib/auth/auth";
import { createIncident } from "@/lib/actions/incidents";

export default async function NewIncidentPage() {
  // ✅ ALWAYS check route access
  await requireRouteAccess("/admin/incidents/new");

  return (
    <form action={createIncident}>
      {/* Form fields */}
      <button type="submit">Create</button>
    </form>
  );
}

// src/lib/actions/incidents.ts
"use server";
import { requirePermission } from "@/lib/auth/auth";
import { prisma } from "@/lib/database/prisma.singleton";
import { revalidatePath } from "next/cache";

export async function createIncident(formData: FormData) {
  // ✅ ALWAYS check permissions
  const user = await requirePermission("incidents:create");

  const data = {
    title: formData.get("title") as string,
    // ... extract data
  };

  const incident = await prisma.incident.create({ data });

  revalidatePath("/admin/incidents");
  return { success: true, incident };
}
```

#### 2. API Routes + Client Components (for high interactivity)

**Use for**: Real-time updates, complex client interactions, external integrations

**Structure**:
```
src/app/api/incidents/
├── route.ts                   # GET, POST
├── [id]/route.ts             # GET, PUT, DELETE
src/components/incidents/
└── InteractiveIncidentForm.tsx  # Client component
```

**API Route Pattern**:
```typescript
// src/app/api/incidents/route.ts
import { requirePermission, withPermission } from "@/lib/auth/auth";

// Option 1: Manual check
export async function GET(req: Request) {
  // ✅ ALWAYS check permissions
  const user = await requirePermission("incidents:read");

  const incidents = await prisma.incident.findMany({
    where: { active: true }
  });

  return Response.json(incidents);
}

// Option 2: Wrapper pattern (preferred)
export const POST = withPermission("incidents:create", async (req, user) => {
  // user is already authenticated and authorized
  const body = await req.json();

  const incident = await prisma.incident.create({
    data: body
  });

  return Response.json(incident);
});

// Option 3: Resource/action check
import { withAction } from "@/lib/auth/auth";

export const PUT = withAction("incidents", "update", async (req, user) => {
  // user can update incidents
  const body = await req.json();
  return Response.json({ success: true });
});
```

**Client Component Pattern**:
```typescript
// src/components/incidents/InteractiveIncidentForm.tsx
"use client";

export function InteractiveIncidentForm() {
  const handleSubmit = async (data: FormData) => {
    // Call API route
    const response = await fetch("/api/incidents", {
      method: "POST",
      body: JSON.stringify(data),
    });

    // Handle response
  };

  return <form>{/* Interactive form */}</form>;
}
```

### Decision Guide: Server Component vs API Route?

| Scenario | Use Server Components | Use API Routes |
|----------|----------------------|----------------|
| Simple CRUD list/detail pages | ✅ | |
| Forms without complex validation | ✅ | |
| Static or mostly static content | ✅ | |
| Real-time updates (polling/websockets) | | ✅ |
| Complex client-side state management | | ✅ |
| Third-party integrations | | ✅ |
| File uploads with progress tracking | | ✅ |
| Multi-step wizards with client state | | ✅ |

**Default Rule**: **Start with Server Components**. Only add API routes when you need client-side interactivity.

### Authorization Checklist (Use for EVERY feature)

**Before deploying ANY feature, verify**:

1. **Page Protection** (Server Components):
   - ✅ `requireRouteAccess("/path")` at top of page
   - ✅ Redirects to `/unauthorized` if user lacks permission

2. **API Protection** (API Routes):
   - ✅ `requirePermission()`, `requireAuth()`, or wrapper functions
   - ✅ Returns 401/403 for unauthorized requests

3. **Server Action Protection**:
   - ✅ Every server action has permission check
   - ✅ Cannot be bypassed by direct function calls

4. **Data Filtering** (if applicable):
   - ✅ Users only see their VIC's data (unless ADMINISTRADOR)
   - ✅ Queries filter by `where: { vicId: user.vicId }`

5. **Cache Revalidation**:
   - ✅ All mutations revalidate affected paths
   - ✅ Both admin and role-specific paths revalidated

**Security Test Questions**:
- Can a CLIENT user access FSR routes? → Should be NO
- Can a GUEST user create incidents? → Should be NO
- Can a user modify another VIC's data? → Should be NO (unless ADMIN)
- What happens if I call the API without auth? → Should return 401
- What happens if JWT is tampered with? → Should be rejected

### Next.js 15 Async Params Pattern

**IMPORTANT**: All dynamic route params must be awaited in Next.js 15:

```typescript
// src/app/admin/incidents/[id]/page.tsx
import { requireRouteAccess } from "@/lib/auth/auth";
import { prisma } from "@/lib/database/prisma.singleton";

export default async function IncidentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // ✅ ALWAYS check authorization first
  const user = await requireRouteAccess("/admin/incidents");

  const { id } = await params; // Must await!

  const incident = await prisma.incident.findUnique({
    where: { id: Number.parseInt(id) }
  });

  return <div>{/* ... */}</div>;
}
```

### Soft Delete Pattern

**All deletes are soft deletes** - records are never physically removed:
- Set `active: false` instead of deleting
- Validates no active child records exist before deletion
- Maintains data integrity and audit trail
- Filter queries with `where: { active: true }`

**Example**:
```typescript
// Before soft delete, check for children
const workOrderCount = await prisma.workOrder.count({
  where: { incidentId: id, active: true }
});

if (workOrderCount > 0) {
  throw new Error("Cannot delete incident with active work orders");
}

// Soft delete
await prisma.incident.update({
  where: { id },
  data: { active: false }
});
```

### Cache Revalidation Pattern

**All mutations MUST revalidate affected paths**:
- Revalidate both `/admin/...` and role-specific paths
- Use `revalidatePath()` after create/update/delete operations

```typescript
import { revalidatePath } from "next/cache";

// After mutation
revalidatePath("/admin/work-orders");
revalidatePath("/fsr/work-orders");  // If FSR can access
revalidatePath(`/client/incidents/${incidentId}`);  // Specific pages too
```

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

### File Storage

The application supports two file storage backends:

**Vercel Blob (Default)**: Cloud-based storage, recommended for production
- Set `FILE_STORAGE_PROVIDER="vercel-blob"` in `.env`
- Requires `BLOB_READ_WRITE_TOKEN` from Vercel Dashboard
- Files are stored in Vercel's cloud storage
- Automatically handles CDN distribution

**Filesystem**: Local file storage, useful for development
- Set `FILE_STORAGE_PROVIDER="filesystem"` in `.env`
- Files stored in `public/uploads/` directory
- No additional configuration needed

**Using the storage abstraction** (`src/lib/storage/file-storage.ts`):

```typescript
import { uploadFile, deleteFile, getFileUrl } from "@/lib/storage/file-storage";

// Upload a file (automatically uses configured provider)
const result = await uploadFile(
  filename,
  base64Data,
  mimetype,
  { subfolder: "work-orders" }
);
// Returns: { url, filename, size, mimetype, provider }

// Delete a file
await deleteFile(url, provider);

// Get file URL for display
const displayUrl = getFileUrl(storedUrl, provider);
```

The provider is automatically determined from `FILE_STORAGE_PROVIDER` environment variable. Each attachment in the database stores which provider was used, ensuring correct deletion even if the provider changes.

## Environment Variables

Required in `.env`:
- `DATABASE_URL` - PostgreSQL connection string
- `NEXTAUTH_SECRET` - Secret for JWT signing (generate with: `openssl rand -base64 32`)
- `NEXTAUTH_URL` - Base URL for NextAuth (e.g., `http://localhost:3000`)

Optional file storage configuration:
- `FILE_STORAGE_PROVIDER` - Storage provider: `"vercel-blob"` (default) or `"filesystem"`
- `BLOB_READ_WRITE_TOKEN` - Required if using Vercel Blob storage (obtain from Vercel Dashboard)

## Important Notes

### Security & Authorization
- **All permissions are database-driven** - No hardcoded permission checks
- **Admin role** (`ADMINISTRADOR`) has unrestricted access to all routes and resources
- Permissions are cached for 5 minutes - call `clearPermissionsCache()` after updates
- JWT tokens expire after 30 days
- Middleware runs on every request to enforce authorization
- Role changes require re-login to take effect (JWT-based routing)

### Data Management
- **All deletes are soft deletes** - Set `active: false`, never physically delete
- **Stock management is automatic** - Adding parts to work orders decrements stock, removing restores it
- All database models have `active` boolean for soft deletes
- VIC (Vehicle Inspection Center) is the central organizational unit

### Development
- TypeScript strict mode enabled
- Biome used for linting and formatting (not ESLint/Prettier)
- Next.js 15 requires `await params` in dynamic routes
- All CRUD uses Server Actions (NOT API routes)
- Always revalidate cache after mutations

## Testing Credentials

After seeding, use these credentials to test different roles:
- **Admin**: admin@opusinspection.com / password123
- **System User**: system@opusinspection.com / password123
- **Staff**: staff@opusinspection.com / password123
- **Client**: client@opusinspection.com / password123
