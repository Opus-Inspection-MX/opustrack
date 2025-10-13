"use client";

import { type FormEvent, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signIn } from "next-auth/react";

export default function LoginForm() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [error, setError] = useState<string>("");

  const searchParams = useSearchParams();

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const callbackUrl = searchParams.get("callbackUrl") || "/";

      const result = await signIn("credentials", {
        redirect: false,
        email,
        password,
        callbackUrl,
      });

      if (result?.error) {
        setError("Credenciales inválidas. Por favor, verifica tu correo y contraseña.");
        setLoading(false);
      } else if (result?.ok) {
        // Success! Use window.location for a full page reload
        // This ensures the middleware gets the updated session
        window.location.href = callbackUrl;
      }
    } catch (error) {
      console.error("Login error:", error);
      setError("Algo salió mal. Por favor, inténtalo de nuevo.");
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-muted/50">
      <Card className="w-full max-w-sm">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl text-center">Iniciar Sesión</CardTitle>
          <CardDescription className="text-center">
            Ingresa tu correo electrónico y contraseña para acceder
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            {error && (
              <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Correo electrónico</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@opusinspection.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                disabled={loading}
              />
            </div>
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Iniciando Sesión..." : "Iniciar Sesión"}
            </Button>

            {/* Development hint */}
            {process.env.NODE_ENV === "development" && (
              <div className="mt-4 p-3 text-xs bg-blue-50 border border-blue-200 rounded-md text-blue-800">
                <p className="font-semibold mb-1">Credenciales de prueba:</p>
                <p>Admin: admin@opusinspection.com</p>
                <p>Sistema: system@opusinspection.com</p>
                <p>Personal: staff@opusinspection.com</p>
                <p>Cliente: client@opusinspection.com</p>
                <p className="mt-1">Contraseña: password123</p>
              </div>
            )}
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
