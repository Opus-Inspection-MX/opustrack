"use client";

import { useEffect, useRef, useState } from "react";

interface LifecycleDiagramProps {
  definition: string;
}

export function LifecycleDiagram({ definition }: LifecycleDiagramProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: "default",
          securityLevel: "strict",
          flowchart: {
            curve: "basis",
            padding: 20,
          },
        });
        const id = `lifecycle-${Math.random().toString(36).slice(2, 9)}`;
        const { svg } = await mermaid.render(id, definition);
        if (cancelled) return;
        if (containerRef.current) {
          containerRef.current.innerHTML = svg;
        }
        setError(null);
      } catch (e) {
        if (cancelled) return;
        setError(
          e instanceof Error ? e.message : "Error al renderizar el diagrama",
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [definition]);

  if (error) {
    return (
      <div className="rounded border border-destructive/50 bg-destructive/5 p-4 text-sm text-destructive">
        Error al renderizar el diagrama: {error}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="mermaid w-full overflow-auto [&_svg]:max-w-none"
    />
  );
}
