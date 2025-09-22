"use client";
import LoginForm from "@/components/login/login-form";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useUserStore } from "@/stores/user-store";

export default function LoginPage() {
  const router = useRouter();
  const hydrated = useUserStore((s) => s.hydrated);
  const user = useUserStore((s) => s.user);
  const redirected = useRef(false);
  useEffect(() => {
    if (!hydrated || redirected.current) return;
    if (user) {
      redirected.current = true;
      router.replace("/"); // or /app/dashboard
    }
  }, [hydrated, user, router]);

  if (!hydrated) return null;
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-gray-50">
      <div className="w-full max-w-md">
        <LoginForm />
      </div>
    </main>
  );
}
