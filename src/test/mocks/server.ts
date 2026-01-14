import { setupServer } from "msw/node";
import { beforeAll, afterEach, afterAll } from "vitest";
import { handlers } from "./handlers";

/**
 * MSW server for Node.js environment (Vitest)
 */
export const server = setupServer(...handlers);

// Start server before all tests
beforeAll(() => server.listen({ onUnhandledRequest: "warn" }));

// Reset handlers after each test
afterEach(() => server.resetHandlers());

// Clean up after all tests
afterAll(() => server.close());
