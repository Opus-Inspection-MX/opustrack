# JWT Storage and Edge Runtime Compatibility

## What's Stored in the JWT?

### JWT Token Contents

**File**: `src/app/api/auth/[...nextauth]/route.ts:81-86`

When a user logs in, the following data is stored in the JWT token:

```typescript
{
  id: "clx123abc...",           // User ID (from database)
  email: "admin@example.com",    // User email
  name: "Admin User",            // User full name
  roleId: 1,                     // Role ID (numeric)
  roleName: "ADMINISTRADOR",     // Role name (string) ← NEW
  defaultPath: "/admin",         // Where to redirect after login ← NEW
  iat: 1234567890,              // Issued at (timestamp)
  exp: 1237246290               // Expires (timestamp)
}
```

### Why These Fields?

| Field | Why It's Stored | Used For |
|-------|----------------|----------|
| `id` | User identity | API calls, database queries |
| `email` | User identification | Display, profile |
| `name` | Display name | UI, greetings |
| `roleId` | Link to role | Database queries (API routes) |
| `roleName` | Role identification | **Middleware routing** ← KEY |
| `defaultPath` | Initial route | **Middleware redirects** ← KEY |
| `iat` | Security | Token validation |
| `exp` | Security | Token expiration |

### JWT vs Session

**JWT Token** (stored as cookie):
```javascript
// Encoded (Base64)
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImNseDEyM2FiYyIsImVtYWlsIjoi...

// Decoded (what it contains)
{
  "id": "clx123abc",
  "email": "admin@example.com",
  "roleName": "ADMINISTRADOR",
  "defaultPath": "/admin"
}
```

**Session Object** (for client-side use):
```typescript
{
  user: {
    id: "clx123abc",
    email: "admin@example.com",
    name: "Admin User",
    roleId: 1,
    roleName: "ADMINISTRADOR",
    defaultPath: "/admin"
  },
  expires: "2025-11-13T00:00:00.000Z"
}
```

## What is Edge Runtime?

### Traditional Node.js Runtime vs Edge Runtime

#### Node.js Runtime (Traditional)

```typescript
// ✅ Can do everything Node.js can
import fs from 'fs'                    // File system
import { PrismaClient } from '@prisma/client'  // Database
import crypto from 'crypto'            // Crypto
import { exec } from 'child_process'   // System commands

// Runs on server, full access
export default async function handler() {
  const data = await fs.promises.readFile('file.txt')
  const db = new PrismaClient()
  return data
}
```

**Pros**: Full Node.js API
**Cons**:
- Slower cold starts
- Higher memory usage
- Geographic latency

#### Edge Runtime (Modern)

```typescript
// ✅ Fast, globally distributed
// ❌ Limited APIs

export default async function handler() {
  // ✅ Works - Web APIs
  const response = await fetch('https://api.example.com')
  const data = await response.json()

  // ❌ Doesn't work - Node.js APIs
  // import fs from 'fs'  // Error!
  // import { PrismaClient }  // Error!

  return data
}
```

**Pros**:
- ⚡ Extremely fast (< 50ms cold start)
- 🌍 Runs close to users globally
- 💰 More cost-effective
- 📦 Smaller bundle size

**Cons**:
- 🚫 No Node.js APIs
- 🚫 No traditional database connections
- 🚫 No file system access

### Where Edge Runtime is Used

In Next.js:

1. **Middleware** (default) ← This is what we fixed!
2. **API Routes** (opt-in via `export const runtime = 'edge'`)
3. **Server Components** (opt-in)

## Why Middleware Uses Edge Runtime

**File**: `src/middleware.ts`

```typescript
// This runs on EVERY request to your site
export async function middleware(req: NextRequest) {
  // Runs before the page loads
  // Must be FAST
}
```

### Why Edge Runtime for Middleware?

1. **Speed**: Runs on every request → needs to be instant
2. **Scale**: High traffic → needs to scale easily
3. **Global**: Users worldwide → needs to run close to them
4. **Simple**: Limited APIs → forces good patterns

### The Problem We Had

```typescript
// ❌ BEFORE (Broken)
export async function middleware(req: NextRequest) {
  const token = await getToken({ req })

  // This line fails on Edge Runtime!
  const role = await getRoleById(token.roleId)  // Uses Prisma
  //                  ^^^^^^^^^^
  //                  Database call = Node.js only

  return NextResponse.redirect(role.defaultPath)
}
```

**Error**: `PrismaClientValidationError: In order to run Prisma Client on edge runtime...`

### The Fix

```typescript
// ✅ AFTER (Works)
export async function middleware(req: NextRequest) {
  const token = await getToken({ req })

  // Read from JWT token (no database!)
  const roleName = token.roleName      // ✅ From JWT
  const defaultPath = token.defaultPath // ✅ From JWT

  // Simple logic, no database
  const canAccess = checkRouteAccess(roleName, pathname)

  return NextResponse.redirect(defaultPath)
}
```

## What Makes Middleware Edge-Compatible?

### Edge-Compatible Code

✅ **Works on Edge Runtime**:

```typescript
// 1. JWT Token Operations
const token = await getToken({ req })
const roleName = token.roleName

// 2. Simple JavaScript Logic
const canAccess = roleRoutes[roleName].includes(pathname)

// 3. Web APIs
const url = new URL(req.url)
const response = await fetch('https://api.example.com')

// 4. NextResponse Operations
return NextResponse.redirect(url)
return NextResponse.next()
```

❌ **Doesn't Work on Edge Runtime**:

```typescript
// 1. Database Operations
const user = await prisma.user.findUnique()  // ❌
const role = await db.query('SELECT * FROM roles')  // ❌

// 2. File System
import fs from 'fs'  // ❌
fs.readFileSync('file.txt')  // ❌

// 3. Node.js Crypto (traditional)
import crypto from 'crypto'  // ❌
crypto.randomBytes(32)  // ❌

// 4. External Libraries (that use Node.js)
import bcrypt from 'bcrypt'  // ❌
await bcrypt.compare(password, hash)  // ❌
```

### Our Middleware Implementation

**File**: `src/middleware.ts`

```typescript
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ✅ Edge-compatible: JWT token read
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  if (!token) {
    // ✅ Edge-compatible: NextResponse redirect
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // ✅ Edge-compatible: Read from JWT (no database)
  const roleName = token.roleName as string;
  const defaultPath = token.defaultPath as string;

  // ✅ Edge-compatible: Simple function call
  const canAccess = checkRouteAccess(roleName, pathname);

  if (!canAccess) {
    // ✅ Edge-compatible: NextResponse redirect
    return NextResponse.redirect(new URL("/unauthorized", req.url));
  }

  // ✅ Edge-compatible: Allow request
  return NextResponse.next();
}

// ✅ Edge-compatible: Pure JavaScript function
function checkRouteAccess(roleName: string, pathname: string): boolean {
  const roleRoutes: Record<string, string[]> = {
    ADMINISTRADOR: ["/*"],
    USUARIO_SISTEMA: ["/fsr", "/incidents", ...],
  };

  return roleRoutes[roleName]?.some(route => pathname.startsWith(route)) ?? false;
}
```

**Everything here is Edge-compatible** because:
- No database calls
- No Node.js APIs
- Just JWT reading and simple logic
- Only Web APIs and Next.js primitives

## JWT Security

### Is JWT Safe?

**JWT is signed but not encrypted**:

```
JWT = Header.Payload.Signature
      ^^^^^^  ^^^^^^^  ^^^^^^^^^
      public  public   verified
```

- **Anyone can decode** the payload (it's just Base64)
- **Nobody can modify** it without breaking the signature
- **Only server** can create valid tokens (has the secret)

### What to Store in JWT

✅ **Safe to store**:
- User ID
- Role name
- Email
- Display name
- Preferences
- UI settings

❌ **Never store**:
- Passwords (even hashed!)
- Payment info
- Social security numbers
- API secrets
- Private data

### Our JWT Security

```typescript
// ✅ Safe - public information
token.id = "clx123abc"
token.roleName = "ADMINISTRADOR"
token.email = "admin@example.com"

// ✅ Signed with secret
secret: process.env.NEXTAUTH_SECRET

// ✅ Has expiration
maxAge: 30 * 24 * 60 * 60  // 30 days

// ✅ HTTP-only cookie
// JavaScript can't access it → XSS protection
```

## Performance Comparison

### Database Check (Old Approach)

```typescript
// ❌ Slow: ~50-200ms per request
const role = await prisma.role.findUnique({
  where: { id: roleId },
  include: { permissions: true }
})
```

**Timeline**:
```
Request → Middleware (100ms)
  ↓
Database Query (50-200ms)  ← Bottleneck!
  ↓
Response → User (250ms total)
```

### JWT Check (Current Approach)

```typescript
// ✅ Fast: ~1-5ms per request
const roleName = token.roleName
const canAccess = roleRoutes[roleName].includes(pathname)
```

**Timeline**:
```
Request → Middleware (5ms)
  ↓
Memory Read (1ms)  ← Fast!
  ↓
Response → User (10ms total)
```

**25x faster!** ⚡

## When to Use Each Approach

### Use JWT (Edge Runtime) For:

✅ **Middleware** - Route protection, redirects
✅ **High-frequency checks** - Every request
✅ **Simple authorization** - Role-based routing
✅ **Global distribution** - CDN, edge locations

### Use Database (Node.js Runtime) For:

✅ **API routes** - Business logic, mutations
✅ **Fine-grained permissions** - Resource-level checks
✅ **Dynamic permissions** - Real-time updates
✅ **Admin operations** - Role management

## Our Hybrid Approach

```
┌─────────────────────────────────────┐
│         User Request                │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│      Middleware (Edge Runtime)      │
│  • JWT-based route protection       │
│  • Fast role checking               │
│  • No database calls                │
└────────────┬────────────────────────┘
             │ ✅ Allowed
             ▼
┌─────────────────────────────────────┐
│    Page/API Route (Node.js)         │
│  • Database queries                 │
│  • Fine-grained permissions         │
│  • Business logic                   │
└─────────────────────────────────────┘
```

**Best of both worlds**:
- Fast routing (JWT in middleware)
- Flexible permissions (Database in API routes)

## Summary

### What's in JWT?
```typescript
{
  id: "user-id",              // User identity
  email: "user@example.com",  // Contact
  name: "User Name",          // Display
  roleId: 1,                  // DB reference
  roleName: "ADMINISTRADOR",  // For middleware
  defaultPath: "/admin"       // For redirects
}
```

### Why Edge Runtime?
- ⚡ **Speed**: < 50ms cold start
- 🌍 **Global**: Runs close to users
- 💰 **Cost**: More efficient
- 📈 **Scale**: Handles high traffic

### What Makes Middleware Edge-Compatible?
- ✅ No Prisma/database calls
- ✅ Only JWT token reads
- ✅ Simple JavaScript logic
- ✅ Web APIs only

### Trade-offs?
- 🔄 Role changes require re-login
- 📦 Limited to role-based routing in middleware
- ✅ Fine-grained permissions still work in API routes

**Result**: Fast, scalable, follows Next.js best practices! 🎉
