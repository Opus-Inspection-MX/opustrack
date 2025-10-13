# Role Structure and Changes

## Current Role Structure

OpusTrack now uses a simplified, clear role structure that better represents the actual user types in the system.

### Roles Overview

| Role | Name | Description | Default Path | VIC Association |
|------|------|-------------|--------------|-----------------|
| **ADMINISTRADOR** | Admin | Full system access, manages all aspects | `/admin` | Not related to VIC |
| **FSR** | Field Service Representative | System user with management capabilities | `/fsr` | Assigned to VIC |
| **CLIENT** | Client | Raises incidents from VIC, has create permissions | `/client` | Assigned to VIC |
| **GUEST** | Guest | Read-only access, no create permissions | `/guest` | Not assigned to VIC |

## Role Details

### ADMINISTRADOR (Admin)

**Purpose**: System administrator with unrestricted access

**Characteristics**:
- ✅ Full system access (all permissions)
- ✅ Can manage users, roles, permissions
- ✅ Can manage all VICs
- ✅ **Not related to any specific VIC**
- ✅ Access to admin dashboard

**Permissions**: All permissions in the system

**Use Cases**:
- System configuration
- User management
- VIC management
- Global reports and analytics

### FSR (Field Service Representative)

**Purpose**: System user who manages incidents, work orders, and operations within a VIC

**Characteristics**:
- ✅ Management capabilities for incidents and work orders
- ✅ Can create, update, and delete resources
- ✅ **Assigned to a specific VIC**
- ✅ Access to FSR dashboard
- ✅ Can view reports and export data

**Permissions**:
- `route:fsr` - Access to FSR dashboard
- `incidents:*` - Full incident management (read, create, update, delete, assign, close)
- `work-orders:*` - Full work order management
- `parts:read`, `parts:create`, `parts:update` - Inventory management
- `schedules:read`, `schedules:create`, `schedules:update` - Schedule management
- `users:read` - View users
- `reports:view`, `reports:export` - Reports access

**Use Cases**:
- Daily incident management
- Work order assignment and tracking
- Inventory management
- Schedule coordination

### CLIENT

**Purpose**: Client user who raises incidents from a VIC

**Characteristics**:
- ✅ Can create incidents
- ✅ **Assigned to a specific VIC**
- ✅ Access to client dashboard
- ✅ Can view their incidents and work orders
- ❌ Cannot delete or close incidents

**Permissions**:
- `route:client` - Access to client dashboard
- `incidents:read`, `incidents:create` - View and create incidents
- `work-orders:read` - View work orders
- `schedules:read` - View schedules

**Use Cases**:
- Report equipment issues
- Track incident status
- View work order progress

### GUEST

**Purpose**: Guest user with read-only access

**Characteristics**:
- ✅ Read-only access to most resources
- ❌ **Cannot create incidents or any other resources**
- ❌ Not assigned to a VIC
- ✅ Access to guest dashboard

**Permissions**:
- `route:guest` - Access to guest dashboard
- `incidents:read` - View incidents
- `work-orders:read` - View work orders
- `parts:read` - View parts inventory
- `schedules:read` - View schedules

**Use Cases**:
- View system information
- Monitor incident status
- Check schedules

## Migration from Old Role Names

### Previous Role Structure

The system previously used Spanish role names that were not immediately clear:

| Old Name | New Name | Reason for Change |
|----------|----------|-------------------|
| `USUARIO_SISTEMA` | `FSR` | More descriptive, clearer purpose |
| `USUARIO_PERSONAL` | `CLIENT` | Better reflects user type (raises incidents) |
| `USUARIO_EXTERNO` | `GUEST` | Clearer indication of limited access |
| `ADMINISTRADOR` | `ADMINISTRADOR` | Unchanged, already clear |

### Permission Changes

**CLIENT** (formerly USUARIO_EXTERNO):
- Now **CAN** create incidents (previously limited)
- Still assigned to a VIC
- Purpose: Raise incidents from VIC

**GUEST** (formerly USUARIO_PERSONAL):
- Now **CANNOT** create incidents (read-only)
- Not assigned to a VIC
- Purpose: View-only access

### VIC Association Changes

**ADMINISTRADOR**:
- Previously: Could be assigned to a VIC
- Now: **Not related to any VIC** (manages all VICs globally)

## Test Users

After running `npm run db:seed`, these test users are available:

```
Admin:  admin@opusinspection.com / password123  (Not related to VIC)
FSR:    fsr@opusinspection.com / password123     (Field Service Representative)
Client: client@opusinspection.com / password123  (Raises incidents from VIC)
Guest:  guest@opusinspection.com / password123   (Read-only access)
```

## Route Access Rules

These route access rules are defined in `src/middleware.ts`:

```typescript
const roleRoutes: Record<string, string[]> = {
  ADMINISTRADOR: ["/*"],                           // Admin can access everything
  FSR: ["/fsr", "/incidents", "/work-orders", "/parts", "/schedules", "/reports"],
  CLIENT: ["/client", "/incidents", "/work-orders", "/schedules"],
  GUEST: ["/guest", "/incidents", "/work-orders", "/parts", "/schedules"],
};
```

## Permission Comparison

### Create Permissions Comparison

| Resource | ADMIN | FSR | CLIENT | GUEST |
|----------|-------|-----|--------|-------|
| Incidents | ✅ | ✅ | ✅ | ❌ |
| Work Orders | ✅ | ✅ | ❌ | ❌ |
| Parts | ✅ | ✅ | ❌ | ❌ |
| Schedules | ✅ | ✅ | ❌ | ❌ |
| Users | ✅ | ❌ | ❌ | ❌ |
| Roles | ✅ | ❌ | ❌ | ❌ |

### Read Permissions Comparison

| Resource | ADMIN | FSR | CLIENT | GUEST |
|----------|-------|-----|--------|-------|
| Incidents | ✅ | ✅ | ✅ | ✅ |
| Work Orders | ✅ | ✅ | ✅ | ✅ |
| Parts | ✅ | ✅ | ❌ | ✅ |
| Schedules | ✅ | ✅ | ✅ | ✅ |
| Reports | ✅ | ✅ | ❌ | ❌ |
| Users | ✅ | ✅ | ❌ | ❌ |

## Implementation Files

The role structure is implemented across these files:

1. **Database Seed** (`prisma/seed.ts`):
   - Defines roles and their permissions
   - Creates test users with appropriate roles

2. **Middleware** (`src/middleware.ts`):
   - Route access control based on role names
   - JWT-based authorization (Edge Runtime compatible)

3. **Authorization** (`src/lib/authz/authz.ts`):
   - Database-driven permission checks
   - Role and permission loading

4. **Authentication** (`src/lib/auth/auth.ts`):
   - Helper functions for pages and API routes
   - Permission verification

5. **NextAuth Config** (`src/app/api/auth/[...nextauth]/route.ts`):
   - JWT token includes role name and default path
   - Session includes user role information

## Best Practices

### When to Use Each Role

**Use ADMINISTRADOR when**:
- Managing system-wide configuration
- Creating/managing VICs
- Managing users across all VICs
- Accessing global reports

**Use FSR when**:
- Managing daily operations at a VIC
- Handling incidents and work orders
- Managing inventory
- Coordinating schedules

**Use CLIENT when**:
- Reporting issues from a VIC
- Tracking incident resolution
- Viewing work order progress

**Use GUEST when**:
- Providing read-only access to system
- Monitoring without modification
- External auditors or observers

### Adding New Roles

To add a new role:

1. Update `prisma/seed.ts` with new role definition
2. Add permissions to new role
3. Update `src/middleware.ts` with route access rules
4. Re-seed database: `npm run db:reset && npm run db:seed`

## Security Considerations

1. **Admin Power**: ADMINISTRADOR has full access - assign carefully
2. **VIC Isolation**: FSR and CLIENT should only access their own VIC data (implement in API routes)
3. **Permission Granularity**: Use resource-action permissions in API routes for fine-grained control
4. **Route Protection**: Middleware provides route-level protection, but API routes should verify permissions

## Related Documentation

- [CLAUDE.md](../CLAUDE.md) - Architecture and development guide
- [EDGE_RUNTIME_FIX.md](./EDGE_RUNTIME_FIX.md) - Edge Runtime and JWT authorization
- [JWT_AND_EDGE_RUNTIME.md](./JWT_AND_EDGE_RUNTIME.md) - JWT token contents and Edge Runtime
- [docs/README.md](./README.md) - Documentation index
