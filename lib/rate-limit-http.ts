import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, type RateLimitOptions, type RateLimitResult } from "@/lib/rate-limiter-redis";

// ─── Shared HTTP rate-limit helper ───────────────────────────────
// Wraps the Redis-backed limiter (fail-open on Redis outage) for use inside
// API routes. Client IP is taken from x-forwarded-for (proxy chain) with a
// fallback to the direct peer address.
export function getClientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

export const FORM_RATE_LIMIT: RateLimitOptions = {
  windowMs: 60_000,
  max: 10,
  keyPrefix: "rl-form",
};

export const CRM_WRITE_RATE_LIMIT: RateLimitOptions = {
  windowMs: 60_000,
  max: 60,
  keyPrefix: "rl-crm-write",
};

export type RateLimitResponse =
  | { limited: false }
  | { limited: true; response: NextResponse };

/** Returns a limited:true 429 response when the caller is over budget. */
export async function limitRequest(
  req: NextRequest,
  options: RateLimitOptions,
  scope: string
): Promise<RateLimitResponse> {
  let result: RateLimitResult;
  try {
    result = await checkRateLimit(`${scope}:${getClientIp(req)}`, options);
  } catch {
    // Limiter exploded — fail open rather than break the endpoint.
    return { limited: false };
  }
  if (!result.allowed) {
    return {
      limited: true,
      response: NextResponse.json(
        {
          success: false,
          error: {
            code: "RATE_LIMITED",
            message: "تعداد درخواست‌ها بیش از حد مجاز است. کمی بعد تلاش کنید.",
          },
        },
        {
          status: 429,
          headers: {
            ...getRateLimitHeadersSafe(options, result),
            "Retry-After": String(Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000))),
          },
        }
      ),
    };
  }
  return { limited: false };
}

function getRateLimitHeadersSafe(options: RateLimitOptions, result: RateLimitResult) {
  const remaining = result.allowed ? result.remaining : 0;
  return {
    "X-RateLimit-Limit": String(options.max),
    "X-RateLimit-Remaining": String(remaining),
    "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
  };
}
