import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { errorResponse } from "@/lib/types/api";
import { checkRateLimit, getRateLimitHeaders } from "@/lib/rate-limiter-redis";

const RATE_LIMIT = {
  windowMs: 60_000, // 1 minute
  max: 60, // 60 requests / minute per IP
};

/**
 * Computes the hex HMAC-SHA256 of the RAW body using the shared secret.
 * SECURITY: the signature MUST be computed over the raw body bytes (before
 * JSON parsing) so both sides hash identical input.
 */
function signRawBody(rawBody: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
}

/**
 * Constant-time hex comparison via crypto.timingSafeEqual.
 * Returns false when lengths differ (avoids the throw timingSafeEqual would
 * raise on unequal-length buffers).
 */
function timingSafeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "hex");
  const bufB = Buffer.from(b, "hex");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export async function POST(request: NextRequest) {
  try {
    // ─── Rate limiting (fail-open, keyed by client IP) ────────────
    const ip =
      request.headers.get("x-forwarded-for") ??
      request.headers.get("x-real-ip") ??
      "unknown";
    const rateKey = `webhook:crm:${ip}`;
    const rateResult = await checkRateLimit(rateKey, RATE_LIMIT);
    if (!rateResult.allowed) {
      return NextResponse.json(
        errorResponse("تعداد درخواست‌ها بیش از حد مجاز است", null, "RATE_LIMITED"),
        {
          status: 429,
          headers: getRateLimitHeaders(RATE_LIMIT, rateResult),
        }
      );
    }

    // ─── Read RAW body first (signature is over the raw bytes) ──
    const rawBody = await request.text();

    // ─── HMAC signature verification (FAIL-CLOSED) ────────────────
    const secret = process.env.WEBHOOK_CRM_SECRET;
    if (!secret) {
      console.warn(
        "[Webhook] WEBHOOK_CRM_SECRET is not configured. Rejecting request (fail-closed)."
      );
      return NextResponse.json(
        errorResponse("دسترسی غیرمجاز", null, "WEBHOOK_UNAUTHORIZED"),
        { status: 401 }
      );
    }

    const signatureHeader = request.headers.get("x-webhook-signature");
    if (!signatureHeader) {
      console.warn("[Webhook] Rejected: missing x-webhook-signature header");
      return NextResponse.json(
        errorResponse("دسترسی غیرمجاز", null, "WEBHOOK_UNAUTHORIZED"),
        { status: 401 }
      );
    }

    const computedSignature = signRawBody(rawBody, secret);
    if (!timingSafeEqualHex(computedSignature, signatureHeader)) {
      console.warn("[Webhook] Rejected: invalid signature");
      return NextResponse.json(
        errorResponse("دسترسی غیرمجاز", null, "WEBHOOK_UNAUTHORIZED"),
        { status: 401 }
      );
    }

    // ─── Parse body AFTER signature verification ─────────────────
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json(
        errorResponse("Invalid JSON body", null, "INVALID_PAYLOAD"),
        { status: 400 }
      );
    }

    const event = typeof body.event === "string" ? body.event : "unknown";

    // ذخیره event در دیتابیس
    await prisma.webhookEvent.create({
      data: {
        event,
        payload: rawBody,
        status: "pending",
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Webhook] Error:", error);
    return NextResponse.json(
      errorResponse("Internal error", null, "INTERNAL_ERROR"),
      { status: 500 }
    );
  }
}
