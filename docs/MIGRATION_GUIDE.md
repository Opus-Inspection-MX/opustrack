# Migration Guide - Database-Driven RBAC

This guide will help you migrate from the old hardcoded permission system to the new database-driven RBAC system.

## Overview of Changes

### What Changed
1. **Prisma Schema**: Added `resource`, `action`, `routePath` fields to Permission model
2. **Seed File**: Simplified to 1 VIC, 1 part, comprehensive database-driven permissions
3. **authz.ts**: Complete rewrite - now reads from database instead of hardcoded ROLE_DEFS
4. **auth.ts**: New helper functions for authentication and authorization
5. **middleware.ts**: Now uses database permissions for route access control
6. **NextAuth**: Improved error handling and user status validation

### What's New
- **Database-driven permissions**: All roles and permissions stored in database
- **Route-based permissions**: Permissions can grant access to specific routes
- **Resource-action permissions**: Fine-grained control (e.g., "incidents:read", "users:create")
- **Permission caching**: 5-minute cache for performance
- **Admin superuser**: Admin role automatically has access to everything
- **Helper functions**: `getMyAccessibleRoutes()`, `canPerform()`, `requireRouteAccess()`, etc.

## Migration Steps

### Step 1: Create Database Migration

```bash
# Create migration for schema changes
npm run db:migrate -- --name add_permission_fields

# This will generate a migration file
```

The migration will add these fields to the Permission table:
- `resource` (String?)
- `action` (String?)
- `routePath` (String?)
- `createdAt` (DateTime)
- `updatedAt` (DateTime)

### Step 2: Reset and Seed Database

```bash
# Reset database and apply all migrations
npm run db:reset

# Seed with new data structure
npm run db:seed
```

This will create:
- 1 VIC in CDMX
- 1 Part (Filtro de Aire)
- 4 Roles with proper permissions
- 4 Test users (one per role)

### Step 3: Update Environment Variables

Make sure your `.env` file has:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/opustrack"
NEXTAUTH_SECRET="your-secret-here"  # Generate with: openssl rand -base64 32
NEXTAUTH_URL="http://localhost:3000"
```

### Step 4: Test the System

Test each role:

1. **Admin** (admin@opusinspection.com / password123)
   - Should have access to ALL routes
   - Redirects to `/admin` after login

2. **System User** (system@opusinspection.com / password123)
   - Has management capabilities
   - Redirects to `/fsr` after login
   - Can access: incidents, work-orders, parts, schedules, reports

3. **Staff** (staff@opusinspection.com / password123)
   - Limited access
   - Redirects to `/guest` after login
   - Can access: incidents (read/create/update), work-orders (read/update), parts (read)

4. **Client** (client@opusinspection.com / password123)
   - Minimal access
   - Redirects to `/client` after login
   - Can access: incidents (read/create), work-orders (read), schedules (read)

### Step 5: Update Existing Code

If you have existing code that uses the old system, update it:

#### Old Way (Hardcoded)
```typescript
import { ROLE_DEFS, assertCan } from "@/lib/authz/authz";

// This no longer works
if (ROLE_DEFS.ADMINISTRADOR.permissions.includes("incidents:read")) {
  // ...
}
```

#### New Way (Database-Driven)
```typescript
import { canPerform, getMyAccessibleRoutes } from "@/lib/auth/auth";

// Check permission
const canRead = await canPerform("incidents:read");

// Get all accessible routes
const routes = await getMyAccessibleRoutes();
```

#### Protecting Pages
```typescript
// Old way
const session = await getServerSession();
if (!session) redirect("/login");

// New way
import { requireRouteAccess } from "@/lib/auth/auth";

const user = await requireRouteAccess("/your-route");
// User is authenticated and authorized, or redirected
```

#### Protecting API Routes
```typescript
// Old way
export async function POST(req: Request) {
  const user = await getSessionUserOrThrow();
  assertCan(user, "incidents:create");
  // ...
}

// New way
import { withPermission } from "@/lib/auth/auth";

export const POST = withPermission("incidents:create", async (req, user) => {
  // user is authenticated and has permission
});
```

## Common Issues and Solutions

### Issue: "Permission denied" errors

**Solution**: Check that the user's role has the required permission in the database:
```sql
-- Via Prisma Studio or SQL
SELECT p.name, r.name as role_name
FROM "Permission" p
JOIN "RolePermission" rp ON p.id = rp."permissionId"
JOIN "Role" r ON rp."roleId" = r.id
WHERE r.name = 'USUARIO_SISTEMA';
```

### Issue: Routes not accessible

**Solution**: Ensure route permissions exist:
```sql
SELECT * FROM "Permission" WHERE "routePath" IS NOT NULL;
```

Each main route should have a corresponding permission with `routePath` set.

### Issue: Cache not updating after permission changes

**Solution**: Clear the permissions cache:
```typescript
import { clearPermissionsCache } from "@/lib/authz/authz";

// After updating permissions
clearPermissionsCache();
```

### Issue: User redirected to unauthorized page

**Possible causes**:
1. User's role doesn't have permission for the route
2. Route permission not defined in database
3. Admin not being recognized (role name must be exactly "ADMINISTRADOR")

**Debug**:
```typescript
import { getMyAccessibleRoutes, getCurrentUserRole } from "@/lib/auth/auth";

const role = await getCurrentUserRole();
const routes = await getMyAccessibleRoutes();

console.log("User role:", role?.name);
console.log("Accessible routes:", routes);
```

## Adding New Features

### Add New Route
1. Create the route in `src/app/your-route/page.tsx`
2. Add permission to database (via seed or admin UI):
   ```typescript
   { name: "route:your-route", routePath: "/your-route" }
   ```
3. Assign permission to appropriate roles
4. Protect the page:
   ```typescript
   const user = await requireRouteAccess("/your-route");
   ```

### Add New Resource Permissions
1. Add permissions to seed file:
   ```typescript
   { name: "resource:read", resource: "resource", action: "read" },
   { name: "resource:create", resource: "resource", action: "create" },
   ```
2. Assign to roles in seed file
3. Re-seed database: `npm run db:seed`
4. Use in code:
   ```typescript
   const user = await requireAction("resource", "create");
   ```

### Add New Role
1. Add to seed file:
   ```typescript
   {
     name: "NEW_ROLE",
     description: "Description",
     defaultPath: "/new-role-home",
     permissions: ["permission1", "permission2"]
   }
   ```
2. Re-seed database
3. Create the default path route
4. Test with a user assigned to the new role

## Verification Checklist

After migration, verify:

- [ ] Database migration applied successfully
- [ ] All roles exist in database
- [ ] All permissions exist in database
- [ ] RolePermission mappings created
- [ ] Test users can login
- [ ] Admin can access all routes
- [ ] Other roles can only access their permitted routes
- [ ] Unauthorized routes redirect to `/unauthorized`
- [ ] Login redirects to user's defaultPath
- [ ] `getMyAccessibleRoutes()` returns correct routes

## Rollback Plan

If you need to rollback:

```bash
# View migration history
npx prisma migrate status

# Rollback last migration
npx prisma migrate resolve --rolled-back MIGRATION_NAME

# Or reset to specific migration
npx prisma migrate reset
```

Then restore the old code files from git history.

## Support

For issues or questions:
1. Check the CLAUDE.md file for architecture details
2. Review `src/lib/auth/auth.ts` for available helper functions
3. Review `src/lib/authz/authz.ts` for authorization logic
4. Check middleware logic in `src/middleware.ts`
