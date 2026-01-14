# Testing Infrastructure

This directory contains the testing setup and utilities for OpusTrack.

## Stack

- **Vitest**: Unit and integration testing framework
- **React Testing Library**: Component testing utilities
- **Playwright**: End-to-end testing
- **MSW (Mock Service Worker)**: API mocking for tests

## Directory Structure

```
src/test/
├── README.md           # This file
├── setup.ts            # Global test setup (mocks, cleanup)
├── db.ts              # Test database utilities
├── helpers.tsx        # Testing helper functions and utilities
└── mocks/
    ├── handlers.ts    # MSW API route handlers
    └── server.ts      # MSW server setup for Node
```

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage

# Run E2E tests
npm run test:e2e

# Run E2E tests with UI
npm run test:e2e:ui

# Debug E2E tests
npm run test:e2e:debug
```

## Writing Tests

### Unit Tests

Place unit tests next to the files they test with `.test.ts` or `.test.tsx` extension:

```typescript
// src/lib/utils/myFunction.test.ts
import { describe, it, expect } from "vitest";
import { myFunction } from "./myFunction";

describe("myFunction", () => {
  it("should do something", () => {
    expect(myFunction()).toBe("expected result");
  });
});
```

### Component Tests

```typescript
// src/components/MyComponent.test.tsx
import { describe, it, expect } from "vitest";
import { renderWithProviders, screen } from "@/test/helpers";
import { MyComponent } from "./MyComponent";

describe("MyComponent", () => {
  it("renders correctly", () => {
    renderWithProviders(<MyComponent />);
    expect(screen.getByText("Hello")).toBeInTheDocument();
  });
});
```

### Integration Tests with Database

```typescript
// src/lib/actions/myAction.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  getTestPrismaClient,
  seedTestDatabase,
  cleanupTestDatabase,
} from "@/test/db";
import { myAction } from "./myAction";

describe("myAction", () => {
  beforeEach(async () => {
    await seedTestDatabase();
  });

  afterEach(async () => {
    await cleanupTestDatabase();
  });

  it("should perform action correctly", async () => {
    const result = await myAction();
    expect(result).toBeDefined();
  });
});
```

### E2E Tests

Place E2E tests in the `e2e/` directory:

```typescript
// e2e/auth.spec.ts
import { test, expect } from "@playwright/test";

test("user can log in", async ({ page }) => {
  await page.goto("/login");
  await page.fill('input[name="email"]', "test@test.com");
  await page.fill('input[name="password"]', "password123");
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL("/fsr");
});
```

## Test Utilities

### Mock Sessions

```typescript
import { createAdminSession, createFSRSession } from "@/test/helpers";

// Mock an admin session
const adminSession = createAdminSession();

// Mock an FSR session
const fsrSession = createFSRSession();
```

### Mock API Requests

```typescript
import { server } from "@/test/mocks/server";
import { http, HttpResponse } from "msw";

// Override a handler for a specific test
test("handles API error", async () => {
  server.use(
    http.get("/api/incidents", () => {
      return HttpResponse.json({ error: "Failed" }, { status: 500 });
    })
  );

  // Test code that calls the API
});
```

### Database Utilities

```typescript
import {
  getTestPrismaClient,
  seedTestDatabase,
  cleanupTestDatabase,
  resetTestDatabase,
  disconnectTestDatabase,
} from "@/test/db";

// Get Prisma client for tests
const prisma = getTestPrismaClient();

// Seed test database with minimal data
await seedTestDatabase();

// Clean up all test data
await cleanupTestDatabase();

// Reset database (run migrations)
await resetTestDatabase();

// Disconnect (usually in afterAll)
await disconnectTestDatabase();
```

## Test Database Setup

Tests use a separate test database to avoid interfering with development data.

1. Set `TEST_DATABASE_URL` in `.env` (or it will default to `opustrack_test`)
2. Run migrations on test database:

```bash
TEST_DATABASE_URL="postgresql://user:pass@localhost:5432/opustrack_test" npx prisma migrate deploy
```

## Coverage Targets

- **Lines**: 75% minimum
- **Functions**: 75% minimum
- **Branches**: 75% minimum
- **Statements**: 75% minimum

Run `npm run test:coverage` to generate a coverage report.

## Best Practices

1. **Arrange-Act-Assert**: Structure tests clearly
2. **One assertion per test**: Keep tests focused
3. **Descriptive test names**: Use "should" or "it" format
4. **Clean up after tests**: Use `afterEach` to reset state
5. **Mock external dependencies**: Use MSW for API calls
6. **Test behavior, not implementation**: Focus on user interactions
7. **Avoid testing private methods**: Test the public API

## Debugging Tests

### Vitest

```bash
# Run a specific test file
npm test -- path/to/test.test.ts

# Run tests matching a pattern
npm test -- --grep "specific test name"

# Run tests in UI mode for debugging
npm run test:ui
```

### Playwright

```bash
# Debug a specific test
npm run test:e2e:debug -- auth.spec.ts

# Run tests with headed browser
npm run test:e2e -- --headed

# Generate test code
npx playwright codegen http://localhost:3000
```

## CI/CD Integration

Tests are configured to run in CI with appropriate settings (see `playwright.config.ts` and `vitest.config.ts`).

CI environment variables:
- `CI=true`: Enables CI-specific settings
- `TEST_DATABASE_URL`: PostgreSQL connection for test database

## Next Steps

Following the testing plan, implement tests in this order:

1. **Critical Path** (40h): Authentication, authorization, work orders
2. **Integration** (20h): Incident-to-work-order flow, soft deletes
3. **High Priority** (30h): Server actions, form validation, file uploads
4. **UI Components** (25h): Component rendering, user interactions
5. **E2E Workflows** (20h): Complete user journeys

See the testing plan document for detailed test cases and examples.
