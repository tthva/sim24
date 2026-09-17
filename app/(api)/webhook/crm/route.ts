import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { errorResponse } from "@/lib/types/api";

/**
 * Validates the webhook signature using HMAC-SHA256.
 * The signature is computed from the raw body and compared
 * against the X-CRM-Signature header.
 * 
 * WEBHOOK_SECRET must be set in environment variables.
 * If not set, webhook requests are rejected with 501.
 */
async function validateWebhookSignature(
  request: NextRequest,
  rawBody: string
): Promise<{ valid: boolean; reason?: string }> {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) {
    return { valid: false, reason: "WEBHOOK_SECRET not configured" };
  }

  const signatureHeader = request.headers.get("x-crm-signature");
  if (!signatureHeader) {
    return { valid: false, reason: "Missing X-CRM-Signature header" };
  }

  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const signature = await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(rawBody)
    );

    const computedSignature = Array.from(new Uint8Array(signature))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    // Constant-time comparison to prevent timing attacks
    if (computedSignature.length !== signatureHeader.length) {
      return { valid: false, reason: "Invalid signature" };
    }

    let match = true;
    for (let i = 0; i < computedSignature.length; i++) {
      match = match && computedSignature[i] === signatureHeader[i];
    }

    if (!match) {
      return { valid: false, reason: "Signature mismatch" };
    }

    return { valid: true };
  } catch (err) {
    console.error("[Webhook] Signature validation error:", err);
    return { valid: false, reason: "Signature validation failed" };
  }
}

export async function POST(request: NextRequest) {
  try {
    // Read raw body for signature validation
    const rawBody = await request.text();
    
    // Validate webhook signature
    const signatureResult = await validateWebhookSignature(request, rawBody);
    if (!signatureResult.valid) {
      console.warn("[Webhook] Rejected:", signatureResult.reason);
      return NextResponse.json(
        errorResponse("Unauthorized", signatureResult.reason, "WEBHOOK_UNAUTHORIZED"),
        { status: 401 }
      );
    }

    // Parse body after signature validation
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
