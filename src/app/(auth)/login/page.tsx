import { Suspense } from "react";
import LoginForm from "@/components/login/login-form.component";

export default function LoginPage() {
  // La página puede venir con ?callbackUrl=/ruta
  // El form lo leerá desde el client con useSearchParams
  return (
    <Suspense fallback={<div>Cargando...</div>}>
      <LoginForm />
    </Suspense>
  );
}
