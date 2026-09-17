'use client'
import { useEffect, useState, ComponentType } from 'react'

type Role = 'admin' | 'agent' | 'operator' | 'user'

/**
 * Server-side cookie cleanup before a client-side redirect.
 *
 * The auth cookies are httpOnly, so document.cookie cannot delete them.
 * POST /api/auth/logout clears them UNCONDITIONALLY — even when the access
 * token is invalid or revoked (tokenVersion bumped). We then hard-navigate
 * to /login?force=1 — the middleware's circuit breaker clears both cookies
 * and renders the login page without ever bouncing back. This breaks the
 * stale-cookie redirect loop: without it, a cryptographically-valid-but-
 * revoked JWT keeps passing middleware verification and bouncing the user
 * between /login and the protected route forever (ERR_TOO_MANY_REDIRECTS).
 */
async function logoutAndGoToLogin(): Promise<void> {
  try {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
  } catch {
    // Even if the logout call fails, keep navigating — the ?force=1
    // circuit breaker clears stale cookies server-side.
  }
  window.location.href = '/login?force=1'
}

export default function withAuth<P extends object>(C: ComponentType<P>) {
  return function Wrapped(props: P) {
    const [ok, setOk] = useState(false)

    useEffect(() => {
      ;(async () => {
        try {
          const res = await fetch('/api/auth/check', { credentials: 'include' })
          if (res.status === 401) {
            // Clear server-side cookies before navigating so the middleware
            // cannot bounce us back with a stale-but-valid JWT.
            await logoutAndGoToLogin()
            return
          }
          if (!res.ok) {
            // Non-401 server error (e.g. 500): don't wipe a possibly-valid
            // session — go to the force-login page, middleware decides.
            window.location.href = '/login?force=1'
            return
          }

          const data: { authenticated: boolean; role?: Role } = await res.json()
          if (!data.authenticated || !data.role) {
            await logoutAndGoToLogin()
            return
          }

          // role-based redirect to keep UX and reduce RBAC confusion
          if (data.role === 'admin') return setOk(true)
          if (data.role === 'agent') return setOk(true)
          if (data.role === 'operator') return setOk(true)
          if (data.role === 'user') return setOk(true)

          setOk(true)
        } catch {
          await logoutAndGoToLogin()
        }
      })()
    }, [])

    if (!ok)
      return (
        <div className="pb flex items-center justify-center min-h-screen">
          <div className="text-[#51BB70] text-xl font-vazir animate-pulse">
            در حال بارگذاری...
          </div>
        </div>
      )

    return <C {...props} />
  }
}
