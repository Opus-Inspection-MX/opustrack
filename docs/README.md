# OpusTrack Documentation

Welcome to the OpusTrack documentation. This folder contains comprehensive guides for developers working with the system.

## Quick Links

- [CLAUDE.md](../CLAUDE.md) - Architecture and development guide for Claude Code
- [README.md](../README.md) - Project overview and setup instructions

## Documentation Files

### Architecture & Setup

- **[CLAUDE.md](../CLAUDE.md)** - Complete architecture documentation
  - Project overview
  - Development commands
  - Database-driven RBAC system
  - Authentication & authorization flow
  - Common development patterns
  - Testing credentials

### Migration & Updates

- **[MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md)** - Database migration guide
  - Step-by-step migration instructions
  - Troubleshooting common issues
  - Rollback procedures
  - Verification checklist

- **[REFACTOR_SUMMARY.md](./REFACTOR_SUMMARY.md)** - Complete refactor summary
  - What was accomplished
  - Schema updates
  - New features
  - How to get user's accessible routes
  - Testing the system

### Feature Guides

- **[ROLE_STRUCTURE.md](./ROLE_STRUCTURE.md)** - Role structure and permissions
  - Current role overview (ADMINISTRADOR, FSR, CLIENT, GUEST)
  - Role details and permissions
  - Migration from old role names
  - Permission comparison tables
  - Best practices for role usage

- **[LOGIN_LOGOUT_GUIDE.md](./LOGIN_LOGOUT_GUIDE.md)** - Login & logout implementation
  - Login flow and redirects
  - Logout implementation
  - Role-based redirects
  - Security considerations
  - Testing scenarios

- **[TROUBLESHOOTING_LOGIN.md](./TROUBLESHOOTING_LOGIN.md)** - Login troubleshooting
  - Fix login redirect issues
  - Debug steps
  - Common issues and solutions
  - Testing procedures

- **[EDGE_RUNTIME_FIX.md](./EDGE_RUNTIME_FIX.md)** - Edge Runtime compatibility fix
  - Prisma error solution
  - JWT-based authorization
  - Why and how we fixed it

- **[JWT_AND_EDGE_RUNTIME.md](./JWT_AND_EDGE_RUNTIME.md)** - JWT and Edge Runtime explained
  - What's stored in JWT tokens
  - Edge Runtime vs Node.js Runtime
  - Security and performance
  - Best practices

## Quick Start

### First Time Setup

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your database credentials
```

3. Run database migrations:
```bash
npm run db:migrate
npm run db:seed
```

4. Start development server:
```bash
npm run dev
```

### Test Credentials

After seeding, use these credentials:
- **Admin**: admin@opusinspection.com / password123 (Not related to VIC)
- **FSR**: fsr@opusinspection.com / password123 (Field Service Representative)
- **Client**: client@opusinspection.com / password123 (Raises incidents from VIC)
- **Guest**: guest@opusinspection.com / password123 (Read-only access)

## Key Features

### Database-Driven RBAC

All permissions and roles are stored in the database:
- No hardcoded permissions
- Dynamic role management
- Route-based permissions
- Resource-action permissions
- 5-minute caching for performance

### Authentication & Authorization

- NextAuth with JWT strategy
- Middleware-based route protection
- Role-based redirects after login
- Admin superuser pattern
- Granular permission checks

### Helper Functions

```typescript
// Get accessible routes
const routes = await getMyAccessibleRoutes();

// Check permission
const canCreate = await canPerform("incidents:create");

// Require authentication
const user = await requireAuth();

// Protect API routes
export const POST = withPermission("incidents:create", async (req, user) => {
  // Handler
});
```

## Development Workflow

### Adding New Permissions

1. Update seed file with new permission
2. Re-seed database: `npm run db:seed`
3. Use in code: `await requirePermission("new:permission")`

### Creating Protected Pages

```typescript
import { requireRouteAccess } from "@/lib/auth/auth";

export default async function MyPage() {
  const user = await requireRouteAccess("/my-page");
  return <div>Protected content</div>;
}
```

### Protecting API Routes

```typescript
import { withPermission } from "@/lib/auth/auth";

export const POST = withPermission("resource:action", async (req, user) => {
  // user is authenticated and authorized
});
```

## Common Commands

```bash
# Development
npm run dev              # Start dev server with Turbopack
npm run build            # Build for production
npm run start            # Start production server

# Code Quality
npm run lint             # Check with Biome
npm run format           # Format with Biome

# Database
npm run db:migrate       # Run migrations
npm run db:studio        # Open Prisma Studio
npm run db:reset         # Reset database
npm run db:seed          # Seed database
```

## Architecture Overview

### Tech Stack

- **Framework**: Next.js 15 (App Router, Turbopack)
- **Auth**: NextAuth v4 with JWT
- **Database**: PostgreSQL with Prisma ORM
- **Styling**: Tailwind CSS 4 + shadcn/ui
- **Linting**: Biome

### Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── api/               # API routes
│   ├── admin/             # Admin dashboard
│   ├── fsr/               # System user dashboard
│   ├── client/            # Client dashboard
│   └── guest/             # Staff dashboard
├── components/            # React components
│   ├── ui/               # shadcn/ui components
│   ├── auth/             # Auth components
│   └── layout/           # Layout components
├── lib/                   # Utility libraries
│   ├── auth/             # Authentication helpers
│   ├── authz/            # Authorization logic
│   └── database/         # Prisma client
├── middleware.ts          # Route protection
└── types/                 # TypeScript types

prisma/
├── schema.prisma          # Database schema
└── seed.ts               # Seed script

docs/                      # Documentation
```

### Key Concepts

1. **Database-Driven Permissions**: All access control in database
2. **Middleware Protection**: Every request checked for auth
3. **Role-Based Routing**: Users redirected based on role
4. **Admin Superuser**: Admin has unrestricted access
5. **Permission Caching**: 5-minute cache for performance

## Troubleshooting

### Common Issues

**Login redirects to wrong page**
- Check user's role `defaultPath` in database
- Verify middleware is running
- Check browser console for errors

**Permission denied errors**
- Verify role has required permission
- Check permission name matches exactly
- Clear permissions cache: `clearPermissionsCache()`

**Database connection errors**
- Verify `DATABASE_URL` in `.env`
- Check PostgreSQL is running
- Run `npm run db:migrate`

### Debug Tips

```typescript
// Debug user permissions
const user = await getAuthenticatedUser();
console.log(user?.role.permissions);

// Debug accessible routes
const routes = await getMyAccessibleRoutes();
console.log(routes);

// Check if admin
const isAdmin = await isCurrentUserAdmin();
console.log(isAdmin);
```

## Contributing

When adding new features:

1. Update documentation in this folder
2. Add examples to `examples/` directory
3. Update CLAUDE.md if architecture changes
4. Test with all user roles
5. Update seed file if adding permissions

## Support

For issues or questions:
1. Check the relevant documentation file
2. Review the examples in `examples/` directory
3. Check the codebase with Claude Code
4. Review middleware and auth helper functions

## License

[Your License Here]
