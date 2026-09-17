'use client';
import { useEffect } from 'react';

let tokenCache: string | null = null;
let patched = false;

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return m ? decodeURIComponent(m[1]) : null;
}

function patchFetch() {
  if (patched || typeof window === 'undefined') return;
  patched = true;
  const orig = window.fetch.bind(window);
  window.fetch = function (input: RequestInfo | URL, init?: RequestInit) {
    try {
      const opts: RequestInit = init ? { ...init } : {};
      const method = String(
        opts.method || (typeof input === 'object' && input && 'method' in input ? (input as Request).method : 'GET')
      ).toUpperCase();
      if (method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE') {
        const url = typeof input === 'string' ? input : (input as Request).url || '';
        const same = !/^https?:\/\//i.test(url) || url.startsWith(window.location.origin);
        if (same) {
          // Always read the cookie fresh: login rotates csrf_token via
          // Set-Cookie, and any cached value would go stale -> 403.
          const t = readCookie('csrf_token');
          if (t) {
            const h = new Headers(opts.headers || (typeof input === 'object' && input ? (input as Request).headers : undefined));
            if (!h.has('X-CSRF-Token')) h.set('X-CSRF-Token', t);
            opts.headers = h;
          }
        }
      }
      return orig(input as RequestInfo, opts);
    } catch {
      return orig(input as RequestInfo, init);
    }
  } as typeof window.fetch;
}

export default function CsrfInit() {
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let t = readCookie('csrf_token');
      if (!t) {
        try {
          const r = await fetch('/api/auth/csrf', { credentials: 'same-origin' });
          if (r.ok) {
            const d = await r.json().catch(() => ({} as Record<string, unknown>));
            t = (d as Record<string, string>).token || (d as Record<string, string>).csrfToken || null;
          }
        } catch { /* ignore */ }
        if (!t) t = readCookie('csrf_token');
      }
      tokenCache = t || null;
      if (!cancelled) patchFetch();
    })();
    return () => { cancelled = true; };
  }, []);
  return null;
}
