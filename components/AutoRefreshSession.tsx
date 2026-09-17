"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";

// Pages where no access token is expected / needed. The refresh timer is
// skipped entirely on these so the component can no longer kick anonymous
// users off public forms (issue: customer loses form data when the periodic
// refresh returns 401 on /buy, /sell, etc.).
const PUBLIC_PATHS = [
  "/",
  "/login",
  "/buy",
  "/sell",
  "/invest",
  "/search",
  "/terms",
  "/settings",
  "/signup",
  "/forgot-password",
];
function isPublicPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

let inFlight: Promise<Response> | null = null;

async function doRefresh(): Promise<Response> {
  const res = await fetch("/api/auth/refresh", {
    method: "POST",
    credentials: "include",
  });

  if (res.status === 401) {
    // Session is gone — clear cookies and go to login with the circuit breaker.
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    }).catch(() => {});
    window.location.href = "/login?force=1";
  }

  return res;
}

async function coordinatedRefresh(): Promise<void> {
  // Single-tab dedupe (Strict Mode double-mount, rapid navigations)
  if (inFlight) {
    await inFlight;
    return;
  }

  const runner = async () => {
    inFlight = doRefresh();
    try {
      await inFlight;
    } finally {
      inFlight = null;
    }
  };

  // Cross-tab serialization via Web Locks API where available.
  if (typeof navigator !== "undefined" && "locks" in navigator) {
    await (navigator as unknown as { locks: { request: (name: string, cb: () => Promise<void>) => Promise<void> } }).locks.request(
      "sim24-refresh",
      runner
    );
  } else {
    await runner();
  }
}

export default function AutoRefreshSession() {
  const pathname = usePathname();

  useEffect(() => {
    // Skip the refresh timer entirely on public pages where no access token
    // is expected. This prevents the periodic /api/auth/refresh from firing
    // on /buy / /sell / /invest / /search etc., where an anonymous user's
    // 401 response would trigger a hard redirect to /login — kicking them
    // off the form they're filling and losing their in-progress data.
    if (isPublicPath(pathname)) return;

    // NO mount refresh — only periodic. Access token lives 60 min, interval
    // is 30 min, so two full windows of headroom.
    const id = setInterval(() => {
      void coordinatedRefresh();
    }, 30 * 60 * 1000);

    return () => clearInterval(id);
  }, [pathname]);

  return null;
}