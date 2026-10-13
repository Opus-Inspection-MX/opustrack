import type { Metadata } from "next";
import PasswordRecoveryForm from "@/components/login/password-recovery-form";

export const metadata: Metadata = {
  title: "Restablecer contraseña | OpusTrack",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function ResetPasswordPage() {
  return <PasswordRecoveryForm mode="reset" />;
}
