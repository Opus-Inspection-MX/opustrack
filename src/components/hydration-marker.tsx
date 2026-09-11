"use client";

import { useEffect } from "react";

/**
 * Marca la hidratación para la suite e2e.
 *
 * El HTML del servidor ya trae los botones, pero sin sus handlers hasta que
 * React hidrata; un clic en esa ventana no hace nada. El helper `gotoReady`
 * (`e2e/fixtures/navigation.ts`) espera esta marca antes de interactuar.
 * No renderiza nada ni afecta al usuario.
 */
export function HydrationMarker() {
  useEffect(() => {
    document.documentElement.dataset.hydrated = "true";
  }, []);

  return null;
}
