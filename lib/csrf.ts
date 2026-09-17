import { NextRequest, NextResponse } from "next/server";
import { randomBytes, timingSafeEqual } from "node:crypto";
import {
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
  CSRF_TOKEN_TTL_SECONDS,
} from "./csrf-constants";

export { CSRF_COOKIE_NAME, CSRF_HEADER_NAME, CSRF_TOKEN_TTL_SECONDS };

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function generateCsrfToken(): string {
  return randomBytes(32).toString("hex");
}

export function setCsrfCookie(
  response: NextResponse,
  token?: string,
  isSecure?: boolean
): string {
  const value = token ?? generateCsrfToken();
  response.cookies.set({
    name: CSRF_COOKIE_NAME,
    value,
    httpOnly: false,
    sameSite: "lax",
    secure: isSecure ?? false,
    path: "/",
    maxAge: CSRF_TOKEN_TTL_SECONDS,
  });
  return value;
}

export function clearCsrfCookie(response: NextResponse): void {
  response.cookies.set({
    name: CSRF_COOKIE_NAME,
    value: "",
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export function validateCsrf(request: NextRequest): NextResponse | null {
  const method = (request.method || "GET").toUpperCase();
  if (SAFE_METHODS.has(method)) return null;
  const cookieToken = request.cookies.get(CSRF_COOKIE_NAME)?.value ?? "";
  const headerToken = request.headers.get(CSRF_HEADER_NAME) ?? "";
  if (!cookieToken || !headerToken || !safeEqual(cookieToken, headerToken)) {
    return NextResponse.json(
      { error: "درخواست نامعتبر (CSRF)", code: "CSRF_INVALID" },
      { status: 403 }
    );
  }
  return null;
}

export const csrfValidate = validateCsrf;
export default validateCsrf;

export const requireCsrf = validateCsrf;
