"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useRef, useState } from "react";
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
import {
  requestPasswordRecovery,
  resetRecoveredPassword,
} from "@/lib/actions/password-recovery";

export default function PasswordRecoveryForm({
  mode,
}: {
  mode: "request" | "reset";
}) {
  const reset = mode === "reset";
  const [token, setToken] = useState("");
  const [ready, setReady] = useState(!reset);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [complete, setComplete] = useState(false);
  const captureVersion = useRef(0);

  useEffect(() => {
    if (!reset) return;
    function captureFragment() {
      // Also capture mail links opened in this same document, not only on mount.
      const fragment = window.location.hash;
      if (fragment) {
        const raw = fragment.slice(1);
        captureVersion.current += 1;
        setToken(/^[a-f0-9]{64}$/.test(raw) ? raw : "");
        setPassword("");
        setConfirmation("");
        setError("");
        setComplete(false);
        setLoading(false);
        window.history.replaceState(null, "", window.location.pathname);
      }
      setReady(true);
    }
    captureFragment();
    window.addEventListener("hashchange", captureFragment);
    return () => window.removeEventListener("hashchange", captureFragment);
  }, [reset]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setError("");
    const submittedCapture = captureVersion.current;
    try {
      const result = reset
        ? await resetRecoveredPassword(token, password, confirmation)
        : await requestPasswordRecovery(email);
      // An earlier submission must not overwrite a newly opened link's form.
      if (submittedCapture !== captureVersion.current) return;
      if (!result.success) {
        setError(result.error);
      } else {
        setComplete(true);
        setPassword("");
        setConfirmation("");
        if (reset) setToken("");
      }
    } catch {
      if (submittedCapture === captureVersion.current) {
        setError("No pudimos procesar la solicitud. Inténtalo de nuevo.");
      }
    } finally {
      if (submittedCapture === captureVersion.current) setLoading(false);
    }
  }

  const missingToken = reset && ready && !token && !complete;
  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-muted/50">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>
            {reset ? "Restablecer contraseña" : "Recuperar contraseña"}
          </CardTitle>
          <CardDescription>
            {reset
              ? "Ingresa y confirma tu nueva contraseña."
              : "Ingresa el correo electrónico de tu cuenta para recibir un enlace de recuperación."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {complete ? (
            <output className="block text-sm">
              {reset
                ? "Contraseña restablecida. Inicia sesión con tu nueva contraseña."
                : "Si tu cuenta está habilitada, recibirás un enlace que vence en 30 minutos. Revisa también tu carpeta de correo no deseado. Si no llega, puedes solicitar otro después de un minuto."}
            </output>
          ) : missingToken ? (
            <p role="alert" className="text-sm text-destructive">
              El enlace no es válido. Solicita uno nuevo.
            </p>
          ) : ready ? (
            <form onSubmit={submit} className="space-y-4">
              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
              {reset ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="new-password">Nueva contraseña</Label>
                    <Input
                      id="new-password"
                      type="password"
                      autoComplete="new-password"
                      minLength={8}
                      maxLength={72}
                      required
                      disabled={loading}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">
                      Confirmar contraseña
                    </Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      autoComplete="new-password"
                      minLength={8}
                      maxLength={72}
                      required
                      disabled={loading}
                      value={confirmation}
                      onChange={(event) => setConfirmation(event.target.value)}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Mínimo 8 caracteres; máximo 72 bytes.
                  </p>
                </>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="recovery-email">Correo electrónico</Label>
                  <Input
                    id="recovery-email"
                    type="email"
                    autoComplete="email"
                    maxLength={254}
                    required
                    disabled={loading}
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </div>
              )}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading
                  ? "Procesando..."
                  : reset
                    ? "Restablecer contraseña"
                    : "Enviar enlace"}
              </Button>
            </form>
          ) : (
            <output>Cargando...</output>
          )}
          {reset && !complete && (
            <Link
              href="/forgot-password"
              className="block text-sm underline underline-offset-4"
            >
              Solicitar un nuevo enlace
            </Link>
          )}
          <Link
            href="/login"
            className="block text-sm underline underline-offset-4"
          >
            Volver a iniciar sesión
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
