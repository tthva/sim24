"use client";
import { useState } from "react";
import Layout from "@/components/Layout";
import BottomLogo from "@/components/BottomLogo";
import GlassCard from "@/components/GlassCard";
import AcceptTerms from "@/components/AcceptTerms";
import SelectUS from "@/components/SelectUs";
import FieldSet from "@/components/FieldSet";
import HowKnow from "@/components/HowKnow";
import SuccessConfirmationModal from "@/components/ConfirmationModal";
import { onlyPersian } from "@/lib/form-validators";

type IT = "buy-sell" | "installment";

const toE = (s: string) =>
  s.replace(/[۰-۹]/g, (d) => (d.charCodeAt(0) - 1776).toString());
const isMobile = (v: string) => /^09\d{9}$/.test(toE(v));

const ChevronIcon = ({ open }: { open: boolean }) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    className={`transition-transform duration-300 ${open ? "rotate-180" : ""}`}
  >
    <path
      d="M4 6L8 10L12 6"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// کامپوننت برای نمایش ردیف‌های اطلاعات در مودال تایید
function ConfirmRow({
  label,
  value,
  isBadge = false,
}: {
  label: string;
  value: string | number;
  isBadge?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-3 px-4 rounded-xl bg-white/5 border border-white/5">
      <span className="text-sm text-white/60 font-medium">{label}</span>
      {isBadge ? (
        <span className="inline-flex items-center gap-2 text-sm text-[#23E250] bg-[#23E250]/10 px-3 py-1 rounded-full">
          <span className="w-2 h-2 rounded-full bg-[#23E250] shadow-[0_0_6px_#23E250]" />
          {value}
        </span>
      ) : (
        <span className="text-sm text-white font-medium">{value || "—"}</span>
      )}
    </div>
  );
}

function InvestPage() {
  const [it, setIt] = useState<IT | null>(null);
  const [nm, setNm] = useState("");
  const [fm, setFm] = useState("");
  const [ph, setPh] = useState("");
  const [hk, setHk] = useState("");
  const [acc, setAcc] = useState(false);

  const [submitted, setSubmitted] = useState(false);
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false); // State جدید برای مودال

  // وضعیت مودال نتیجه (موفق / ناموفق)
  const [showResult, setShowResult] = useState(false);
  const [resultVariant, setResultVariant] = useState<"success" | "error">("success");
  const [resultRequestId, setResultRequestId] = useState("");
  const [resultMessage, setResultMessage] = useState("");

  const about = `مجموعه سیمکارت ۲۴ آنلاین با تمرکز بر سه اصل بنیادین سرعت، احترام و کیفیت در ارائه خدمات و محصولات، در سال ۱۴۰۰ تأسیس شد.

  این مجموعه به مدیریت و بنیان‌گذاری سید احمد حسینی رامندی و با پشتوانه بیش از دو دهه تجربه مستمر در حوزه معاملات و فعالیت‌های تخصصی بازار تلفن همراه شکل گرفت. شناخت عمیق از بازار سیم‌کارت و درک صحیح دغدغه‌های مشتریان، انگیزه‌ای شد تا مجموعه‌ای تخصصی و قابل اعتماد راه‌اندازی شود؛ مجموعه‌ای که بتواند با ارائه مشاوره‌های کارآمد، معاملات امن و تحلیل دقیق بازار، فرآیند خرید و فروش سیم‌کارت را برای مخاطبان تسهیل کند.

  هدف سیمکارت ۲۴ آنلاین صرفاً انجام یک معامله نیست؛ بلکه تبدیل خرید سیم‌کارت به یک فرصت درآمدزایی و سرمایه‌گذاری امن برای مشتریان است.

  این مجموعه تاکنون با تکیه بر آموزش مستمر، ارتقاء دانش تخصصی و توسعه سرمایه انسانی، در مسیر پرورش تیمی حرفه‌ای و متعهد گام برداشته و همواره در تلاش است تا خدماتی سریع، شفاف و امن را در سراسر کشور ارائه دهد.

  مجموعه سیمکارت ۲۴ آنلاین تاکنون مفتخر بوده است که خدمات تخصصی خود را به بیش از ۲۰۰۰ مدیر و صاحب کسب‌وکار در سراسر کشور ارائه دهد؛ اعتمادی که سرمایه اصلی و ارزشمند این مجموعه به شمار می‌رود.

  در حال حاضر، این مجموعه با برخورداری از ۱۰ نمایندگی رسمی و ۱۰ نماینده فعال در حوزه سیم‌کارت در استان قم، شبکه‌ای منسجم و حرفه‌ای را برای ارائه خدمات سریع، امن و گسترده ایجاد کرده است. این ساختار سازمان‌یافته، امکان پاسخگویی مؤثر به نیاز مشتریان و انجام معاملات مطمئن را در سطحی وسیع فراهم ساخته است.

  علاوه بر این، مجموعه سیمکارت ۲۴ آنلاین با بهره‌مندی از تجربه همکاری با بیش از ۱۰۰ دفتر پیشخوان دولت در سراسر کشور، بستر ارائه خدمات حضوری و امن را برای هم‌میهنان عزیز فراهم کرده است. این شبکه همکاری گسترده، امکان انجام فرآیندهای قانونی و انتقال سند را با سرعت، دقت و اطمینان بیشتر در نقاط مختلف کشور میسر ساخته و دسترسی مشتریان را به خدمات مجموعه تسهیل نموده است.`;

  // تابع ثبت فرم - در صورت معتبر بودن، مودال باز می‌شود
  const doSubmit = () => {
    setSubmitted(true);
    if (it && nm && fm && ph && isMobile(ph) && acc) {
      setShowConfirm(true);
    }
  };

  const nmErr = submitted && nm.trim().length < 2;
  const fmErr = submitted && fm.trim().length < 2;
  const phErr = submitted && (!ph || !isMobile(ph));
  const accErr = submitted && !acc;
  const itErr = submitted && it === null;

  return (
    <Layout
      ch={
        <>
          <div className="px-6 pt-4 flex-1 flex flex-col gap-5">
            {/* باکس درباره سیم‌کارت */}
            <GlassCard
              cls="p-4 afu d1"
              ch={
                <>
                  <div
                    className="text-white font-bold text-lg text-right cursor-pointer flex items-center justify-between"
                    dir="rtl"
                    onClick={() => setOpen(!open)}
                  >
                    <span>درباره سیم کارت ۲۴</span>
                    <ChevronIcon open={open} />
                  </div>
                  {open && (
                    <p
                      className="text-white/80 text-sm text-right leading-7 mt-3"
                      dir="rtl"
                    >
                      {about}
                    </p>
                  )}
                </>
              }
            />

            {/* انتخاب نوع سرمایه‌گذاری */}
            <div className="flex flex-col gap-4 afu d2">
              {/* کارت مشارکت در فروش اقساط */}
              <GlassCard
                cls={`p-4 border-2 transition-all ${
                  it === "installment"
                    ? "border-[#51BB70]"
                    : "border-transparent"
                }`}
                ch={
                  <div className="flex flex-row-reverse items-start gap-3">
                    <input
                      type="radio"
                      name="investmentType"
                      id="installment"
                      checked={it === "installment"}
                      onChange={() => setIt("installment")}
                      className="mt-1 w-4 h-4 accent-[#51BB70]"
                    />
                    <label
                      htmlFor="installment"
                      className="flex-1 text-right cursor-pointer"
                      dir="rtl"
                    >
                      <div className="text-white font-bold text-base">
                        مشارکت در فروش اقساط با سود ثابت ماهانه
                      </div>
                      {it === "installment" && (
                        <p className="text-white/70 text-sm leading-6 mt-2">
                          مشارکت در فروش اقساط با سود ثابت ماهانه ۶٪ مشارکت در
                          خرید و فروش سیمکارت۰۹۱۲ بدون سود مشخص( با توجه به
                          تجربه بیش از ۴ساله ی ما بین ۵۰ تا ۱۰۰٪سالیانه) مشارکت
                          در فروش اقساط بدلیل فعال بودن همه روزه ی مجموعه ی ما و
                          معاملات سیمکارت بصورت اقساط دائم درحال جذب سرمایه گذار
                          برای پشتیبانی فروش اقساط میباشیم شما می‌توانید از
                          سرمایه گذاران ما بصورت حداقل ۶ماه و حداکثر ۱ سال قابل
                          تمدید باشید. درصورت ورود به سرمایه گذاری به میزان مبلغ
                          سرمایه سیمکارت مورد اقساط بنام شما میگردد.(بنام بودن
                          سیمکارت بمنزله مالکیت شما نمی‌باشد بلکه به منظور تضمین
                          سرمایه و جلب رضایت شما میباشد) پس از پایان تسویه اقساط
                          توسط خریدار سیمکارت از نام سرمایه گذار بنام خریدار
                          انتقال داده و پس از ان با سرمایه گذار تسویه میگردد
                        </p>
                      )}
                    </label>
                  </div>
                }
              />

              {/* کارت مشارکت در خرید و فروش */}
              <GlassCard
                cls={`p-4 border-2 transition-all ${
                  it === "buy-sell" ? "border-[#51BB70]" : "border-transparent"
                }`}
                ch={
                  <div className="flex flex-row-reverse items-start gap-3">
                    <input
                      type="radio"
                      name="investmentType"
                      id="buy-sell"
                      checked={it === "buy-sell"}
                      onChange={() => setIt("buy-sell")}
                      className="mt-1 w-4 h-4 accent-[#51BB70]"
                    />
                    <label
                      htmlFor="buy-sell"
                      className="flex-1 text-right cursor-pointer"
                      dir="rtl"
                    >
                      <div className="text-white font-bold text-base">
                        مشارکت در خرید و فروش (بانکداری سیمکارت ۰۹۱۲)
                      </div>
                      {it === "buy-sell" && (
                        <p className="text-white/70 text-sm leading-6 mt-2">
                          مشارکت در خرید و فروش سیمکارت ۰۹۱۲ بدون سود مشخص (بر
                          اساس تجربه بیش از ۴ ساله، سود سالیانه بین ۵۰ تا ۱۰۰
                          درصد متغیر بوده است).
                        </p>
                      )}
                    </label>
                  </div>
                }
              />
            </div>

            {itErr && (
              <p className="text-red-400 text-xs text-right -mt-3">
                انتخاب نوع سرمایه‌گذاری الزامی است
              </p>
            )}

            <SelectUS checked={checked} onChange={setChecked} />

            <div className="afu d4">
              <FieldSet
                label="نام"
                value={nm}
                onChange={(e) => setNm(onlyPersian(e.target.value))}
                error={nmErr}
                helperText={nmErr ? (nm ? "نام باید حداقل ۲ حرف فارسی باشد" : "این فیلد اجباری است") : undefined}
                dir="rtl"
              />
            </div>
            <div className="afu d5">
              <FieldSet
                label="نام خانوادگی"
                value={fm}
                onChange={(e) => setFm(onlyPersian(e.target.value))}
                error={fmErr}
                helperText={fmErr ? (fm ? "نام خانوادگی باید حداقل ۲ حرف فارسی باشد" : "این فیلد اجباری است") : undefined}
                dir="rtl"
              />
            </div>
            <div className="afu d6">
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
            <div className="afu d7">
              <HowKnow val={hk} onChange={setHk} forceError={submitted} />
            </div>

            <div className="flex flex-row-reverse items-center justify-between pb-6 afu d9">
              <button className="ba px-8" onClick={doSubmit}>
                ثبت
              </button>
              <AcceptTerms ch={acc} onChange={setAcc} showErr={accErr} />
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
                  <ConfirmRow
                    label="نوع سرمایه‌گذاری"
                    value={
                      it === "installment"
                        ? "مشارکت در فروش اقساط با سود ثابت ماهانه"
                        : "مشارکت در خرید و فروش (بانکداری سیمکارت ۰۹۱۲)"
                    }
                  />
                  <ConfirmRow label="نام" value={nm} />
                  <ConfirmRow label="نام خانوادگی" value={fm} />
                  <ConfirmRow label="شماره موبایل" value={ph} />
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
                      try {
                        const agentId = localStorage.getItem("agentId");
                        const url = "/api/investments" + (agentId ? `?agentId=${encodeURIComponent(agentId)}` : "");
                        const res = await fetch(url, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ it, nm, fm, ph, hk, acc }),
                        });

                        const result = await res.json();
                        if (res.ok || res.status === 200 || res.status === 201) {
                          setShowConfirm(false);
                          // پاک‌سازی کامل localStorage/Draft پس از دریافت res.ok یا status 200/201
                          localStorage.removeItem("investForm");
                          localStorage.removeItem("buyForm");
                          localStorage.removeItem("sellForm");
                          localStorage.removeItem("sellForm_draft");
                          localStorage.removeItem("searchForm");
                          // پاک‌سازی کامل فیلدهای فرم و حالت اعتبارسنجی — مطابق الگوی buy/sell/search
                          setIt(null);
                          setNm("");
                          setFm("");
                          setPh("");
                          setHk("");
                          setAcc(false);
                          setChecked(false);
                          setSubmitted(false);
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

export default InvestPage;
