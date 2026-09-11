"use client";

import { signOut } from "next-auth/react";
import { useEffect } from "react";

export default function LogoutPage() {
  useEffect(() => {
    // Llama a signOut cuando se carga la página
    signOut({
      callbackUrl: "/login", // adónde mandar después de cerrar sesión
    });
  }, []);

  return (
    <p className="text-center text-muted-foreground">Cerrando sesión...</p>
  );
}
