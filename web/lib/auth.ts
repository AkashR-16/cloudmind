import { cookies } from "next/headers";
import { NextRequest } from "next/server";

const SESSION_COOKIE = "cm_session";
const SESSION_VALUE = "authenticated";

export function setSession() {
  cookies().set(SESSION_COOKIE, SESSION_VALUE, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
}

export function clearSession() {
  cookies().delete(SESSION_COOKIE);
}

export function getSession(): boolean {
  return cookies().get(SESSION_COOKIE)?.value === SESSION_VALUE;
}

export function isAuthenticated(req: NextRequest): boolean {
  return req.cookies.get(SESSION_COOKIE)?.value === SESSION_VALUE;
}
