"use server";

import { redirect } from "next/navigation";
import { signIn as nextAuthSignIn } from "next-auth/react";

export async function signIn(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { error: "Email and password are required" };
  }

  try {
    const result = await nextAuthSignIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      return { error: "Invalid email or password" };
    }

    redirect("/");
  } catch (error) {
    console.error("Sign in error:", error);
    return { error: "An error occurred during sign in" };
  }
}
