// ============================
// SIM24 — Price-expert risk assessment
// ============================
// Anti-abuse for PRICE_SEARCH forms:
//  blacklist → blocked | whitelist → trusted | duplicates → suspicious / high_risk
// Whitelisted numbers always pass; blacklisted always flagged (checked first).

import { prisma } from "@/lib/prisma";

export type RiskLevel = "normal" | "suspicious" | "high_risk" | "blocked" | "trusted";

export interface RiskAssessment {
  risk: RiskLevel;
  reasons: string[];
}

/** همه formTypeهایی که PRICE_SEARCH می‌سازند (هر دو نام پذیرفته می‌شوند) */
export const SEARCH_FORM_TYPES = ["real_market_value", "search"];

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

/** ارزیابی ریسک بر اساس یک یا دو شماره (ph = خط در حال استعلام، uph = تماس مشتری) */
export async function assessPriceSearchRisk(phones: Array<string | undefined>): Promise<RiskAssessment> {
  const clean = Array.from(
    new Set(phones.filter((p): p is string => !!p && /^09\d{9}$/.test(p))),
  );
  if (clean.length === 0) return { risk: "normal", reasons: [] };

  const reasons: string[] = [];

  // a) BLACKLIST — همیشه اولویت دارد (حتی اگر وایت‌لیست هم باشد)
  const blacklisted = await prisma.blacklistPhone.findFirst({
    where: { phone: { in: clean } },
    select: { phone: true, reason: true },
  });
  if (blacklisted) {
    return { risk: "blocked", reasons: [`blacklisted:${blacklisted.phone}`] };
  }

  // b) WHITELIST — همیشه رد می‌شود (بررسی تکرار انجام نمی‌شود)
  const whitelisted = await prisma.whitelistPhone.findFirst({
    where: { phone: { in: clean } },
    select: { phone: true },
  });
  if (whitelisted) {
    return { risk: "trusted", reasons: [`whitelisted:${whitelisted.phone}`] };
  }

  // c+d) DUPLICATE / RAPID — فقط برای شماره‌های عادی
  const now = Date.now();
  const dup24 = await prisma.customerForm.count({
    where: {
      formType: { in: SEARCH_FORM_TYPES },
      phone: { in: clean },
      createdAt: { gte: new Date(now - DAY_MS) },
    },
  });
  const rapid1h = await prisma.customerForm.count({
    where: {
      formType: { in: SEARCH_FORM_TYPES },
      phone: { in: clean },
      createdAt: { gte: new Date(now - HOUR_MS) },
    },
  });

  // dup24 = تعداد ثبت‌های قبلی ۲۴ ساعت گذشته؛ این درخواست (dup24+1)-اُم است
  const total24 = dup24 + 1;
  if (total24 >= 5) reasons.push(`duplicate_24h:${total24}`);
  else if (total24 >= 3) reasons.push(`duplicate_24h:${total24}`);

  // RAPID: سومین ارسال در ۱ ساعت
  if (rapid1h >= 2) reasons.push(`rapid_1h:${rapid1h + 1}`);

  if (total24 >= 5) return { risk: "high_risk", reasons };
  if (reasons.length > 0) return { risk: "suspicious", reasons };
  return { risk: "normal", reasons: [] };
}

/**
 * پنل «پیشنهاد بلاک»: شماره‌هایی که در ۲۴ ساعت گذشته ۵+ فرم PRICE_SEARCH ثبت کرده‌اند
 * (هریک یک فلگ) و هنوز در هیچ‌کدام از لیست‌ها نیستند.
 */
export async function getBlockSuggestions(): Promise<Array<{ phone: string; count: number }>> {
  const since = new Date(Date.now() - DAY_MS);
  const grouped = await prisma.customerForm.groupBy({
    by: ["phone"],
    where: {
      formType: { in: SEARCH_FORM_TYPES },
      createdAt: { gte: since },
      phone: { not: null },
    },
    _count: { phone: true },
    having: { phone: { _count: { gte: 5 } } },
  });

  const candidates = grouped
    .map((g) => ({ phone: g.phone as string, count: g._count.phone }))
    .filter((g) => /^09\d{9}$/.test(g.phone));
  if (candidates.length === 0) return [];

  const [bl, wl] = await Promise.all([
    prisma.blacklistPhone.findMany({ where: { phone: { in: candidates.map((c) => c.phone) } }, select: { phone: true } }),
    prisma.whitelistPhone.findMany({ where: { phone: { in: candidates.map((c) => c.phone) } }, select: { phone: true } }),
  ]);
  const excluded = new Set([...bl.map((b) => b.phone), ...wl.map((w) => w.phone)]);
  return candidates
    .filter((c) => !excluded.has(c.phone))
    .sort((a, b) => b.count - a.count);
}
