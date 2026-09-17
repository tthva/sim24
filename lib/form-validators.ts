// ============================
// SIM24 — Shared Form Validators
// ============================
// اعتبارسنجی متمرکز برای تمام فرم‌ها (مشتری + اپراتور).
// همه هندلرها ارقام فارسی (۰-۹) را می‌پذیرند و به انگلیسی تبدیل می‌کنند.

/** تبدیل ارقام فارسی/عربی به انگلیسی */
export const toE = (s: string): string =>
  s
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 1776))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632));

/** فقط حروف فارسی و فاصله — حذف رقم، انگلیسی و نمادها */
export const onlyPersian = (s: string): string =>
  s.replace(/[^\u0600-\u06FF\s]/g, "").replace(/\s{2,}/g, " ");

/** فقط رقم انگلیسی با حداکثر طول مشخص */
export const digits = (s: string, max: number): string =>
  toE(s).replace(/\D/g, "").slice(0, max);

/** روز: 1 تا 31 — خروجی همیشه دو رقمی صفرگذاری‌شده (05) */
export const clampDay = (v: string): string => {
  const n = parseInt(toE(v).replace(/\D/g, ""), 10);
  if (!Number.isFinite(n)) return "";
  const c = n < 1 ? 1 : n > 31 ? 31 : n;
  return String(c).padStart(2, "0");
};

/** ماه: 1 تا 12 — خروجی دو رقمی (07) */
export const clampMonth = (v: string): string => {
  const n = parseInt(toE(v).replace(/\D/g, ""), 10);
  if (!Number.isFinite(n)) return "";
  const c = n < 1 ? 1 : n > 12 ? 12 : n;
  return String(c).padStart(2, "0");
};

/** سال شمسی: پیش‌فرض 1300 تا 1405 */
export const clampYear = (v: string, min = 1300, max = 1405): string => {
  const n = parseInt(toE(v).replace(/\D/g, ""), 10);
  if (!Number.isFinite(n)) return "";
  const c = n < min ? min : n > max ? max : n;
  return String(c);
};

/** موبایل: هر پیش‌شماره 09 — ^09\d{9}$ */
export const isValidMobile = (v: string): boolean =>
  /^09\d{9}$/.test(toE(v));

/** شماره دلخواه خرید: فقط 0912 — ^0912\d{7}$ */
export const isValid0912 = (v: string): boolean =>
  /^0912\d{7}$/.test(toE(v));

/** نام معتبر: حداقل ۲ کاراکتر */
export const isValidName = (v: string): boolean =>
  v.trim().length >= 2;

/** قیمت معتبر: خالی مجاز است، در غیر این صورت > 0 */
export const isValidPrice = (v: string): boolean => {
  if (v === "" || v === null || v === undefined) return true;
  const n = Number(toE(v).replace(/,/g, ""));
  return Number.isFinite(n) && n > 0;
};
