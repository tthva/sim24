import { NextRequest, NextResponse } from "next/server";
import { generateCsrfToken, setCsrfCookie } from "@/lib/csrf";
import { isSecureRequest } from "@/lib/auth-guard";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const token = generateCsrfToken();
  const isSecure = isSecureRequest(request);
  const response = NextResponse.json({ csrfToken: token });
  setCsrfCookie(response, token, isSecure);
  return response;
}
