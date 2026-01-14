# Test Database Setup Guide

## Important: Your Data is Safe

**The test infrastructure uses a COMPLETELY SEPARATE database from your development/production database.**

### Two Databases:

1. **Main Database** (`DATABASE_URL`)
   - Your current database with important data
   - Used when running the application normally (`npm run dev`, `npm run build`, etc.)
   - **NEVER touched by tests**

2. **Test Database** (`TEST_DATABASE_URL`)
   - Completely separate database
   - Only used when running tests (`npm test`, `npm run test:e2e`)
   - Can be destroyed/recreated without affecting your main database

## Setup Instructions

### 1. Create the Test Database

```bash
# Connect to PostgreSQL
psql -U your_username -h localhost

# Create test database
CREATE DATABASE opustrack_test;

# Grant permissions (if needed)
GRANT ALL PRIVILEGES ON DATABASE opustrack_test TO your_username;

# Exit
\q
```

### 2. Configure Environment Variables

Add to your `.env` file:

```bash
# Your main database (existing - DO NOT CHANGE)
DATABASE_URL="postgresql://user:password@localhost:5432/opustrack?schema=public"

# Test database (new - separate database)
TEST_DATABASE_URL="postgresql://user:password@localhost:5432/opustrack_test?schema=public"
```

**Note**: If you don't set `TEST_DATABASE_URL`, it will default to using `opustrack_test` database automatically.

### 3. Run Migrations on Test Database

```bash
# Apply all migrations to the test database
TEST_DATABASE_URL="postgresql://user:password@localhost:5432/opustrack_test" npx prisma migrate deploy
```

Or using your .env variable:

```bash
# The test utilities will automatically use TEST_DATABASE_URL when running tests
npm test
```

### 4. Seed Test Database (Optional)

The test utilities have their own seeding functions that create minimal test data automatically. However, if you want to manually seed the test database with your full seed file:

```bash
# Run seed on test database
TEST_DATABASE_URL="postgresql://user:password@localhost:5432/opustrack_test" npm run db:seed
```

**IMPORTANT**: Only run this if you want the test database to have the same seed data as your main database. Usually, tests create their own minimal data.

## How Tests Use the Database

### Automatic Test Data Management

Tests automatically:
1. Create test data before running
2. Clean up test data after running
3. Never touch your main database

### Test Database Functions

```typescript
import {
  getTestPrismaClient,    // Get Prisma client for test DB
  seedTestDatabase,        // Create minimal test data
  cleanupTestDatabase,     // Remove all test data
  resetTestDatabase,       // Run migrations
  disconnectTestDatabase,  // Close connection
} from "@/test/db";

// In your test file
describe("My Feature", () => {
  beforeEach(async () => {
    // Create fresh test data
    await seedTestDatabase();
  });

  afterEach(async () => {
    // Clean up test data
    await cleanupTestDatabase();
  });

  it("should work correctly", async () => {
    const prisma = getTestPrismaClient();
    // Use prisma for test database queries
  });
});
```

## Verification

### Check Which Database Tests Use

```typescript
// src/test/db.ts shows the test database URL
const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  process.env.DATABASE_URL?.replace(/\/\w+$/, "/opustrack_test");
```

### Verify Databases are Separate

```bash
# Connect to main database
psql -U your_username -d opustrack

# List tables and data
\dt
SELECT * FROM "User";

# Exit and connect to test database
\q
psql -U your_username -d opustrack_test

# List tables and data (should be different or empty)
\dt
SELECT * FROM "User";
```

## Running Tests Safely

```bash
# Run unit tests (uses test database)
npm test

# Run with coverage (uses test database)
npm run test:coverage

# Run E2E tests (uses test database)
npm run test:e2e

# Your main database is NEVER touched
```

## Troubleshooting

### Issue: Tests failing with database errors

**Solution**: Make sure test database exists and has migrations applied:

```bash
# Create database
psql -U your_username -c "CREATE DATABASE opustrack_test;"

# Run migrations
TEST_DATABASE_URL="postgresql://user:password@localhost:5432/opustrack_test" npx prisma migrate deploy
```

### Issue: Test database has stale data

**Solution**: Reset the test database:

```bash
# Drop and recreate
psql -U your_username -c "DROP DATABASE IF EXISTS opustrack_test;"
psql -U your_username -c "CREATE DATABASE opustrack_test;"

# Run migrations
TEST_DATABASE_URL="postgresql://user:password@localhost:5432/opustrack_test" npx prisma migrate deploy
```

### Issue: Accidentally ran tests on main database

**Solution**: Tests are designed to use `TEST_DATABASE_URL`. Check your `.env` file:

```bash
# Make sure this exists
TEST_DATABASE_URL="postgresql://user:password@localhost:5432/opustrack_test"
```

If tests somehow affected your main database (very unlikely), restore from backup or re-seed:

```bash
# Reset main database (WARNING: destroys data)
npm run db:reset

# Seed main database
npm run db:seed
```

## Best Practices

1. **Never set `TEST_DATABASE_URL` to your main database**
2. **Always use separate credentials for test database** (optional but recommended)
3. **Don't worry about test database data** - it's disposable
4. **Reset test database regularly** to ensure clean state
5. **Never commit `.env` file** - it contains real credentials

## CI/CD Configuration

In your CI/CD pipeline (GitHub Actions, GitLab CI, etc.), set up a separate test database:

```yaml
# Example GitHub Actions
env:
  DATABASE_URL: postgresql://postgres:postgres@localhost:5432/opustrack
  TEST_DATABASE_URL: postgresql://postgres:postgres@localhost:5432/opustrack_test

services:
  postgres:
    image: postgres:15
    env:
      POSTGRES_PASSWORD: postgres
    options: >-
      --health-cmd pg_isready
      --health-interval 10s
      --health-timeout 5s
      --health-retries 5

steps:
  - name: Create test database
    run: psql -U postgres -h localhost -c "CREATE DATABASE opustrack_test;"

  - name: Run migrations
    run: npx prisma migrate deploy
    env:
      DATABASE_URL: ${{ env.TEST_DATABASE_URL }}

  - name: Run tests
    run: npm test
```

## Summary

- ✅ **Your main database is safe** - Tests use a separate database
- ✅ **Test database is disposable** - Can be destroyed/recreated anytime
- ✅ **Automatic test data management** - Tests create and clean up their own data
- ✅ **No manual intervention needed** - Just run `npm test`

**Your important data in the main database is NEVER touched by tests.**
