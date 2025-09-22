"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useUserStore } from "@/stores/user-store";
import { getRequiredRole, canAccess } from "@/config/roles/roles_access";
import { roleRedirect } from "@/config/roles/role_redirect";
import axios from "@/lib/axios";

type Props = { children: React.ReactNode; validate?: boolean };

export default function AuthGate({ children, validate = true }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const hydrated = useUserStore((s) => s.hydrated);
  const user = useUserStore((s) => s.user);
  const token = useUserStore((s) => s.token);
  const clear = useUserStore((s) => s.clear);
  const redirected = useRef(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!hydrated || redirected.current) return;

    (async () => {
      // 1) must be logged in
      if (!user || !token) {
        redirected.current = true;
        router.replace("/login");
        return;
      }

      // 2) optional backend validation
      if (validate) {
        try {
          const res = await axios.get("/auth/me");
          if (res.status !== 200) throw new Error("invalid");
        } catch {
          clear();
          redirected.current = true;
          router.replace("/login");
          return;
        }
      }

      // 3) role-based access using only roleRedirect mapping
      const required = getRequiredRole(pathname); // number | null
      if (required !== null && !canAccess(user.roleId, required)) {
        redirected.current = true;
        router.replace(roleRedirect[user.roleId] ?? "/login");
        return;
      }

      setChecking(false);
    })();
  }, [hydrated, user, token, validate, pathname, clear, router]);

  if (!hydrated || checking) {
    return <div className="p-6 text-sm opacity-70">Loading…</div>;
  }

  return <>{children}</>;
}
