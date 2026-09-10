import { notFound, redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { canAccessRoute } from "@/lib/auth/auth";
import { resolveNotificationDestination } from "@/lib/notifications/go-links";

/**
 * Neutral notification links: `/notifications/go/[entity]/[id]`.
 *
 * Stored notification links cannot name a role-specific page (the REPORTER
 * mailed an `/admin/...` link bounced off the route guard), so every
 * incident/vacation notification points here and the destination is resolved
 * against the CURRENT user's route grants: incident → the admin detail, the
 * reporter detail, or the FSR list; vacation → `/admin/vacations` or
 * `/vacations`. Unknown entities and denied users get a 404 — never a leak,
 * never a bounce to a page they cannot open.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ entity: string; id: string }> },
) {
  const { entity, id } = await params;
  const destination = await resolveNotificationDestination(
    entity,
    id,
    (path) => canAccessRoute(path),
  );
  if (!destination) notFound();
  redirect(destination);
}
