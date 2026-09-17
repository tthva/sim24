import { NextResponse, NextRequest } from "next/server";
import { z } from "zod";
import { checkRateLimit, getRateLimitHeaders } from "@/lib/rate-limiter-redis";

// Zod schema for query parameter validation
const querySchema = z.object({
  phoneNumber: z.string().regex(/^09\d{9}$/, "شماره موبایل نامعتبر"),
  condition: z.enum(["dry", "used"], { message: "وضعیت نامعتبر" }),
});

// Mock operators
const operators = [
  { prefix: "0912", op: "همراه اول", color: "#23E250" },
  { prefix: "0919", op: "همراه اول", color: "#23E250" },
  { prefix: "0910", op: "همراه اول", color: "#23E250" },
  { prefix: "0911", op: "همراه اول", color: "#23E250" },
  { prefix: "0913", op: "ایرانسل", color: "#FF6B35" },
  { prefix: "0914", op: "ایرانسل", color: "#FF6B35" },
  { prefix: "0915", op: "ایرانسل", color: "#FF6B35" },
  { prefix: "0916", op: "ایرانسل", color: "#FF6B35" },
  { prefix: "0917", op: "ایرانسل", color: "#FF6B35" },
  { prefix: "0918", op: "ایرانسل", color: "#FF6B35" },
  { prefix: "0920", op: "رایتل", color: "#00AFFF" },
  { prefix: "0921", op: "رایتل", color: "#00AFFF" },
  { prefix: "0922", op: "رایتل", color: "#00AFFF" },
  { prefix: "0930", op: "همراه اول", color: "#23E250" },
  { prefix: "0933", op: "همراه اول", color: "#23E250" },
  { prefix: "0934", op: "همراه اول", color: "#23E250" },
  { prefix: "0935", op: "همراه اول", color: "#23E250" },
  { prefix: "0936", op: "همراه اول", color: "#23E250" },
  { prefix: "0937", op: "همراه اول", color: "#23E250" },
  { prefix: "0938", op: "همراه اول", color: "#23E250" },
  { prefix: "0939", op: "همراه اول", color: "#23E250" },
  { prefix: "0901", op: "ایرانسل", color: "#FF6B35" },
  { prefix: "0902", op: "ایرانسل", color: "#FF6B35" },
  { prefix: "0903", op: "ایرانسل", color: "#FF6B35" },
  { prefix: "0904", op: "ایرانسل", color: "#FF6B35" },
  { prefix: "0905", op: "ایرانسل", color: "#FF6B35" },
  { prefix: "0990", op: "همراه اول", color: "#23E250" },
  { prefix: "0991", op: "همراه اول", color: "#23E250" },
  { prefix: "0992", op: "همراه اول", color: "#23E250" },
  { prefix: "0993", op: "همراه اول", color: "#23E250" },
  { prefix: "0994", op: "همراه اول", color: "#23E250" },
];

function findOperator(phone: string): string {
  for (const op of operators) {
    if (phone.startsWith(op.prefix)) return op.op;
  }
  return "نامشخص";
}

function isGoldenNumber(phone: string): boolean {
  const num = phone.slice(3); // after 09x
  // Check for repeated digits
  if (/(\d)\1{3,}/.test(num)) return true;
  // Check for sequential patterns
  if (/0123|1234|2345|3456|4567|5678|6789|7890/.test(num)) return true;
  return false;
}

export async function GET(req: NextRequest) {
    // ── Public endpoint with IP-based rate limiting ─────────────────
  // This endpoint serves the public /search page's operator-lookup card,
  // so it MUST remain accessible WITHOUT authentication. Rate limiting by
  // client IP mitigates anonymous enumeration/abuse. Fail-open if Redis
  // is unavailable (see lib/rate-limiter-redis.ts).
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";

  // 30 requests / 60s per IP → Redis key: rl-sim-value:<ip>
  const rlOptions = { windowMs: 60_000, max: 30, keyPrefix: "rl-sim-value" };
  const rl = await checkRateLimit(ip, rlOptions);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "too_many_requests" },
      { status: 429, headers: getRateLimitHeaders(rlOptions, rl) }
    );
  }

  try {
    const searchParams = req.nextUrl.searchParams;
    const phoneNumber = searchParams.get("phoneNumber");
    const condition = searchParams.get("condition");

    const validatedParams = querySchema.parse({ phoneNumber, condition });

    // Determine operator
    const op = findOperator(validatedParams.phoneNumber);

    // Determine status and owner based on pattern
    const isGolden = isGoldenNumber(validatedParams.phoneNumber);
    const lastDigits = validatedParams.phoneNumber.slice(-4);    const status = isGolden ? "شماره رند (طلایی)" : "شماره معمولی";

    // Mock return — replace with real external service call
    return NextResponse.json(
      {
        status: "success",
        message: "استعلام با موفقیت انجام شد.",
        result: {
          phoneNumber: validatedParams.phoneNumber,
          condition: validatedParams.condition,
          operator: op,
          status,
          owner: "نامشخص (نیاز به استعلام از اپراتور)",
          value: condition === "dry" ? "نیاز به کارشناسی" : "نیاز به کارشناسی",
          lastDigits,
        },
      },
      { status: 200, headers: getRateLimitHeaders(rlOptions, rl) }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "پارامترهای نامعتبر", errors: error.issues },
        { status: 400 }
      );
    }
    console.error("Error in sim value query:", error);
    return NextResponse.json(
      { message: "خطای داخلی سرور" },
      { status: 500 }
    );
  }
}