export const CSRF_COOKIE_NAME = "csrf_token";
export const CSRF_HEADER_NAME = "x-csrf-token";

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function getCsrfToken(): string | null {
  if (typeof document === "undefined") return null;
  const parts = document.cookie ? document.cookie.split("; ") : [];
  for (const p of parts) {
    const i = p.indexOf("=");
    if (i > -1 && p.slice(0, i) === CSRF_COOKIE_NAME) {
      try {
        return decodeURIComponent(p.slice(i + 1));
      } catch {
        return p.slice(i + 1);
      }
    }
  }
  return null;
}

export function withCsrf(init: RequestInit = {}): RequestInit {
  const method = (init.method ?? "GET").toUpperCase();
  const headers = new Headers(init.headers ?? undefined);
  if (MUTATING.has(method)) {
    const t = getCsrfToken();
    if (t) headers.set(CSRF_HEADER_NAME, t);
  }
  return { ...init, headers, credentials: init.credentials ?? "same-origin" };
}

export async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  return fetch(input, withCsrf(init));
}
