"use client";

import AuthGate from "@/components/common/auth-guard";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // set validate={false} if you only want to check presence of user/token
  return <AuthGate validate>{children}</AuthGate>;
}
