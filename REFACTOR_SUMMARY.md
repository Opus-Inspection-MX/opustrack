# Authentication & Authorization Refactor Summary

## What Was Accomplished

### 1. Database Schema Updates ✅

**File**: `prisma/schema.prisma`

Added new fields to Permission model:
- `resource` - Resource type (e.g., "incidents", "users")
- `action` - Action type (e.g., "read", "create", "update")
- `routePath` - Route permission grants access to (e.g., "/admin", "/incidents")
- `createdAt` and `updatedAt` timestamps

Added new fields to Role model:
- `description` - Role description
- `createdAt` and `updatedAt` timestamps

**Database Migration**: Applied successfully as `20251013071031_add_permission_route_fields`

### 2. Simplified Seed File ✅

**File**: `prisma/seed.ts`

**Changed from**: 31 VICs (one per Mexican state) with many parts
**Changed to**: 1 VIC (CDMX) with 1 part (Filtro de Aire)

**New Structure**:
- ✅ 1 VIC: Centro de Verificación CDMX Principal
- ✅ 1 Part: Filtro de Aire
- ✅ 4 Roles: ADMINISTRADOR, USUARIO_SISTEMA, USUARIO_PERSONAL, USUARIO_EXTERNO
- ✅ 4 Users: admin@, system@, staff@, client@opusinspection.com (password: password123)
- ✅ 45+ Permissions covering routes, incidents, users, work-orders, parts, VICs, schedules, reports

**Permissions Structure**:
- Route permissions: `route:admin`, `route:fsr`, `route:client`, `route:guest`
- Resource permissions: `{resource}:{action}` (e.g., `incidents:read`, `users:create`)

### 3. Database-Driven Authorization Library ✅

**File**: `src/lib/authz/authz.ts`

**Changed from**: Hardcoded `ROLE_DEFS` object with static permissions
**Changed to**: Dynamic database queries with caching

**Key Functions**:
- `getAllRoles()` - Fetch all roles with permissions
- `getRoleById(roleId)` - Get specific role
- `getRoleByName(name)` - Get role by name
- `roleCanAccessRoute(role, path)` - Check route access
- `getAccessibleRoutes(role)` - Get all accessible routes
- `roleHasPermission(role, name)` - Check specific permission
- `userHasPermission(user, name)` - Check user permission
- `userCanPerformAction(user, resource, action)` - Check resource action
- `clearPermissionsCache()` - Clear cache

**Features**:
- ✅ 5-minute caching for performance
- ✅ Reads from database on each cache miss
- ✅ Admin role automatically has access to everything
- ✅ Type-safe interfaces

### 4. Enhanced Authentication Helpers ✅

**File**: `src/lib/auth/auth.ts`

**New Functions**:

**For Pages**:
- `requireAuthPage(callbackUrl?)` - Get user or redirect to login
- `requireRouteAccess(path, callbackUrl?)` - Require specific route access
- `getMyAccessibleRoutes()` - Get current user's accessible routes
- `canPerform(permission)` - Check if current user has permission
- `canAccessRoute(path)` - Check if current user can access route

**For API Routes**:
- `requireAuth()` - Get user or throw error
- `requirePermission(name)` - Require specific permission
- `requireAction(resource, action)` - Require resource action
- `withAuth(handler)` - Wrap API route with auth
- `withPermission(name, handler)` - Wrap API route with permission check
- `withAction(resource, action, handler)` - Wrap API route with action check

**Utility Functions**:
- `getAuthenticatedUser()` - Get current user or null
- `isCurrentUserAdmin()` - Check if admin
- `getCurrentUserRole()` - Get current role
- `getCurrentUserDefaultPath()` - Get default path

### 5. Database-Driven Middleware ✅

**File**: `src/middleware.ts`

**Changed from**: Basic authentication with hardcoded path checks
**Changed to**: Database-driven route authorization

**Flow**:
1. Allow public routes
2. Check JWT token authentication
3. Load user's role with permissions from database
4. Redirect `/` to user's `defaultPath`
5. Admin gets access to all routes
6. Check route access via `roleCanAccessRoute()`
7. Redirect to `/unauthorized` if denied

### 6. Improved NextAuth Configuration ✅

**File**: `src/app/api/auth/[...nextauth]/route.ts`

**Improvements**:
- ✅ Better error messages ("Invalid email or password", "Account is not active")
- ✅ User status validation (must be "ACTIVO")
- ✅ 30-day JWT expiration
- ✅ Debug mode in development
- ✅ Proper session type safety

### 7. Updated Documentation ✅

**Files**:
- `CLAUDE.md` - Complete rewrite with new architecture
- `MIGRATION_GUIDE.md` - Step-by-step migration instructions
- `REFACTOR_SUMMARY.md` - This file

## How to Get User's Accessible Routes

This was one of your main questions. Here's how:

### In Server Components (Pages)
```typescript
import { getMyAccessibleRoutes } from "@/lib/auth/auth";

export default async function MyPage() {
  const routes = await getMyAccessibleRoutes();
  // Returns: ["/admin", "/incidents", "/users", ...]

  return (
    <nav>
      {routes.map(route => (
        <a key={route} href={route}>{route}</a>
      ))}
    </nav>
  );
}
```

### In API Routes
```typescript
import { getAccessibleRoutes } from "@/lib/authz/authz";
import { requireAuth } from "@/lib/auth/auth";

export async function GET(req: Request) {
  const user = await requireAuth();
  const routes = getAccessibleRoutes(user.role);

  return Response.json({ routes });
}
```

### For Specific User (Admin Feature)
```typescript
import { getRoleById, getAccessibleRoutes } from "@/lib/authz/authz";

// Get routes for specific role
const role = await getRoleById(roleId);
if (role) {
  const routes = getAccessibleRoutes(role);
}
```

## Admin Superuser Pattern

The ADMINISTRADOR role has special treatment:
- ✅ `src/middleware.ts:56` - Bypass all route checks
- ✅ `src/lib/authz/authz.ts:167` - Granted access to all routes
- ✅ `src/lib/auth/auth.ts:147` - Skip route access validation

Admin users can access **any route** and have **all permissions**.

## Testing the System

### Test Users (Created by Seed)

1. **Admin** - admin@opusinspection.com / password123
   - Default Path: `/admin`
   - Access: Everything
   - Permissions: All 45+ permissions

2. **System User** - system@opusinspection.com / password123
   - Default Path: `/fsr`
   - Access: FSR dashboard, incidents (full CRUD), work orders, parts, schedules, reports
   - Permissions: 17 permissions

3. **Staff** - staff@opusinspection.com / password123
   - Default Path: `/guest`
   - Access: Guest dashboard, incidents (limited), work orders (read/update), parts (read)
   - Permissions: 8 permissions

4. **Client** - client@opusinspection.com / password123
   - Default Path: `/client`
   - Access: Client dashboard, incidents (read/create), work orders (read), schedules (read)
   - Permissions: 6 permissions

### Test Scenarios

1. **Login with each user** → Should redirect to their `defaultPath`
2. **Try accessing other routes** → Should either allow (if permitted) or redirect to `/unauthorized`
3. **Admin user** → Should access ALL routes without restriction
4. **Check `getMyAccessibleRoutes()`** → Should return only permitted routes
5. **API calls with permissions** → Should enforce permission checks

## Key Benefits

1. ✅ **No More Hardcoded Permissions** - Everything in database
2. ✅ **Easy Role Management** - Add/remove permissions via database
3. ✅ **Flexible Permission Model** - Supports routes, resources, actions
4. ✅ **Performance** - 5-minute caching reduces database queries
5. ✅ **Type Safety** - TypeScript interfaces for all auth functions
6. ✅ **Admin Superuser** - Admin role has unrestricted access
7. ✅ **Dynamic Navigation** - Build menus from user's accessible routes
8. ✅ **Scalable** - Easy to add new roles, permissions, routes

## Next Steps

1. **Update Existing Pages** - Add `requireRouteAccess()` to protected pages
2. **Update API Routes** - Use `withPermission()` or `withAction()` wrappers
3. **Build Admin UI** - Create pages to manage roles and permissions
4. **Build Dynamic Navigation** - Use `getMyAccessibleRoutes()` for menus
5. **Add Permission Checks in Components** - Use `canPerform()` to show/hide features
6. **Test All User Flows** - Verify each role can only access permitted routes

## Verification

Run these commands to verify everything works:

```bash
# Check database
npm run db:studio

# Verify tables: Role, Permission, RolePermission
# Verify 4 roles exist
# Verify 45+ permissions exist
# Verify RolePermission mappings

# Start development server
npm run dev

# Test login with each user
# Verify redirects to correct defaultPath
# Verify route access enforcement
```

## Support

- See `CLAUDE.md` for architecture details
- See `MIGRATION_GUIDE.md` for migration steps
- Check `src/lib/auth/auth.ts` for available functions
- Check `src/lib/authz/authz.ts` for authorization logic
