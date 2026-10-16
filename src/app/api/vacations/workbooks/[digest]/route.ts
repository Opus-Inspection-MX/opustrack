import { withPermission } from "@/lib/auth/auth";
import { prisma } from "@/lib/database/prisma.singleton";

export const GET = withPermission("vacations:manage", async (request) => {
  const digest = new URL(request.url).pathname.split("/").pop() ?? "";
  if (!/^[a-f0-9]{64}$/.test(digest))
    return new Response(null, { status: 404 });
  const book = await prisma.vacationWorkbook.findUnique({ where: { digest } });
  if (!book) return new Response(null, { status: 404 });
  return new Response(JSON.stringify(book), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="vacaciones-${digest.slice(0, 12)}.json"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
});
