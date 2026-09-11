"use client";

import { TriangleAlert } from "lucide-react";
import { useEffect } from "react";
import { EmptyState } from "@/components/common/empty-state";
import { logger } from "@/lib/observability/logger";

/**
 * The global error boundary.
 *
 * Anything a Server Action throws loses its message in production, so this
 * never tries to explain WHAT failed — only that something did, with a way
 * back. Business rules keep returning `rejected(...)` instead of throwing.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.error("Unhandled route error:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <EmptyState
        icon={TriangleAlert}
        title="Algo salió mal"
        description="Ocurrió un error inesperado al cargar esta página. Si persiste, contacta a tu administrador."
        action={{ label: "Intentar de nuevo", onClick: reset }}
      />
    </div>
  );
}
