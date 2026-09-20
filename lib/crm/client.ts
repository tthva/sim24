"use client";

// ─────────────────────────────────────────────
// CRM — browser API helper (RTL/CSRF-aware)
// Reads the csrf_token cookie (double-submit pattern)
// and mirrors it into the x-csrf-token header.
// ─────────────────────────────────────────────

const CSRF_COOKIE_NAME = "csrf_token";

function readCsrfCookie(): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${CSRF_COOKIE_NAME}=`));
  return match ? decodeURIComponent(match.split("=").slice(1).join("=")) : "";
}

export async function crmFetch(
  url: string,
  options: { method?: string; body?: any } = {}
): Promise<any> {
  const method = options.method || "GET";
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    headers["x-csrf-token"] = readCsrfCookie();
  }

  const res = await fetch(url, {
    method,
    headers,
    credentials: "include",
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  let data: any = null;
  try {
    data = await res.json();
  } catch {
    /* non-JSON response */
  }
  return { ok: res.ok, status: res.status, data };
}
