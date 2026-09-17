"use client";
import { useState } from "react";
import AcceptTerms from "@/components/AcceptTerms";
import FieldSet from "@/components/FieldSet";
import HowKnow from "@/components/HowKnow";
import FileUploadZone from "@/components/FileUploadZone";
import SuccessConfirmationModal from "@/components/ConfirmationModal";
import { onlyPersian } from "@/lib/form-validators";

const toE = (s: string) =>
  s.replace(/[۰-۹]/g, (d) => (d.charCodeAt(0) - 1776).toString());
const isMobile = (v: string) => /^09\d{9}$/.test(toE(v));

function ConfirmRow({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex items-start justify-between py-3 px-4 rounded-xl bg-white/5 border border-white/5 gap-4">
      <span className="text-sm text-white/60 font-medium whitespace-nowrap pt-0.5">
        {label}
      </span>
      <span className="text-sm text-white font-medium text-right break-words whitespace-pre-wrap">
        {value || "—"}
      </span>
    </div>
  );
}

function PrePage({
  attachmentIds,
  onAttachmentIdsChange,
}: {
  attachmentIds: string[];
  onAttachmentIdsChange?: (ids: string[]) => void;
}) {
  const [nm, setNm] = useState("");
  const [fm, setFm] = useState("");
  const [ph, setPh] = useState("");
  const [nt, setNt] = useState("");
  const [hk, setHk] = useState("");
  const [acc, setAcc] = useState(false);

  const [submitted, setSubmitted] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // وضعیت مودال نتیجه (موفق / ناموفق) — مطابق الگوی تب خرید نقدی
  const [showResult, setShowResult] = useState(false);
  const [resultVariant, setResultVariant] = useState<"success" | "error">(
    "success",
  );
  const [resultRequestId, setResultRequestId] = useState("");
  const [resultMessage, setResultMessage] = useState("");

  const doSubmit = () => {
    setSubmitted(true);
    if (nm && fm && ph && isMobile(ph) && nt && acc) {
      setShowConfirm(true);
    }
  };

  // پاک‌سازی کامل فیلدهای فرم و حالت اعتبارسنجی پس از ثبت موفق
  const resetForm = () => {
    setNm("");
    setFm("");
    setPh("");
    setNt("");
    setHk("");
    setAcc(false);
    setSubmitted(false);
    onAttachmentIdsChange?.([]);
  };

  const nmErr = submitted && nm.trim().length < 2;
  const fmErr = submitted && fm.trim().length < 2;
  const phErr = submitted && (!ph || !isMobile(ph));
  const ntErr = submitted && !nt;
  const accErr = submitted && !acc;

  return (
    <div className="flex flex-col gap-4">
      <div className="afu d1">
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
          onChange={(e) => setPh(toE(e.target.value).replace(/\D/g, "").slice(0, 11))}
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
      <div className="afu d4">
        <FieldSet
          label="توضیحات"
          multiline
          value={nt}
          onChange={(e) => setNt(e.target.value)}
          error={ntErr}
          helperText={ntErr ? "این فیلد اجباری است" : undefined}
          dir="rtl"
          rows={2}
          placeholder="توضیحات خود را بنویسید"
        />
      </div>
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

      {/* مودال تأیید */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#11223d]/60 backdrop-blur-sm">
          <div
            className="relative w-full max-w-lg mx-auto p-6 md:p-8 bg-white/5 backdrop-blur-xl border border-white/20 rounded-3xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.5)] overflow-y-auto max-h-[90vh]"
            style={{ direction: "rtl" }}
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-[#51BB70]">تأیید اطلاعات</h2>
              <button
                onClick={() => setShowConfirm(false)}
                className="flex items-center gap-1 px-4 py-1.5 text-sm font-medium text-white/70 border border-white/20 rounded-full hover:text-white hover:border-[#51BB70] hover:bg-white/5 transition-all"
              >
                ویرایش
              </button>
            </div>

            <div className="space-y-4 mb-8">
              <ConfirmRow label="نام" value={nm} />
              <ConfirmRow label="نام خانوادگی" value={fm} />
              <ConfirmRow label="شماره موبایل" value={ph} />
              <ConfirmRow label="توضیحات" value={nt} />
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
                    nt,
                    hk,
                    attachmentIds,
                  };
                  try {
                    const res = await fetch("/api/forms/buy", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        formType: "buy_preorder",
                        formData: payload,
                      }),
                    });
                    const result = await res.json();
                    if (res.ok || res.status === 200 || res.status === 201) {
                      setShowConfirm(false);
                      // پاک‌سازی کامل localStorage پس از ثبت موفق
                      localStorage.removeItem("sellForm");
                      localStorage.removeItem("buyForm");
                      localStorage.removeItem("sellForm_draft");
                      localStorage.removeItem("searchForm");
                      localStorage.removeItem("investForm");
                      // پاک‌سازی فرم و حالت اعتبارسنجی پس از ثبت موفق
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
    </div>
  );
}

export default PrePage;
