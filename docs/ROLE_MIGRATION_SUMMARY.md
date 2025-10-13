# Role Migration Summary - October 2025

## Overview

This document summarizes the role restructuring changes made to OpusTrack on October 13, 2025.

## Changes Summary

### Role Name Changes

| Old Role Name | New Role Name | Reason |
|--------------|---------------|---------|
| `USUARIO_SISTEMA` | `FSR` | More descriptive - Field Service Representative |
| `USUARIO_PERSONAL` | `CLIENT` | Better reflects actual usage - raises incidents |
| `USUARIO_EXTERNO` | `GUEST` | Clearer - read-only external access |
| `ADMINISTRADOR` | `ADMINISTRADOR` | No change - already clear |

### Permission Structure Changes

#### CLIENT Role (formerly USUARIO_EXTERNO)
**Changed Behavior**: Now raises incidents from VIC

**Before**:
- Could only read incidents
- Limited external access
- Default path: `/client`

**After**:
- ✅ Can **create incidents** (new capability)
- ✅ Assigned to VIC
- ✅ Default path: `/client`
- Purpose: Raise incidents from VIC

**Permissions**:
```
route:client
incidents:read
incidents:create  ← NEW
work-orders:read
schedules:read
```

#### GUEST Role (formerly USUARIO_PERSONAL)
**Changed Behavior**: Now read-only access

**Before**:
- Could create and update incidents
- Could update work orders
- Assigned to VIC
- Default path: `/guest`

**After**:
- ❌ **Cannot create** incidents (removed capability)
- ❌ Cannot update anything
- ❌ Not assigned to VIC
- ✅ Read-only access to all resources
- Default path: `/guest`

**Permissions**:
```
route:guest
incidents:read     ← Read-only
work-orders:read   ← Read-only
parts:read
schedules:read
```

#### ADMINISTRADOR Role
**Changed Behavior**: No longer related to VIC

**Before**:
- Could be assigned to a VIC
- Full system access

**After**:
- ✅ **Not related to any VIC** (vicId = null)
- ✅ Still has full system access
- ✅ Manages all VICs globally
- Default path: `/admin`

#### FSR Role (formerly USUARIO_SISTEMA)
**No Functional Changes** - Just renamed for clarity

**Before**: USUARIO_SISTEMA
**After**: FSR (Field Service Representative)

**Permissions**: No changes, still has full management capabilities

### VIC Association Changes

| Role | Before | After |
|------|--------|-------|
| ADMINISTRADOR | Could be assigned to VIC | **Not related to VIC** |
| FSR | Assigned to VIC | Assigned to VIC ✓ |
| CLIENT | Not assigned | **Assigned to VIC** ✓ |
| GUEST | Assigned to VIC | **Not assigned** |

## Files Modified

### 1. Database Seed (`prisma/seed.ts`)
**Changes**:
- Updated role names: FSR, CLIENT, GUEST
- Updated role descriptions
- Modified permission assignments for each role
- Changed vicId associations:
  - Admin: `vicId: null` (was vic.id)
  - FSR: `vicId: vic.id` (unchanged)
  - Client: `vicId: vic.id` (was null)
  - Guest: `vicId: null` (was vic.id)
- Updated test user emails:
  - `fsr@opusinspection.com` (was system@)
  - `client@opusinspection.com` (unchanged)
  - `guest@opusinspection.com` (was staff@)

### 2. Middleware (`src/middleware.ts`)
**Changes**:
- Updated `checkRouteAccess()` function with new role names:
  ```typescript
  const roleRoutes: Record<string, string[]> = {
    ADMINISTRADOR: ["/*"],
    FSR: ["/fsr", "/incidents", "/work-orders", ...],      // was USUARIO_SISTEMA
    CLIENT: ["/client", "/incidents", "/work-orders", ...], // was USUARIO_EXTERNO
    GUEST: ["/guest", "/incidents", "/work-orders", ...],   // was USUARIO_PERSONAL
  };
  ```

### 3. Documentation Files
**Created**:
- `docs/ROLE_STRUCTURE.md` - Complete role structure guide
- `docs/ROLE_MIGRATION_SUMMARY.md` - This file

**Updated**:
- `CLAUDE.md` - Updated role names and structure
- `README.md` - Updated test credentials
- `docs/README.md` - Updated test credentials and added link to ROLE_STRUCTURE.md

## Test Users After Migration

```
✅ Admin:  admin@opusinspection.com / password123  (Not related to VIC)
✅ FSR:    fsr@opusinspection.com / password123     (Field Service Representative)
✅ Client: client@opusinspection.com / password123  (Raises incidents from VIC)
✅ Guest:  guest@opusinspection.com / password123   (Read-only access)
```

**Note**: Email addresses have changed:
- `system@` → `fsr@`
- `staff@` → `guest@`

## Migration Steps Performed

1. ✅ Updated role definitions in seed file
2. ✅ Updated permission assignments for each role
3. ✅ Changed vicId associations for users
4. ✅ Updated middleware route access rules
5. ✅ Updated all documentation
6. ✅ Reset database with `npm run db:reset --force`
7. ✅ Seeded database with new role structure

## Impact Analysis

### Breaking Changes
⚠️ **User Accounts**: Old test user emails no longer work
- Old: `system@opusinspection.com` → New: `fsr@opusinspection.com`
- Old: `staff@opusinspection.com` → New: `guest@opusinspection.com`

⚠️ **Role Names in Code**: Any hardcoded references to old role names will break
- Need to update: `USUARIO_SISTEMA` → `FSR`
- Need to update: `USUARIO_PERSONAL` → `CLIENT`
- Need to update: `USUARIO_EXTERNO` → `GUEST`

⚠️ **Permissions**:
- GUEST users lose create/update capabilities
- CLIENT users gain incident creation capability

### Non-Breaking Changes
✅ **JWT Tokens**: Existing sessions will work (role names stored in JWT)
- However, users will need to log out and log back in for new role names to take effect

✅ **Middleware**: Edge-compatible, no changes to JWT structure

✅ **Database Schema**: No schema changes, only data changes

## Testing Checklist

After migration, verify:

- [ ] All test users can log in with new credentials
- [ ] Admin can access all routes
- [ ] FSR can create/update incidents and work orders
- [ ] CLIENT can create incidents (new capability)
- [ ] GUEST cannot create anything (read-only)
- [ ] Role-based redirects work correctly
- [ ] Middleware allows/denies routes correctly

## Rollback Procedure

If rollback is needed:

1. Revert seed file changes:
   ```bash
   git checkout HEAD~1 prisma/seed.ts
   ```

2. Revert middleware changes:
   ```bash
   git checkout HEAD~1 src/middleware.ts
   ```

3. Reset database:
   ```bash
   npm run db:reset -- --force
   npm run db:seed
   ```

4. Revert documentation:
   ```bash
   git checkout HEAD~1 docs/ CLAUDE.md README.md
   ```

## Next Steps

1. **Update Existing Code**: Search for any hardcoded role name references
2. **Update API Routes**: Ensure VIC isolation is implemented in API routes
3. **Update UI**: Update any UI that displays role names
4. **Test Thoroughly**: Test all user workflows with new role structure
5. **User Communication**: Inform users of new credentials if in production

## Related Documentation

- [ROLE_STRUCTURE.md](./ROLE_STRUCTURE.md) - Complete role structure guide
- [CLAUDE.md](../CLAUDE.md) - Architecture and development guide
- [EDGE_RUNTIME_FIX.md](./EDGE_RUNTIME_FIX.md) - Edge Runtime and JWT
- [docs/README.md](./README.md) - Documentation index

## Questions or Issues?

If you encounter any issues with the new role structure:

1. Check [ROLE_STRUCTURE.md](./ROLE_STRUCTURE.md) for role details
2. Verify test credentials are correct
3. Clear browser cookies and log in again
4. Check middleware logs for route access issues
5. Verify database was properly seeded

---

**Migration Date**: October 13, 2025
**Database Reset**: ✅ Completed
**Status**: ✅ Successfully applied
