"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUserStore } from "@/stores/user-store";
// import axios from "@/lib/axios"; // your axios instance (optional)

export default function LogoutPage() {
  const router = useRouter();
  const clear = useUserStore((s) => s.clear);

  useEffect(() => {
    async function runLogout() {
      try {
        // Optional: tell backend to clear session/cookie
        // await axios.post("/auth/logout");
      } catch (err) {
        // Ignore network errors on logout
      } finally {
        // Always clear local state
        clear();
        // Redirect to login page
        router.replace("/login");
      }
    }

    runLogout();
  }, [clear, router]);

  return <div className="p-6 text-sm opacity-70">Cerrando sesión...</div>;
}
