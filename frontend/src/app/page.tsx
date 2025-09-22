"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useUserStore } from "@/stores/user-store";
import { roleRedirect } from "@/config/roles/role_redirect";
function Index() {
  const router = useRouter();
  const hydrated = useUserStore((s) => s.hydrated);
  const user = useUserStore((s) => s.user);
  const redirected = useRef(false);

  useEffect(() => {
    if (!hydrated || redirected.current) return;

    if (user) {
      redirected.current = true;

      const role = user.roleId;
      const redirectPath = roleRedirect[role] || "/error";
      router.replace(redirectPath);
    } else {
      redirected.current = true;
      router.replace("/login");
    }
  }, [hydrated, user, router]);

  // While waiting for Zustand hydration, avoid flicker
  if (!hydrated) {
    return <div className="p-6 text-sm opacity-70">Loading…</div>;
  }

  return null; // nothing to show, always redirect
}

export default Index;
