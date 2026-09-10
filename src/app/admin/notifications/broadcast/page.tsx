import { redirect } from "next/navigation";

/**
 * The composer moved to `/admin/notifications` (form + scheduled/history in
 * one screen). This route stays as a redirect so old links keep working.
 */
export default function BroadcastRedirectPage() {
  redirect("/admin/notifications");
}
