import type { Metadata } from "next";
import PasswordRecoveryForm from "@/components/login/password-recovery-form";

export const metadata: Metadata = {
  title: "Recuperar contraseña | OpusTrack",
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return <PasswordRecoveryForm mode="request" />;
}
