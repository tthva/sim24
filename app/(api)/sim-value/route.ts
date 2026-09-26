import { NextResponse, NextRequest } from "next/server";
import { z } from "zod";
import { checkRateLimit, getRateLimitHeaders } from "@/lib/rate-limiter-redis";
import { getCurrentUser } from "@/lib/auth-guard";

// Zod schema for query parameter validation
const querySchema = z.object({
  phoneNumber: z
    .string()
    .regex(/^0912\d{7}$/, "شماره موبایل نامعتبر — فقط پیش‌شماره 0912 پشتیبانی می‌شود."),
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
  // ── Public endpoint — anonymous allowed, rate limited by IP or user ──
  // Called by the public /search form BEFORE login to show estimated SIM
  // value, so no auth is required. Anonymous visitors are rate limited by IP;
  // logged-in users get a higher limit keyed by their user sub.
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";

  const user = await getCurrentUser(req);

  const rlOptions = user
    ? { windowMs: 60_000, max: 60, keyPrefix: "rl-sim-value" }
    : { windowMs: 60_000, max: 20, keyPrefix: "rl-sim-value" };
  const rlKey = user ? `sim-value:user:${user.sub}` : `sim-value:anon:${ip}`;

  // Redis: fail-open if Redis down
  const rl = await checkRateLimit(rlKey, rlOptions);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "too_many_requests", message: "تعداد درخواست‌های شما بیش از حد مجاز است، لطفاً کمی بعد تلاش کنید." },
      { status: 429, headers: getRateLimitHeaders(rlOptions, rl) }
    );
  }

  try {
    const searchParams = req.nextUrl.searchParams;
    const phoneNumber = searchParams.get("phoneNumber");
    const condition = searchParams.get("condition");

    // 0912-only server-side validation for the public form
    if (!phoneNumber || !/^0912\d{7}$/.test(phoneNumber)) {
      return NextResponse.json(
        { message: "شماره موبایل نامعتبر: فقط شماره‌های با پیش‌شماره 0912 پشتیبانی می‌شوند." },
        { status: 400 }
      );
    }

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