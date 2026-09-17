import { useEffect, useState } from "react";
import GlassCard from "@/components/GlassCard";
import AcceptTerms from "@/components/AcceptTerms";
import FieldSet from "@/components/FieldSet";
import HowKnow from "@/components/HowKnow";
import AutocompleteField from "@/components/AutocompleteField";
import FileUploadZone from "@/components/FileUploadZone";
import SuccessConfirmationModal from "@/components/ConfirmationModal";
import { provinces, getCitiesOfProvince } from "@/lib/iranData";
import { onlyPersian, clampDay, clampMonth, isValid0912 } from "@/lib/form-validators";
import {
  getInstallmentInterestRate,
  applyInstallmentInterest,
} from "@/lib/installment";

const toE = (s: string) =>
  s.replace(/[۰-۹]/g, (d) => (d.charCodeAt(0) - 1776).toString());

const isMobile = (v: string) => /^09\d{9}$/.test(toE(v));

const getPersianYear = () => {
  const faYearStr = new Date().toLocaleDateString("fa-IR", { year: "numeric" });
  return parseInt(
    faYearStr.replace(/[۰-۹]/g, (d: string) => String(d.charCodeAt(0) - 1776)),
  );
};

const formatPrice = (val: string) => {
  if (!val) return "";
  const num = toE(val).replace(/\D/g, "");
    return num.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

const pad2 = (s: string) => (s.length === 1 ? "0" + s : s);


function ConfirmRow({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex items-center justify-between py-3 px-4 rounded-xl bg-white/5 border border-white/5">
      <span className="text-sm text-white/60 font-medium">{label}</span>
      <span className="text-sm text-white font-medium">{value || "—"}</span>
    </div>
  );
}

const parseNumericAmount = (value: string): number => {
  const parsed = Number(value.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
};


function InstPage({
  attachmentIds,
  onAttachmentIdsChange,
}: {
  attachmentIds: string[];
  onAttachmentIdsChange?: (ids: string[]) => void;
}) {
  const [mo, setMo] = useState(12);
  const [sp, setSp] = useState("");
  const [dp, setDp] = useState("");
  const [nm, setNm] = useState("");
  const [fm, setFm] = useState("");
  const [ph, setPh] = useState("");
  const [prov, setProv] = useState<number | "">("");
  const [city, setCity] = useState<number | "">("");
  const [birthDay, setBirthDay] = useState("");
  const [birthMonth, setBirthMonth] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [hk, setHk] = useState("");
  const [acc, setAcc] = useState(false);
  const [pref, setPref] = useState("");

  const [submitted, setSubmitted] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // وضعیت مودال نتیجه (موفق / ناموفق) — مطابق الگوی تب خرید نقدی
  const [showResult, setShowResult] = useState(false);
  const [resultVariant, setResultVariant] = useState<"success" | "error">(
    "success",
  );
  const [resultRequestId, setResultRequestId] = useState("");
  const [resultMessage, setResultMessage] = useState("");

  const cities = prov ? getCitiesOfProvince(Number(prov)) : [];

  const tot = parseNumericAmount(sp);
  const dn = parseNumericAmount(dp);
  const safeMo = Number(mo);

  // For installment calculations only, we still need a numeric down payment.
  // Validation rules are enforced below via dpErr:
  // 20% <= dp <= 80% of سیمکارت price.
  const effectiveDownPayment = Math.min(Math.max(dn, 0), tot);
  const remainingAmount = Math.max(tot - effectiveDownPayment, 0);
  const finalInstallmentAmount = applyInstallmentInterest(
    remainingAmount,
    safeMo,
  );
  const appliedInterestRate = getInstallmentInterestRate(
    Number.isFinite(safeMo) && safeMo > 0 ? safeMo : 4,
  );

  // Live sync پیش‌پرداخت با تغییر قیمت کل در handlerهای onChange انجام می‌شود.
  // این useEffect قبلی باعث عدم‌همگامی (عدم آپدیت لایو) به خاطر گارد dp !== "" می‌شد.

  const fmt = (n: number) =>
    n > 0 ? n.toLocaleString("fa-IR", { style: "decimal" }) + " تومان" : "-";

  const provLabel = (id: number | "") => {
    if (!id) return "—";
    return provinces.find((p) => p.id === id)?.name ?? String(id);
  };

  const cityLabel = (pId: number | "", cId: number | "") => {
    if (!pId || !cId) return "—";
    return (
      getCitiesOfProvince(Number(pId)).find((c) => c.id === cId)?.name ??
      String(cId)
    );
  };

  const doSubmit = () => {
    setSubmitted(true);
    if (
      nm &&
      fm &&
      ph &&
      isMobile(ph) &&
      prov &&
      city &&
      birthDay &&
      birthMonth &&
      birthYear &&
      sp &&
      dp &&
      (!pref || isValid0912(pref)) &&
      acc
    ) {
      setShowConfirm(true);
    }
  };

  // پاک‌سازی کامل فیلدهای فرم پس از ثبت موفق
  const resetForm = () => {
    setMo(12);
    setSp("");
    setDp("");
    setNm("");
    setFm("");
    setPh("");
    setProv("");
    setCity("");
    setBirthDay("");
    setBirthMonth("");
    setBirthYear("");
    setHk("");
    setAcc(false);
    setPref("");
    setSubmitted(false);
    onAttachmentIdsChange?.([]);
  };

  const nmErr = submitted && nm.trim().length < 2;
  const fmErr = submitted && fm.trim().length < 2;
  const phErr = submitted && (!ph || !isMobile(ph));
  const provErr = submitted && !prov;
  const cityErr = submitted && !city;
  const bdErr = submitted && (!birthDay || !birthMonth || !birthYear);
  const spErr = submitted && tot <= 0;

  // Real-time validation: پیش‌پرداخت نباید کمتر از ۳۰٪ قیمت باشد
  const dpErr = dn > 0 && tot > 0 && dn < tot * 0.3;

  const accErr = submitted && !acc;
  const prefErr = submitted && !!pref && !isValid0912(pref);

  const progress = ((mo - 1) / 11) * 100;
  const rtlProgress = 100 - progress;

  return (
    <>
      <div className="flex flex-col gap-4">
        <div className="afu d2">
          <FieldSet
            label="نام"
            value={nm}
            onChange={(e) => setNm(onlyPersian(e.target.value))}
            error={nmErr}
            helperText={nmErr ? (nm ? "نام باید حداقل ۲ حرف فارسی باشد" : "این فیلد اجباری است") : undefined}
            dir="rtl"
          />
        </div>

        <div className="afu d2">
          <FieldSet
            label="نام خانوادگی"
            value={fm}
            onChange={(e) => setFm(onlyPersian(e.target.value))}
            error={fmErr}
            helperText={fmErr ? (fm ? "نام خانوادگی باید حداقل ۲ حرف فارسی باشد" : "این فیلد اجباری است") : undefined}
            dir="rtl"
          />
        </div>

        <div className="afu d3">
          <FieldSet
            label="شماره موبایل"
            type="tel"
            value={ph}
            onChange={(e) =>
              setPh(toE(e.target.value).replace(/\D/g, "").slice(0, 11))
            }
            error={phErr}
            helperText={
              phErr
                ? !ph
                  ? "این فیلد اجباری است"
                  : "شماره باید ۱۱ رقم و با ۰۹ شروع شود"
                : undefined
            }
            dir="rtl"
          />
        </div>

        <div className="flex gap-3 afu d4">
          <div className="flex-1">
            <AutocompleteField
              label="استان"
              options={provinces}
              value={prov}
              onChange={(id) => {
                setProv(id as number);
                setCity("");
              }}
              error={provErr}
              helperText={provErr ? "این فیلد اجباری است" : undefined}
              openOnFocus
            />
          </div>
          <div className="flex-1">
            <AutocompleteField
              label="شهر"
              options={cities}
              value={city}
              onChange={(id) => setCity(id as number)}
              error={cityErr}
              helperText={cityErr ? "این فیلد اجباری است" : undefined}
              disabled={!prov}
              openOnFocus
              key={prov}
            />
          </div>
        </div>

        <div className="afu d4">
          <label
            className="text-white text-sm font-medium mb-2 block text-right"
            dir="rtl"
          >
            تاریخ تولد
          </label>
          <div className="flex gap-2 items-center justify-end" dir="rtl">
            <div className="flex-1">
              <FieldSet
                label="روز"
                value={birthDay}
                onChange={(e) => {
                  let v = toE(e.target.value).replace(/\D/g, "").slice(0, 2);
                  if (Number(v) > 31) v = "31";
                  setBirthDay(v);
                }}
                onBlur={(e) => {
                  // در حین تایپ عدد تک‌رقمی را پر نمی‌کنیم (پرش کرسر رخ ندهد)؛
                  // فقط هنگام خروج از فیلد به «0X» تبدیل می‌شود:
                                    setBirthDay(clampDay(e.target.value));
                }}
                error={bdErr && !birthDay}
                dir="rtl"
              />
            </div>
            <span className="text-white/60 font-bold">/</span>
            <div className="flex-1">
              <FieldSet
                label="ماه"
                value={birthMonth}
                onChange={(e) => {
                  let v = toE(e.target.value).replace(/\D/g, "").slice(0, 2);
                  if (Number(v) > 12) v = "12";
                  setBirthMonth(v);
                }}
                onBlur={(e) => {
                  // همان منطق روز: پر کردن صفر فقط هنگام blur، نه هنگام تایپ
                  setBirthMonth(clampMonth(e.target.value));
                }}
                error={bdErr && !birthMonth}
                dir="rtl"
              />
            </div>
            <span className="text-white/60 font-bold">/</span>
            <div className="flex-1" style={{ minWidth: 80 }}>
              <FieldSet
                label="سال"
                value={birthYear}
                onChange={(e) => {
                  let v = toE(e.target.value).replace(/\D/g, "").slice(0, 4);
                  const maxYear = getPersianYear() - 17;
                  if (v.length === 4) {
                    if (Number(v) < 1300) v = "1300";
                    if (Number(v) > maxYear) v = String(maxYear);
                  }
                  setBirthYear(v);
                }}
                error={bdErr && !birthYear}
                dir="rtl"
              />
            </div>
          </div>
          {bdErr && (
            <div className="text-[#FF6B6B] text-xs text-right mt-1" dir="rtl">
              تاریخ تولد اجباری است
            </div>
          )}
        </div>
        <div className="afu d5">
          <FieldSet
            label="شماره دلخواه"
            value={pref}
            onChange={(e) => { const v = toE(e.target.value).replace(/\D/g, "").slice(0, 11); setPref((prev) => (!v || /^0912\d{0,7}$/.test(v) || (v.length < 4 && "0912".startsWith(v)) ? v : prev)); }}
            error={prefErr}
            helperText={prefErr ? "شماره دلخواه باید ۱۱ رقم و با 0912 شروع شود" : undefined}
          />
        </div>
        <div className="afu d3 relative">
          <FieldSet
            label="مبلغ سیمکارت"
            value={formatPrice(sp)}
            onChange={(e) => {
              const nextSp = toE(e.target.value).replace(/\D/g, "");
              setSp(nextSp);

              const nextTot = parseNumericAmount(nextSp);
              if (!Number.isFinite(nextTot) || nextTot <= 0) {
                setDp("");
                return;
              }

              // Reset dp immediately to 30% رند جدید whenever user starts changing sp.
              const target = Math.floor(nextTot * 0.3);
              const roundingUnit =
                nextTot >= 10_000_000 ? 1_000_000 : 100_000;
              const rounded = Math.floor(target / roundingUnit) * roundingUnit;

              setDp(String(Math.max(rounded, 1)));
            }}
            error={spErr}
            helperText={spErr ? "مبلغ سیمکارت باید بیشتر از صفر باشد" : undefined}
            dir="rtl"
          />
          {sp && (
            <span
              className="absolute left-3 top-1/2 -translate-y-1/2 text-white/60 text-sm pointer-events-none select-none"
              style={{ fontFamily: "Vazirmatn, sans-serif" }}
            >
              تومان
            </span>
          )}
        </div>

        <div className="afu d4 relative">
          <FieldSet
            label="پیش پرداخت"
            value={formatPrice(dp)}
            onChange={(e) => setDp(toE(e.target.value).replace(/\D/g, ""))}
            error={dpErr}
            helperText={dpErr ? "پیش پرداخت نباید کمتر از ۳۰ درصد قیمت کل باشد" : undefined}
            dir="rtl"
          />
          {dp && (
            <span
              className="absolute left-3 top-1/2 -translate-y-1/2 text-white/60 text-sm pointer-events-none select-none"
              style={{ fontFamily: "Vazirmatn, sans-serif" }}
            >
              تومان
            </span>
          )}
        </div>

        <GlassCard
          cls="p-6 afu d1"
          ch={
            <>
              <div
                className="text-white text-xl font-bold text-center mb-4"
                style={{ fontFamily: "Vazirmatn, sans-serif" }}
              >
                {mo} ماهه
              </div>

              <div className="relative py-3" dir="rtl">
                <div
                  className="h-2 rounded-full relative overflow-hidden"
                  style={{ background: "rgba(255,255,255,.1)" }}
                >
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${progress}%`,
                      background: "linear-gradient(90deg,#137C2C,#23E250)",
                    }}
                  />
                </div>

                <div
                  className="absolute top-1 h-5 w-5 bg-[#51BB70] rounded-full transition-all duration-300"
                  style={{
                    left: `${rtlProgress}%`,
                    transform: "translateX(-50%)",
                    boxShadow: "0 0 8px rgba(81,187,112,.6)",
                  }}
                />

                <input
                  type="range"
                  min="1"
                  max="12"
                  step="1"
                  value={mo}
                  onChange={(e) => setMo(parseInt(e.target.value))}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full"
                />
              </div>

              <div className="flex justify-between text-white/40 text-xs mt-1">
                <span style={{ fontFamily: "Vazirmatn, sans-serif" }}>
                  ۱ ماه
                </span>
                <span style={{ fontFamily: "Vazirmatn, sans-serif" }}>
                  ۱۲ ماه
                </span>
              </div>
            </>
          }
        />

        <GlassCard
          cls="p-5 afu d5"
          ch={
            <div className="flex flex-col gap-2 " dir="rtl">
              <div className="flex justify-between items-center py-1.5">
                <span
                  className="text-white/60 text-sm"
                  style={{ fontFamily: "Vazirmatn, sans-serif" }}
                >
                  مبلغ نهایی
                </span>
                <span
                  className="text-white font-bold"
                  style={{ fontFamily: "Vazirmatn, sans-serif" }}
                >
                  {fmt(finalInstallmentAmount * safeMo + effectiveDownPayment)}
                </span>
              </div>

              <div className="border-b border-[#A2A2A2]" />
              <div
                className="flex justify-between items-center py-1.5"
                dir="rtl"
              >
                <span
                  className="text-white/60 text-sm"
                  style={{ fontFamily: "Vazirmatn, sans-serif" }}
                >
                  مبلغ هر قسط
                </span>
                <span
                  className="text-white"
                  style={{ fontFamily: "Vazirmatn, sans-serif" }}
                >
                  {fmt(finalInstallmentAmount)}
                </span>
              </div>
            </div>
          }
        />

        <div className="afu d5">
          <HowKnow val={hk} onChange={setHk} forceError={submitted} />
        </div>

        {/* بارگذاری فایل — بالای دکمه ثبت */}
        {onAttachmentIdsChange && (
          <FileUploadZone onAttachmentIdsChange={onAttachmentIdsChange} />
        )}

        <div className="flex flex-row-reverse items-center justify-between pb-6 afu d6">
          <button className="ba px-8" onClick={doSubmit}>
            ثبت
          </button>
          <AcceptTerms ch={acc} onChange={setAcc} showErr={accErr} />
        </div>
      </div>

      {showConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#11223d]/60 backdrop-blur-sm"
          style={{ animation: "fadeIn 0.3s ease-out" }}
        >
          <div
            className="relative w-full max-w-lg mx-auto p-6 md:p-8 bg-[#1c3968]/5 backdrop-blur-xl border border-white/20 rounded-3xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.5)] overflow-y-auto max-h-[90vh]"
            style={{ direction: "rtl" }}
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-[#51BB70]">
                تأیید اطلاعات
              </h2>
              <button
                onClick={() => setShowConfirm(false)}
                className="flex items-center gap-1 px-4 py-1.5 text-sm font-medium text-white/70 border border-white/20 rounded-full hover:text-white hover:border-[#51BB70] hover:bg-white/5 transition-all"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M17 3a2.85 2.85 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                  <path d="m15 5 4 4" />
                </svg>
                ویرایش
              </button>
            </div>

            <div className="space-y-4 mb-8">
              <ConfirmRow label="نام" value={nm} />
              <ConfirmRow label="نام خانوادگی" value={fm} />
              <ConfirmRow label="شماره تماس" value={ph} />
              <ConfirmRow label="استان" value={provLabel(prov)} />
              <ConfirmRow label="شهر" value={cityLabel(prov, city)} />
              <ConfirmRow
                label="تاریخ تولد"
                value={`${birthYear}/${birthMonth}/${birthDay}`}
              />
              <ConfirmRow
                label="مبلغ سیمکارت"
                value={`${formatPrice(sp)} تومان`}
              />
              <ConfirmRow
                label="پیش پرداخت"
                value={`${formatPrice(dp)} تومان`}
              />
              <ConfirmRow label="تعداد اقساط" value={`${mo} ماه`} />
              <ConfirmRow
                label="مبلغ هر قسط"
                value={fmt(finalInstallmentAmount)}
              />
              {hk && <ConfirmRow label="نحوه آشنایی" value={hk} />}
            </div>

            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setShowConfirm(false)}
                className="px-6 py-2.5 text-sm font-medium text-white/80 border border-white/20 rounded-xl hover:bg-white/5 hover:border-white/30 transition-all"
              >
                انصراف
              </button>
                  <button
                    onClick={async () => {
                      const payload = {
                        nm,
                        fm,
                        ph,
                        prov,
                        city,
                        birthDay: pad2(birthDay),
                        birthMonth: pad2(birthMonth),
                        birthYear,
                        sp: sp.replace(/,/g, ""),
                        dp: dp.replace(/,/g, ""),
                        mo,
                        hk,
                        pref: pref || undefined,
                        attachmentIds,
                      };
                      try {
                        const res = await fetch("/api/forms/buy", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            formType: "buy_installment",
                            formData: payload,
                          }),
                        });
                        const result = await res.json();
                        if (res.ok || res.status === 200 || res.status === 201) {
                          setShowConfirm(false);
                          // پاک‌سازی کامل localStorage/Draft پس از دریافت res.ok یا status 200/201
                          localStorage.removeItem("buyForm");
                          localStorage.removeItem("sellForm");
                          localStorage.removeItem("sellForm_draft");
                          // پاک‌سازی تمام فیلدهای فرم پس از ثبت موفق
                          resetForm();
                          // نمایش مودال موفقیت — مطابق الگوی تب خرید نقدی
                          setResultVariant("success");
                          setResultRequestId(result?.data?.id || "");
                          setResultMessage("");
                          setShowResult(true);
                        } else {
                          // نمایش مودال خطا — مطابق الگوی تب خرید نقدی
                          setResultVariant("error");
                          setResultRequestId(result?.error?.code || "");
                          setResultMessage(
                            result?.error?.message ||
                              result?.message ||
                              "خطا در ثبت فرم",
                          );
                          setShowResult(true);
                        }
                      } catch {
                        // نمایش مودال خطای شبکه — مطابق الگوی تب خرید نقدی
                        setResultVariant("error");
                        setResultRequestId("");
                        setResultMessage("خطا در ارسال اطلاعات");
                        setShowResult(true);
                      }
                    }}
                className="px-8 py-2.5 text-sm font-bold bg-[#51BB70] text-[#011B2C] rounded-xl shadow-[0_0_20px_rgba(81,187,112,0.3)] hover:shadow-[0_0_30px_rgba(81,187,112,0.5)] hover:bg-[#45a762] transition-all"
              >
                تأیید نهایی
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── RESULT MODAL (موفق / ناموفق) — مطابق الگوی تب خرید نقدی ── */}
      <SuccessConfirmationModal
        isOpen={showResult}
        variant={resultVariant}
        requestId={resultRequestId}
        message={
          resultVariant === "success"
            ? "درخواست شما با موفقیت ثبت گردید و در اسرع وقت توسط کارشناسان ما بررسی خواهد شد. برای پیگیری‌های بعدی، شماره زیر را نزد خود نگه دارید."
            : resultMessage || "با مشکل مواجه شد"
        }
        title={resultVariant === "success" ? "موفق" : "با مشکل مواجه شد"}
        onClose={() => setShowResult(false)}
      />
    </>
  );
}

export default InstPage;


