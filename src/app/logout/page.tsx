"use client";

import { useEffect } from "react";
import { signOut } from "next-auth/react";

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
