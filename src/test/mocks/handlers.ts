import { http, HttpResponse } from "msw";

/**
 * MSW handlers for mocking API requests in tests
 */
export const handlers = [
  // Auth endpoints
  http.post("/api/auth/callback/credentials", () => {
    return HttpResponse.json({
      user: {
        id: "test-user-id",
        email: "test@test.com",
        name: "Test User",
        roleId: "test-role-id",
      },
    });
  }),

  http.post("/api/auth/signout", () => {
    return HttpResponse.json({ success: true });
  }),

  // Example: Mock incidents API
  http.get("/api/incidents", () => {
    return HttpResponse.json([
      {
        id: "1",
        title: "Test Incident",
        description: "Test description",
        status: "OPEN",
        createdAt: new Date().toISOString(),
      },
    ]);
  }),

  http.post("/api/incidents", async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({
      id: "new-incident-id",
      ...body,
      createdAt: new Date().toISOString(),
    });
  }),

  // Example: Mock work orders API
  http.get("/api/work-orders", () => {
    return HttpResponse.json([
      {
        id: "1",
        folio: "WO-001",
        status: "PENDING",
        createdAt: new Date().toISOString(),
      },
    ]);
  }),

  // Example: Mock vehicles API
  http.get("/api/vehicles", () => {
    return HttpResponse.json([
      {
        id: "1",
        make: "Toyota",
        model: "Corolla",
        licensePlate: "ABC-123",
        status: "AVAILABLE",
      },
    ]);
  }),
];
