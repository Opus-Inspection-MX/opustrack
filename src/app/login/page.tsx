import { Suspense } from "react";
import LoginForm from "@/components/login/login-form.component";

export default function LoginPage() {
  // La página puede venir con ?callbackUrl=/ruta
  // El form lo leerá desde el client con useSearchParams
  return (
    <main className="min-h-screen grid place-items-center p-6">
      <div className="w-full max-w-sm">
        <Suspense fallback={<div>Loading...</div>}>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
