"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { type FormEvent, useState } from "react";
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
import { logger } from "@/lib/observability/logger";

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
        setError(
          "Credenciales inválidas. Por favor, verifica tu correo y contraseña.",
        );
        setLoading(false);
      } else if (result?.ok) {
        // Success! Use window.location for a full page reload
        // This ensures the middleware gets the updated session
        window.location.href = callbackUrl;
      }
    } catch (error) {
      logger.error("Login error:", error);
      setError("Algo salió mal. Por favor, inténtalo de nuevo.");
      setLoading(false);
    }
  }

  return (
    <Card className="w-full min-w-0 gap-4 py-4 sm:gap-6 sm:py-6 [@media(max-height:700px)]:gap-2 [@media(max-height:700px)]:py-2">
      <CardHeader className="space-y-1 [@media(max-height:700px)]:px-4">
        <CardTitle className="text-2xl text-center">Iniciar Sesión</CardTitle>
        <CardDescription className="text-center [@media(max-height:700px)]:hidden">
          Ingresa tu correo electrónico y contraseña para acceder
        </CardDescription>
      </CardHeader>
      <CardContent className="[@media(max-height:700px)]:px-4">
        <form
          onSubmit={onSubmit}
          className="grid gap-4 [@media(max-height:500px)]:grid-cols-2 [@media(max-height:700px)]:gap-2"
        >
          {error && (
            <div
              role="alert"
              className="col-span-full rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-600 [@media(max-height:500px)]:p-1"
            >
              {error}
            </div>
          )}
          <div className="min-w-0 space-y-2">
            <Label htmlFor="email">Correo electrónico</Label>
            <Input
              id="email"
              className="h-11 text-base"
              type="email"
              placeholder="admin@opusinspection.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              disabled={loading}
            />
          </div>
          <div className="min-w-0 space-y-2">
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              className="h-11 text-base"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              disabled={loading}
            />
          </div>
          <Button
            type="submit"
            disabled={loading}
            className="col-span-full h-11 w-full [@media(max-height:500px)]:col-span-1"
          >
            {loading ? "Iniciando Sesión..." : "Iniciar Sesión"}
          </Button>

          <Link
            href="/forgot-password"
            className="col-span-full flex min-h-11 items-center justify-center text-center text-sm text-primary underline underline-offset-4 [@media(max-height:500px)]:col-span-1"
          >
            ¿Olvidaste tu contraseña?
          </Link>

          {/* Development hint */}
          {process.env.NODE_ENV === "development" && (
            <details className="col-span-full rounded-md border border-blue-200 bg-blue-50 px-3 text-xs text-blue-800">
              <summary className="min-h-11 cursor-pointer content-center font-semibold">
                Credenciales de prueba:
              </summary>
              <div className="pb-3">
                <p>Admin: admin@opusinspection.com</p>
                <p>FSR: fsr@opusinspection.com</p>
                <p>Reportero: reporter@opusinspection.com</p>
                <p>Guest: guest@opusinspection.com</p>
              </div>
            </details>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
