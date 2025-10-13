# Troubleshooting Login Issues

This guide helps debug and fix common login and redirect problems.

## Issue: Login Doesn't Redirect After Success

### Symptoms
- Login form accepts credentials (shows loading state)
- No error message appears
- User stays on `/login` page
- Dashboard not accessible

### Root Cause
The issue was that after successful login, the client-side router (`router.push()`) was trying to navigate before the session cookie was fully set and available to the middleware.

### Solution Implemented

**Fixed in**: `src/components/login/login-form.component.tsx:46`

Changed from:
```typescript
// ❌ Old way - doesn't work reliably
router.push(callbackUrl);
router.refresh();
```

To:
```typescript
// ✅ New way - full page reload
window.location.href = callbackUrl;
```

### Why This Works

1. **Full Page Reload**: `window.location.href` triggers a complete page reload
2. **Cookie Available**: Ensures the session cookie is set before middleware runs
3. **Middleware Runs**: Fresh request with session → middleware can read token → redirects work

## Debug Steps

If login still doesn't work, follow these steps:

### 1. Check Browser Console

Open browser DevTools (F12) and look for:
- JavaScript errors
- Network requests to `/api/auth/callback/credentials`
- Response status codes

**Expected**: 200 OK response from callback

### 2. Check Terminal Logs

Look for middleware logs in your terminal:

```bash
[Middleware] Redirecting to defaultPath: /admin for role: ADMINISTRADOR
[Middleware] Access granted for role ADMINISTRADOR to /admin
```

**If you see**:
- `No roleId in token` → Database or NextAuth issue
- `Role not found for roleId` → Database seeding issue
- `Access denied` → Permission issue

### 3. Verify Database

Check that user exists and has correct role:

```bash
npm run db:studio
```

Then verify:
- User exists in `User` table
- User has a `roleId`
- Role exists in `Role` table
- Role has a `defaultPath`

### 4. Check Environment Variables

Verify `.env` file:

```env
DATABASE_URL="postgresql://..."
NEXTAUTH_SECRET="your-secret-here"
NEXTAUTH_URL="http://localhost:3000"
```

**Test**:
```bash
# Should print your variables
echo $DATABASE_URL
echo $NEXTAUTH_SECRET
```

### 5. Clear Browser Data

Sometimes stale cookies cause issues:

1. Open DevTools → Application → Cookies
2. Delete all cookies for `localhost:3000`
3. Try login again

Or use incognito/private mode.

### 6. Restart Dev Server

```bash
# Stop server (Ctrl+C)
# Clear Next.js cache
rm -rf .next

# Start again
npm run dev
```

## Common Issues

### Issue: "No roleId in token"

**Cause**: NextAuth callback not setting roleId

**Check**: `src/app/api/auth/[...nextauth]/route.ts:31-40`

```typescript
async jwt({ token, user }) {
  if (user) {
    token.roleId = user.roleId;  // ← Must be set
    // ...
  }
  return token;
}
```

**Fix**: Ensure user object has `roleId` from database query

### Issue: "Role not found for roleId"

**Cause**: Database doesn't have the role

**Fix**: Re-seed database
```bash
npm run db:reset
npm run db:seed
```

### Issue: "Access denied to /admin"

**Cause**: User's role doesn't have permission for the route

**Fix**: Check permissions in database
```sql
SELECT r.name, p.name as permission
FROM "Role" r
JOIN "RolePermission" rp ON r.id = rp."roleId"
JOIN "Permission" p ON p.id = rp."permissionId"
WHERE r.id = 1;  -- Replace with your roleId
```

Should include `route:admin` permission for admin routes.

### Issue: Redirect Loop

**Symptoms**: Page keeps redirecting between `/login` and `/`

**Cause**: Middleware can't read session properly

**Fix**:
1. Check `NEXTAUTH_SECRET` matches between NextAuth config and middleware
2. Verify cookies are being set (DevTools → Application → Cookies)
3. Check middleware matcher config excludes `/api/auth`

### Issue: "Middleware error" in Console

**Cause**: Database connection issue or permission lookup failed

**Fix**:
1. Check `DATABASE_URL` is correct
2. Verify database is running: `psql $DATABASE_URL`
3. Check middleware error details in terminal
4. Ensure Prisma client is generated: `npx prisma generate`

## Testing Login

### Test Each Role

Use these credentials to test each role:

```bash
# Admin (should redirect to /admin)
admin@opusinspection.com / password123

# System User (should redirect to /fsr)
system@opusinspection.com / password123

# Staff (should redirect to /guest)
staff@opusinspection.com / password123

# Client (should redirect to /client)
client@opusinspection.com / password123
```

### Expected Behavior

1. Enter credentials → Click "Iniciar Sesión"
2. Button shows "Iniciando Sesión..."
3. Page reloads (brief flash)
4. User lands on their role's dashboard

### Test Callback URL

1. While logged out, go to `/admin`
2. Should redirect to `/login?callbackUrl=/admin`
3. Log in as admin
4. Should redirect back to `/admin`

## Debugging Code

### Add More Logging

**In login form**:
```typescript
} else if (result?.ok) {
  console.log("Login successful, redirecting to:", callbackUrl);
  window.location.href = callbackUrl;
}
```

**In middleware**:
```typescript
console.log("[Middleware] Token:", token);
console.log("[Middleware] Role:", role);
console.log("[Middleware] Pathname:", pathname);
```

### Check Session on Client

In any client component:
```typescript
"use client"
import { useSession } from "next-auth/react"

export default function DebugSession() {
  const { data: session, status } = useSession()

  return (
    <pre>{JSON.stringify({ session, status }, null, 2)}</pre>
  )
}
```

### Check Session on Server

In any page or API route:
```typescript
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"

export default async function Page() {
  const session = await getServerSession(authOptions)
  return <pre>{JSON.stringify(session, null, 2)}</pre>
}
```

## Quick Fixes Checklist

- [ ] Clear browser cookies
- [ ] Restart dev server with `rm -rf .next && npm run dev`
- [ ] Re-seed database with `npm run db:reset && npm run db:seed`
- [ ] Check `.env` has all required variables
- [ ] Verify database is running
- [ ] Check terminal logs for middleware errors
- [ ] Try incognito/private mode
- [ ] Check Network tab for failed requests
- [ ] Verify `NEXTAUTH_SECRET` is set and matches

## Still Having Issues?

1. Check all files are saved
2. Ensure no TypeScript errors: `npm run build`
3. Check Prisma client is generated: `npx prisma generate`
4. Review middleware logs carefully
5. Check database with Prisma Studio: `npm run db:studio`

## Related Files

- `src/components/login/login-form.component.tsx` - Login form
- `src/middleware.ts` - Route protection and redirects
- `src/app/api/auth/[...nextauth]/route.ts` - NextAuth configuration
- `src/lib/auth/auth.ts` - Authentication helpers
- `src/lib/authz/authz.ts` - Authorization logic

## Changes Made to Fix

### Before (Broken)
```typescript
// Client-side navigation - session not available yet
if (result?.ok) {
  router.push(callbackUrl);
  router.refresh();
}
```

### After (Fixed)
```typescript
// Full page reload - session cookie available
if (result?.ok) {
  window.location.href = callbackUrl;
}
```

This ensures the session is properly set before the middleware checks it.
