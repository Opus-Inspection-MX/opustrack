# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

OpusTrack is a professional incident management and work order tracking system for Vehicle Inspection Centers (VICs) in Mexico. Built with Next.js 15, Prisma, NextAuth, and PostgreSQL.

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

The seed script (`prisma/seed.ts`) populates all Mexican states, VICs, roles, permissions, users, and sample data. Each role gets a user with email `{rolename}@opusinspection.com` and password `password123`.

## Architecture

### Authentication & Authorization

**NextAuth Configuration**: Credentials-based JWT authentication in `src/app/api/auth/[...nextauth]/route.ts`
- Session stored as JWT (required for Credentials provider)
- User data includes role and defaultPath in token
- Passwords hashed with bcrypt

**Middleware**: Route protection in `src/middleware.ts:5-53`
- Redirects unauthenticated users to `/login`
- Redirects authenticated users away from `/login` to their role's `defaultPath`
- Allows public routes: `/_next`, `/favicon`, `/images`, `/api/auth`

**Role-Based Access Control (RBAC)**: Single source of truth in `src/lib/authz/authz.ts:26-47`
- `ROLE_DEFS` object defines all roles with their permissions and default paths
- Four roles: `USUARIO_EXTERNO`, `USUARIO_PERSONAL`, `USUARIO_SISTEMA`, `USUARIO_ADMINISTRADOR`
- TypeScript types (`RoleName`, `PermissionName`) derived automatically from `ROLE_DEFS`
- Helper functions: `roleHasPermission()`, `resolveDefaultPath()`

**Authorization Helpers**: Server-side checks in `src/lib/auth/auth.ts`
- `getSessionUserOrThrow()`: Gets authenticated user with role and permissions
- `assertCan(user, permission)`: Throws if user lacks required permission
- Usage pattern:
  ```typescript
  const user = await getSessionUserOrThrow();
  assertCan(user, "incident.update");
  ```

### Database Layer

**Prisma Client**: Singleton pattern in `src/lib/database/prisma.singleton.ts:7-9`
- Always import from: `@/lib/database/prisma.singleton`
- Logs queries in development, errors only in production
- HMR-safe with globalThis caching

**Schema Structure** (`prisma/schema.prisma`):
- **Core entities**: User, Role, Permission (with RolePermission junction)
- **Geographic**: State, VehicleInspectionCenter (VIC)
- **Incidents**: Incident, IncidentType, IncidentStatus, Schedule
- **Work Management**: WorkOrder, WorkActivity, WorkOrderAttachment
- **Inventory**: Part, WorkPart
- **User Management**: UserStatus, UserProfile

Key relationships:
- Users belong to one Role and one VIC (optional)
- Incidents belong to VIC and have WorkOrders
- WorkOrders assigned to Users and contain WorkActivities
- Parts scoped to VIC with `@@unique([name, vicId])`

### Application Structure

**App Router**: Next.js 15 App Router with role-based routing
- `/login`, `/signup`, `/logout` - Authentication pages
- `/admin` - Administrator dashboard (USUARIO_ADMINISTRADOR)
- `/fsr` - System user dashboard (USUARIO_SISTEMA)
- `/client` - External user dashboard (USUARIO_EXTERNO)
- `/guest` - Guest/staff dashboard (USUARIO_PERSONAL)
- `/incidents` - Incident management
- `/unauthorized` - Access denied page

Each role has a default path defined in `ROLE_DEFS` that middleware uses for redirects.

**Component Organization**:
- `src/components/ui/` - shadcn/ui components (New York style)
- `src/components/ui_/` - Backup/alternative UI components
- `src/components/{entity}/` - Domain-specific components (incidents, work-orders, etc.)
- `src/components/layout/` - Navigation sidebars and navbars per role
- `src/components/common/` - Shared components (pagination, filters)

**Styling**: Tailwind CSS 4 with shadcn/ui
- Theme provider with dark mode support (`next-themes`)
- CSS variables for theming
- Path aliases: `@/*` maps to `src/*`

## Important Patterns

### Adding New Permissions
1. Update permission groups in `src/lib/authz/authz.ts:6-23`
2. Assign to roles in `ROLE_DEFS` (lines 26-47)
3. Types auto-update; no manual type definitions needed
4. Run `npm run db:seed` to sync permissions to database

### Creating Protected API Routes
```typescript
import { getSessionUserOrThrow, assertCan } from "@/lib/auth/auth";

export async function POST(req: Request) {
  const user = await getSessionUserOrThrow();
  assertCan(user, "incident.create");
  // ... your logic
}
```

### Database Queries
Always use the singleton Prisma client:
```typescript
import { prisma } from "@/lib/database/prisma.singleton";
```

### Modifying the Schema
1. Edit `prisma/schema.prisma`
2. Run `npm run db:migrate` (creates migration + regenerates client)
3. Update seed script if needed (`prisma/seed.ts`)
4. Run `npm run db:seed` to populate changes

## Environment Variables

Required in `.env`:
- `DATABASE_URL` - PostgreSQL connection string
- `NEXTAUTH_SECRET` - Secret for JWT signing
- `NEXTAUTH_URL` - Base URL for NextAuth (e.g., `http://localhost:3000`)

## Notes

- This is a Next.js 15 project using Turbopack for faster builds
- TypeScript strict mode enabled
- Biome used instead of ESLint/Prettier for linting and formatting
- All database models have `active` boolean for soft deletes
- VIC (Vehicle Inspection Center) is the central organizational unit
