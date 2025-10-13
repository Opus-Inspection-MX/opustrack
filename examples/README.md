# Usage Examples

This directory contains examples of how to use the new database-driven authentication and authorization system.

## Files

1. **protected-page-example.tsx** - Example of a protected page component
2. **protected-api-example.ts** - Example of protected API routes with various patterns
3. **navigation-example.tsx** - Example of dynamic navigation based on user permissions

## Quick Start

### 1. Protecting a Page

Copy the pattern from `protected-page-example.tsx`:

```typescript
import { requireRouteAccess } from "@/lib/auth/auth";

export default async function YourPage() {
  const user = await requireRouteAccess("/your-route");

  return <div>Protected content</div>;
}
```

### 2. Protecting an API Route

Copy the pattern from `protected-api-example.ts`:

```typescript
import { withPermission } from "@/lib/auth/auth";

export const POST = withPermission("resource:action", async (req, user) => {
  // Your logic here
  return Response.json({ success: true });
});
```

### 3. Building Dynamic Navigation

Copy the pattern from `navigation-example.tsx`:

```typescript
import { getMyAccessibleRoutes } from "@/lib/auth/auth";

export default async function Nav() {
  const routes = await getMyAccessibleRoutes();

  return (
    <nav>
      {routes.map(route => <a href={route}>{route}</a>)}
    </nav>
  );
}
```

## Common Patterns

### Check if User Has Permission

```typescript
import { canPerform } from "@/lib/auth/auth";

const hasPermission = await canPerform("incidents:create");

if (hasPermission) {
  // Show create button
}
```

### Get User's Accessible Routes

```typescript
import { getMyAccessibleRoutes } from "@/lib/auth/auth";

const routes = await getMyAccessibleRoutes();
// Returns: ["/admin", "/incidents", ...]
```

### Check if User is Admin

```typescript
import { isCurrentUserAdmin } from "@/lib/auth/auth";

const isAdmin = await isCurrentUserAdmin();

if (isAdmin) {
  // Show admin features
}
```

### Get Current User's Role

```typescript
import { getCurrentUserRole } from "@/lib/auth/auth";

const role = await getCurrentUserRole();
console.log(role?.name); // "ADMINISTRADOR"
```

### Manual Permission Check in API

```typescript
import { requireAuth, assertPermission } from "@/lib/auth/auth";

export async function POST(req: Request) {
  const user = await requireAuth();
  assertPermission(user, "incidents:create");

  // User is authenticated and has permission
}
```

### Check Resource Action

```typescript
import { canPerformAction } from "@/lib/auth/auth";

const canUpdate = await canPerformAction("incidents", "update");
```

## Testing

Use these test credentials:

- **Admin**: admin@opusinspection.com / password123
  - Can access: All routes

- **System User**: system@opusinspection.com / password123
  - Can access: /fsr, /incidents, /work-orders, /parts, /schedules

- **Staff**: staff@opusinspection.com / password123
  - Can access: /guest, /incidents (limited), /work-orders (limited)

- **Client**: client@opusinspection.com / password123
  - Can access: /client, /incidents (read only), /work-orders (read only)

## Best Practices

1. **Always protect pages** - Use `requireRouteAccess()` in page components
2. **Always protect API routes** - Use `withAuth()`, `withPermission()`, or `withAction()`
3. **Use wrapper functions** - Prefer `withPermission()` over manual checks
4. **Check permissions in UI** - Use `canPerform()` to show/hide features
5. **Build dynamic navigation** - Use `getMyAccessibleRoutes()` for menus
6. **Clear cache after updates** - Call `clearPermissionsCache()` after role/permission changes

## More Information

- See `CLAUDE.md` for architecture details
- See `MIGRATION_GUIDE.md` for migration steps
- See `REFACTOR_SUMMARY.md` for summary of changes
- See `src/lib/auth/auth.ts` for all available functions
- See `src/lib/authz/authz.ts` for authorization logic
