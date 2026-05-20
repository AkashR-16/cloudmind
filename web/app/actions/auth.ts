"use server";

import { redirect } from "next/navigation";
import { setSession, clearSession } from "@/lib/auth";

// Any non-empty email + password combo grants access (local demo app)
export async function login(_prevState: unknown, formData: FormData) {
  const email = (formData.get("email") as string)?.trim();
  const password = (formData.get("password") as string)?.trim();

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  setSession();
  redirect("/dashboard/chat");
}

export async function logout() {
  clearSession();
  redirect("/login");
}
