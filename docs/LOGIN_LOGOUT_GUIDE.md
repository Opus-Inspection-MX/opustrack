# Login and Logout Implementation Guide

This document explains how login and logout work in OpusTrack.

## Login Flow

### User Experience

1. User navigates to `/login`
2. User enters email and password
3. On successful login:
   - User is redirected to their role's `defaultPath` (from database)
   - OR if they were trying to access a specific page, they're redirected there
4. On failed login:
   - Error message is displayed
   - User can try again

### Technical Implementation

**File**: `src/components/login/login-form.component.tsx`

```typescript
// Login handler
const result = await signIn("credentials", {
  redirect: false,
  email,
  password,
});

if (result?.ok) {
  const callbackUrl = searchParams.get("callbackUrl");

  if (callbackUrl) {
    router.push(callbackUrl); // Redirect to requested page
  } else {
    router.push("/"); // Let middleware handle redirect
  }

  router.refresh();
}
```

### Role-Based Redirects

After login, the middleware (`src/middleware.ts`) handles the redirect:

1. Loads user's role with permissions from database
2. If user tries to access `/` or `/dashboard`:
   - Redirects to user's `defaultPath` from database
3. For other routes:
   - Checks if user has permission
   - Allows access or redirects to `/unauthorized`

**Default Paths by Role** (from database):
- Admin → `/admin`
- System User → `/fsr`
- Staff → `/guest`
- Client → `/client`

### Development Helpers

In development mode, the login page shows test credentials:

```
Admin:  admin@opusinspection.com / password123
System: system@opusinspection.com / password123
Staff:  staff@opusinspection.com / password123
Client: client@opusinspection.com / password123
```

## Logout Flow

### User Experience

1. User clicks "Cerrar Sesión" button in sidebar
2. Button shows "Cerrando sesión..." state
3. User is logged out and redirected to `/login`

### Technical Implementation

**File**: `src/components/auth/logout-button.tsx`

A reusable logout button component that:
- Shows loading state while logging out
- Handles the signOut process
- Redirects to `/login` after logout

```typescript
const handleLogout = async () => {
  setIsLoggingOut(true);
  await signOut({
    callbackUrl: "/login",
    redirect: true,
  });
};
```

### Usage in Sidebars

The logout button is included in all sidebar footers:

```typescript
import { LogoutButton } from "@/components/auth/logout-button"

<SidebarFooter className="border-t p-4">
  <div className="flex flex-col gap-2">
    <ThemeToggle />
    <LogoutButton variant="outline" size="sm" className="w-full bg-transparent" />
  </div>
</SidebarFooter>
```

**Updated Sidebars**:
- ✅ Admin Sidebar (`admin-sidebar.tsx`)
- ✅ FSR Sidebar (`fsr-sidebar.tsx`)
- ✅ Client Sidebar (`client-sidebar.tsx`)
- ✅ Guest Sidebar (`invitado-sidebar.tsx`)

### LogoutButton Props

The button accepts several customization props:

```typescript
interface LogoutButtonProps {
  variant?: "default" | "outline" | "ghost" | "link" | "destructive" | "secondary";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  showIcon?: boolean;
  children?: React.ReactNode;
}
```

Example custom usage:
```typescript
<LogoutButton
  variant="destructive"
  size="lg"
  showIcon={false}
>
  Log Out
</LogoutButton>
```

## Security Considerations

### Protected Routes

All routes except public ones are protected by middleware:

**Public Routes**:
- `/login`
- `/signup`
- `/api/auth/*`
- `/_next/*` (Next.js internals)
- `/favicon.ico`
- `/images/*`

**Protected Routes**:
- Everything else requires authentication
- Route access is checked against database permissions
- Admin users have access to all routes

### Session Management

- Sessions are stored as JWT tokens
- Token includes: `id`, `email`, `name`, `roleId`, `defaultPath`
- Tokens expire after 30 days
- On logout, token is invalidated

### Middleware Authorization

The middleware checks on every request:

1. Is user authenticated?
2. Does user have permission to access this route?
3. Should user be redirected to their defaultPath?

See `src/middleware.ts` for details.

## Common Scenarios

### User Tries to Access Protected Page While Logged Out

1. User navigates to `/admin`
2. Middleware detects no authentication
3. User redirected to `/login?callbackUrl=/admin`
4. After login, user is redirected back to `/admin`

### User With Wrong Role Tries to Access Restricted Page

1. Staff user tries to access `/admin`
2. Middleware checks user's permissions
3. User doesn't have `route:admin` permission
4. User redirected to `/unauthorized`

### Admin User Access

Admin users (role: `ADMINISTRADOR`) have special privileges:
- Bypass all route checks
- Have access to all routes
- No permission checks needed

## Testing

### Test Login Flow

1. Start dev server: `npm run dev`
2. Navigate to `http://localhost:3000`
3. Should redirect to `/login`
4. Try logging in with each test user
5. Verify correct redirect for each role

### Test Logout Flow

1. Log in as any user
2. Click "Cerrar Sesión" in sidebar
3. Should redirect to `/login`
4. Try accessing protected page
5. Should redirect back to `/login`

### Test Callback URL

1. While logged out, try to access `/admin/users`
2. Should redirect to `/login?callbackUrl=/admin/users`
3. Log in as admin
4. Should redirect to `/admin/users`

## Troubleshooting

### Login Doesn't Redirect

**Check**:
1. Is middleware running? (`src/middleware.ts`)
2. Does user's role have a `defaultPath`?
3. Check browser console for errors

**Fix**:
- Verify database has role with `defaultPath`
- Check middleware logs
- Clear browser cache and cookies

### Logout Button Doesn't Work

**Check**:
1. Is NextAuth configured correctly?
2. Are there JavaScript errors?
3. Is the button rendered correctly?

**Fix**:
- Check browser console
- Verify `NEXTAUTH_SECRET` is set in `.env`
- Try hard refresh (Ctrl+F5)

### Wrong Redirect After Login

**Check**:
1. User's role and defaultPath in database
2. Middleware logic for redirects
3. CallbackUrl parameter

**Fix**:
- Query database: `SELECT * FROM "Role" WHERE id = ?`
- Verify middleware is loading role correctly
- Check URL parameters

## Files Modified

### Created
- `src/components/auth/logout-button.tsx` - Reusable logout button

### Updated
- `src/components/login/login-form.component.tsx` - Enhanced login with proper redirects
- `src/components/layout/admin-sidebar.tsx` - Added logout button
- `src/components/layout/fsr-sidebar.tsx` - Added logout button
- `src/components/layout/client-sidebar.tsx` - Added logout button
- `src/components/layout/invitado-sidebar.tsx` - Added logout button

### Related
- `src/middleware.ts` - Handles route protection and redirects
- `src/app/api/auth/[...nextauth]/route.ts` - NextAuth configuration
- `src/app/login/page.tsx` - Login page
- `src/app/logout/page.tsx` - Logout page (redirects to signOut)

## Best Practices

1. **Always use the LogoutButton component** - Don't create custom logout links
2. **Let middleware handle redirects** - Don't hardcode defaultPaths
3. **Test with all roles** - Verify login/logout works for each user type
4. **Check database permissions** - Ensure roles have correct defaultPath
5. **Monitor middleware logs** - Helps debug redirect issues

## Next Steps

Consider implementing:
- Remember me functionality
- Password reset flow
- Two-factor authentication
- Session timeout warnings
- Concurrent session management
