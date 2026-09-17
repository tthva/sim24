"use client";
import { useState, useEffect } from "react";
import Layout from "@/components/Layout";
import BottomLogo from "@/components/BottomLogo";
import GlassCard from "@/components/GlassCard";
import FieldSet from "@/components/FieldSet";
import HowKnow from "@/components/HowKnow";
import Link from "next/link";
import SuccessConfirmationModal from "@/components/ConfirmationModal";
import { onlyPersian } from "@/lib/form-validators";

const toE = (s: string) =>
  s.replace(/[۰-۹]/g, (d) => (d.charCodeAt(0) - 1776).toString());
const toP = (s: string) => s.replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[+d]);

type Cond = "dry" | "used";
type Res = { status: string; owner: string; op: string; num: string } | null;

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

function SearchPage() {
  const [ph, setPh] = useState("");
  const [cond, setCond] = useState<Cond>("used");
  const [nm, setNm] = useState("");
  const [fm, setFm] = useState("");
  const [uph, setUph] = useState("");
  const [hk, setHk] = useState("");
  const [res, setRes] = useState<Res>(null);
  const [ld, setLd] = useState(false);
  const [touched, setTouched] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false); // State جدید برای مودال

  // وضعیت مودال نتیجه (موفق / ناموفق)
  const [showResult, setShowResult] = useState(false);
  const [resultVariant, setResultVariant] = useState<"success" | "error">("success");
  const [resultRequestId, setResultRequestId] = useState("");
  const [resultMessage, setResultMessage] = useState("");

  // شماره استعلام (ph) — فقط 0912
  const isSimQuery = (v: string) => /^0912\d{7}$/.test(toE(v));
  // شماره جهت ارتباط (uph) — هر پیش‌شماره 09
  const isMobile = (v: string) => /^09\d{9}$/.test(toE(v));
  const showErr = touched && (!ph || !isSimQuery(ph));
  const errMsg = !ph
    ? "این فیلد اجباری است"
    : "شماره استعلام باید ۱۱ رقم و با 0912 شروع شود";

  const nmErr = submitted && nm.trim().length < 2;
  const fmErr = submitted && fm.trim().length < 2;
  const uphErr = submitted && (!uph || !isMobile(uph));
  const hkErr = submitted && !hk;

  // Fetch sim value when phone number is valid
  const doFetch = async () => {
    if (!ph || !isSimQuery(ph)) return;
    setLd(true);
    try {
      const res = await fetch(`/api/sim-value?phoneNumber=${ph}&condition=${cond}`);
      const data = await res.json();
      if (res.ok && data.status === "success") {
        setRes({
          status: data.result.status,
          owner: data.result.operator,
          op: data.result.operator,
          num: ph,
        });
      } else {
        setRes(null);
      }
    } catch {
      setRes(null);
    } finally {
      setLd(false);
    }
  };

  // Trigger fetch on phone change with debounce
  const handlePhoneChange = (raw: string) => {
    setPh(raw);
    setTouched(true);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (ph && isSimQuery(ph)) {
        doFetch();
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [ph, cond]);

  // تابع ثبت فرم ارزش واقعی بازار
  const handleRealValueSubmit = () => {
    setSubmitted(true);
    setTouched(true); // نمایش خطای شماره استعلام حتی اگر کاربر در آن فیلد تایپ نکرده باشد
    if (ph && isSimQuery(ph) && nm && fm && uph && isMobile(uph) && hk) {
      setShowConfirm(true);
    }
  };

  return (
    <Layout
      ch={
        <>
          <div className="px-6 pt-4 flex-1 flex flex-col gap-5" dir="rtl">
            <GlassCard
              cls="p-6 text-center afu d1"
              ch={
                <>
                  <input
                    type="text"
                    className="text-white text-center text-2xl font-mono tracking-widest min-h-[40px] transition-all bg-transparent placeholder-white/50 p-0 border-0 focus:outline-none focus:ring-0 w-full"
                    dir="ltr"
                    inputMode="numeric"
                    placeholder="0912 ___ ____"
                    value={toP(ph)}
                    onChange={(e) => {
                      const raw = toE(e.target.value).replace(/[^0-9]/g, "");
                      handlePhoneChange(raw.length > 11 ? raw.slice(0, 11) : raw);
                    }}
                    style={{
                      fontFamily: "Vazirmatn, monospace",
                      letterSpacing: "0.15em",
                    }}
                  />
                  {showErr && (
                    <div
                      className="text-red-400 text-sm mt-2 text-center"
                      style={{ fontFamily: "Vazirmatn, sans-serif" }}
                    >
                      {errMsg}
                    </div>
                  )}
                </>
              }
            />

            <div className="afu d2 flex gap-8 justify-start" dir="rtl">
              {(
                [
                  ["dry", "خشک"],
                  ["used", "کارکرده"],
                ] as [Cond, string][]
              ).map(([id, lb]) => (
                <button
                  key={id}
                  onClick={() => setCond(id)}
                  className="flex items-center gap-2"
                >
                  <span
                    className={`text-sm font-medium ${cond === id ? "text-[#23E250]" : "text-white"}`}
                    style={{ fontFamily: "Vazirmatn, sans-serif" }}
                  >
                    {lb}
                  </span>
                  <div
                    style={
                      cond === id
                        ? {
                            width: 22,
                            height: 22,
                            border: "2px solid #51BB70",
                            borderRadius: "50%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            filter: "drop-shadow(0 0 4px #23E250)",
                          }
                        : {
                            width: 22,
                            height: 22,
                            border: "2px solid rgba(255,255,255,0.6)",
                            borderRadius: "50%",
                          }
                    }
                  >
                    {cond === id && (
                      <div
                        style={{
                          width: 12,
                          height: 12,
                          background: "#51BB70",
                          borderRadius: "50%",
                        }}
                      />
                    )}
                  </div>
                </button>
              ))}
            </div>

            {res && (
              <GlassCard
                cls="p-5 afu"
                ch={
                  <div className="flex flex-col gap-2">
                    {[
                      { l: "وضعیت", v: res.status, c: "text-[#51BB70]" },
                      { l: "مالک", v: res.owner, c: "text-white" },
                      { l: "اپراتور", v: res.op, c: "text-white" },
                    ].map((row) => (
                      <div
                        key={row.l}
                        className="flex justify-between items-center border-b border-white/10 pb-2"
                        dir="rtl"
                      >
                        <span
                          className="text-white/60 text-sm"
                          style={{ fontFamily: "Vazirmatn, sans-serif" }}
                        >
                          {row.l}
                        </span>
                        <span
                          className={`${row.c} font-medium`}
                          style={{ fontFamily: "Vazirmatn, sans-serif" }}
                        >
                          {row.v}
                        </span>
                      </div>
                    ))}
                  </div>
                }
              />
            )}

            <div className="afu d3">
              <FieldSet
                label="نام"
                value={nm}
                onChange={(e) => setNm(onlyPersian(e.target.value))}
                error={nmErr}
                helperText={nmErr ? (nm ? "نام باید حداقل ۲ حرف فارسی باشد" : "این فیلد اجباری است") : undefined}
                dir="rtl"
              />
            </div>
            <div className="afu d3">
              <FieldSet
                label="نام خانوادگی"
                value={fm}
                onChange={(e) => setFm(onlyPersian(e.target.value))}
                error={fmErr}
                helperText={fmErr ? (fm ? "نام خانوادگی باید حداقل ۲ حرف فارسی باشد" : "این فیلد اجباری است") : undefined}
                dir="rtl"
              />
            </div>
            <div className="afu d4">
              <FieldSet
                label="شماره جهت ارتباط"
                type="tel"
                value={uph}
                onChange={(e) =>
                  setUph(toE(e.target.value).replace(/\D/g, "").slice(0, 11))
                }
                error={uphErr}
                helperText={
                  uphErr
                    ? !uph
                      ? "این فیلد اجباری است"
                      : "شماره باید ۱۱ رقم و با ۰۹ شروع شود"
                    : undefined
                }
                dir="rtl"
              />
            </div>

            <div className="afu d4">
              <HowKnow val={hk} onChange={setHk} forceError={submitted} />
            </div>

            <div className="flex gap-3 pb-6 afu d5">
              <Link
                href="/sell?tab=cons"
                className="flex-1 text-center py-3 rounded-xl border border-[#51BB70] text-[#51BB70] text-xs font-medium hover:bg-[#51BB70]/10 transition-colors"
                style={{ fontFamily: "Vazirmatn, sans-serif" }}
              >
                فروش امانی
              </Link>

              {/* دکمه تغییر یافته به button برای باز کردن مودال */}
              <button
                onClick={handleRealValueSubmit}
                className="flex-1 text-center py-3 rounded-xl border border-[#51BB70] text-[#51BB70] text-xs font-medium hover:bg-[#51BB70]/10 transition-colors"
                style={{ fontFamily: "Vazirmatn, sans-serif" }}
              >
                ارزش واقعی بازار
              </button>

              <Link
                href="/sell?tab=direct"
                className="flex-1 text-center py-3 rounded-xl border border-[#51BB70] text-[#51BB70] text-xs font-medium hover:bg-[#51BB70]/10 transition-colors"
                style={{ fontFamily: "Vazirmatn, sans-serif" }}
              >
                فروش سیمکارت
              </Link>
            </div>
          </div>
          <BottomLogo />

          {/* ── CONFIRM MODAL ── */}
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
                  <ConfirmRow label="شماره تماس" value={uph} />
                  <ConfirmRow label="شماره استعلام" value={ph} />
                  <ConfirmRow label="نوع سیم‌کارت" value={cond === "dry" ? "خشک" : "کارکرده"} />
                  <ConfirmRow label="نحوه آشنایی" value={hk} />
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
                      // بررسی نهایی شماره استعلام قبل از ارسال
                      if (!ph || !isSimQuery(ph)) {
                        setShowConfirm(false);
                        setSubmitted(true);
                        setTouched(true);
                        return;
                      }
                      try {
                        const res = await fetch("/api/forms/search", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            formType: "real_market_value",
                            formData: {
                              nm,
                              fm,
                              uph,
                              hk,
                              type: "real_market_value",
                              cond,
                              ph,
                            },
                          }),
                        });

                        const result = await res.json();
                        if (res.ok || res.status === 200 || res.status === 201) {
                          setShowConfirm(false);
                          // پاک‌سازی کامل localStorage پس از ثبت موفق
                          localStorage.removeItem("searchForm");
                          localStorage.removeItem("buyForm");
                          localStorage.removeItem("sellForm");
                          localStorage.removeItem("sellForm_draft");
                          localStorage.removeItem("investForm");
                          // Reset all form state so fields are cleared
                          setNm("");
                          setFm("");
                          setUph("");
                          setHk("");
                          setPh("");
                          setCond("used");
                          setRes(null);
                          setSubmitted(false);
                          setTouched(false);
                          // نمایش مودال موفقیت
                          setResultVariant("success");
                          setResultRequestId(result?.data?.id || "");
                          setResultMessage("");
                          setShowResult(true);
                        } else {
                          // نمایش مودال خطا
                          setResultVariant("error");
                          setResultRequestId(result?.error?.code || "");
                          setResultMessage(result?.error?.message || result?.message || "خطا در ثبت فرم");
                          setShowResult(true);
                        }
                      } catch {
                        // نمایش مودال خطای شبکه
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

          {/* ── RESULT MODAL (موفق / ناموفق) ── */}
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
      }
    />
  );
}

export default SearchPage;
