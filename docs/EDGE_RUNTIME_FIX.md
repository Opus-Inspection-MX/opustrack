# Edge Runtime Fix for Middleware

## The Problem

### Error Message
```
PrismaClientValidationError: In order to run Prisma Client on edge runtime, either:
- Use Prisma Accelerate: https://pris.ly/d/accelerate
- Use Driver Adapters: https://pris.ly/d/driver-adapters
```

### Root Cause

Next.js middleware runs on the **Edge Runtime** by default, which has limitations:
- Cannot use Node.js APIs
- Cannot use traditional database connections
- Prisma Client doesn't work without adapters

Our original middleware was trying to:
```typescript
// ❌ This doesn't work in Edge Runtime
const role = await getRoleById(roleId); // Calls Prisma
```

## The Solution

### Best Practice: JWT-Based Authorization

Instead of querying the database in middleware, store all necessary data in the JWT token:

1. **Include role data in JWT** (at login time)
2. **Read from token in middleware** (no database calls)
3. **Validate routes based on token data**

### Implementation

#### 1. Updated NextAuth Configuration

**File**: `src/app/api/auth/[...nextauth]/route.ts`

```typescript
callbacks: {
  async jwt({ token, user }) {
    if (user) {
      token.id = user.id;
      token.roleId = user.roleId;
      token.roleName = user.role?.name;      // ← Added
      token.defaultPath = user.role?.defaultPath; // ← Added
    }
    return token;
  },
  async session({ session, token }) {
    if (session.user) {
      session.user.id = token.id as string;
      session.user.roleId = token.roleId as number;
      session.user.roleName = token.roleName as string;    // ← Added
      session.user.defaultPath = token.defaultPath as string; // ← Added
    }
    return session;
  }
}
```

**Why**: All role data is now embedded in the JWT token, available without database queries.

#### 2. Simplified Middleware

**File**: `src/middleware.ts`

```typescript
export async function middleware(req: NextRequest) {
  const token = await getToken({ req });

  if (!token) {
    // Redirect to login
  }

  // ✅ Read from token (no database call)
  const roleName = token.roleName as string;
  const defaultPath = token.defaultPath as string;

  // Check access using simple logic
  const canAccess = checkRouteAccess(roleName, pathname);
}

function checkRouteAccess(roleName: string, pathname: string): boolean {
  const roleRoutes: Record<string, string[]> = {
    ADMINISTRADOR: ["/*"],
    USUARIO_SISTEMA: ["/fsr", "/incidents", "/work-orders", ...],
    // ...
  };

  const allowedRoutes = roleRoutes[roleName] || [];
  return allowedRoutes.some(route => pathname.startsWith(route));
}
```

**Benefits**:
- ✅ No Prisma calls (works in Edge Runtime)
- ✅ Fast (no database latency)
- ✅ Simple and maintainable
- ✅ Secure (JWT is signed)

#### 3. Updated Type Definitions

**File**: `src/types/auth/next-auth.ts`

```typescript
declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    roleId?: number | null;
    roleName?: string | null;        // ← Added
    defaultPath?: string | null;     // ← Added
  }
}
```

## Trade-offs

### Previous Approach (Database-Driven)

**Pros**:
- Permissions updated immediately in database
- Fully dynamic

**Cons**:
- ❌ Doesn't work in Edge Runtime
- ❌ Slower (database call on every request)
- ❌ More complex

### Current Approach (JWT-Based)

**Pros**:
- ✅ Works in Edge Runtime
- ✅ Fast (no database calls)
- ✅ Simple
- ✅ Follows Next.js best practices

**Cons**:
- Role changes require re-login (token must be refreshed)

## When Do Permissions Update?

### JWT Token Lifespan

- Token expires after **30 days** (configured in NextAuth)
- Role changes in database won't affect logged-in users until:
  - They log out and log back in
  - Their token expires
  - You implement token refresh

### Force Refresh (Optional)

If you need immediate permission updates, you can:

1. **Shorten token expiry**:
```typescript
session: {
  maxAge: 60 * 60, // 1 hour instead of 30 days
}
```

2. **Implement refresh logic**:
```typescript
async jwt({ token, trigger }) {
  if (trigger === "update") {
    // Refetch user from database
    const user = await prisma.user.findUnique({
      where: { id: token.id },
      include: { role: true }
    });
    token.roleName = user?.role?.name;
  }
  return token;
}
```

3. **Force logout** when roles change (admin action)

## Migration Notes

### What Changed

1. **Middleware** no longer calls Prisma
2. **Token** includes `roleName` and `defaultPath`
3. **Route access** checked via simple `checkRouteAccess()` function
4. **Role permissions** defined in middleware (not database)

### Database Permissions Still Used

The database permissions (`Permission`, `Role`, `RolePermission` tables) are still used for:

- **API route authorization** via `src/lib/auth/auth.ts`
- **Component-level checks** via `canPerform()`
- **Fine-grained permissions** via `requirePermission()`

Only the **middleware route protection** is now JWT-based.

## Best Practices

### ✅ DO

- Store minimal data in JWT (just role name and default path)
- Use database checks for fine-grained API permissions
- Keep middleware logic simple
- Use Edge Runtime for better performance

### ❌ DON'T

- Store sensitive data in JWT (it's just encoded, not encrypted)
- Query database in middleware
- Make JWT tokens huge (performance impact)
- Forget to update TypeScript types

## Testing

### After This Fix

1. **Clear old sessions**:
```bash
# Clear browser cookies or use incognito
```

2. **Login again**:
```bash
# Old tokens won't have roleName/defaultPath
# New tokens will have all required data
```

3. **Verify**:
- Check terminal for middleware logs
- Should NOT see Prisma errors
- Should see successful redirects

### Expected Terminal Output

```
[Middleware] Redirecting to defaultPath: /admin for role: ADMINISTRADOR
[Middleware] Admin accessing: /admin
✓ Compiled /admin in 850ms
```

## Related Files

**Modified**:
- `src/middleware.ts` - Removed Prisma, added JWT-based checks
- `src/app/api/auth/[...nextauth]/route.ts` - Added roleName to token
- `src/types/auth/next-auth.ts` - Updated type definitions

**Still Using Database**:
- `src/lib/auth/auth.ts` - API route authorization
- `src/lib/authz/authz.ts` - Fine-grained permissions

## Summary

**Problem**: Middleware can't use Prisma (Edge Runtime limitation)

**Solution**: Store role data in JWT, check permissions without database

**Result**: Fast, simple, follows Next.js best practices

The system now uses:
- **JWT-based route protection** (middleware) - Fast, Edge-compatible
- **Database-based permissions** (API routes) - Flexible, real-time

Best of both worlds! 🎉
