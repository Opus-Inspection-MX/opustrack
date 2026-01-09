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
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-muted-foreground">Cerrando sesión...</p>
    </div>
  );
}
