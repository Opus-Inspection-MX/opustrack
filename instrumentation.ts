import { logger } from "./src/lib/observability/logger";

/**
 * Sole framework→log bridge (RF-557).
 *
 * Next.js invokes this when a Server Component, Server Action, or route
 * handler throws. Only minimal routing context travels with the error —
 * never headers (cookies, authorization) — and the logger redacts the rest.
 */
export async function onRequestError(
  error: unknown,
  request: { path: string; method: string },
  context: { routerKind: string; routePath: string; routeType: string },
): Promise<void> {
  logger.error("next.on_request_error", {
    path: request.path,
    method: request.method,
    routerKind: context.routerKind,
    routePath: context.routePath,
    routeType: context.routeType,
    error,
  });
}
