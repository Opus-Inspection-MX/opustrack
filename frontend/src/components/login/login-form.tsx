"use client";

import type React from "react";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import axios from "@/lib/axios";
import { roleRedirect } from "@/config/roles/role_redirect";
import { useUserStore } from "@/stores/user-store";
import { User } from "@/shared/types";
import { set } from "zod";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const setUser = useUserStore((state) => state.setUser);
  const setToken = useUserStore((state) => state.setToken);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email || !password) {
      setError("El correo electrónico y la contraseña son obligatorios.");
      return;
    }

    setIsLoading(true);

    try {
      const response = await axios.post("/auth/login", { email, password });
      const accessToken = response.data.accessToken; // Assuming the role is returned in the response

      setToken(accessToken);
      const responseUser = await axios.get("/auth/me", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const user: User = {
        id: responseUser.data.id,
        name: responseUser.data.name,
        email: responseUser.data.email,
        roleId: responseUser.data.roleId,
        active: responseUser.data.active,
      };
      setUser(user);
      router.push("/");
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const status = err.response?.status;
        const msg = err.response?.data?.message || err.message;

        if (status === 400 || status === 401) {
          setError(msg);
        } else {
          console.error("Error de red:", msg);
          setError("Oops! Algo salió mal.");
        }
      } else {
        console.error("Error inesperado:", err);
        setError("Error desconocido");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold text-center">
          Iniciar sesión
        </CardTitle>
        <CardDescription className="text-center">
          Ingresa tu correo electrónico y contraseña para iniciar sesión
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Correo electrónico</Label>
            <Input
              id="email"
              placeholder="Ingresa tu correo electrónico"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              required
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Contraseña</Label>
              {/* <a href="#" className="text-sm text-primary hover:underline">
                Forgot password?
              </a> */}
            </div>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Signing in..." : "Sign in"}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="flex justify-center">
        <p className="text-sm text-muted-foreground">
          ¿No tienes cuenta?{" "}
          <a href="#" className="text-primary hover:underline">
            Contacta al administrador
          </a>
        </p>
      </CardFooter>
    </Card>
  );
}
