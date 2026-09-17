"use client";
import { useState, useEffect, useRef } from "react";
import Layout from "@/components/Layout";
import BottomLogo from "@/components/BottomLogo";
import AcceptTerms from "@/components/AcceptTerms";
import FieldSet from "@/components/FieldSet";
import HowKnow from "@/components/HowKnow";
import Preorder from "@/components/preorder";
import Installment from "@/components/installment";
import FileUploadZone from "@/components/FileUploadZone";
import ConfirmModal, { ConfirmRow } from "@/components/ConfirmModal";
import SuccessConfirmationModal from "@/components/ConfirmationModal";
import { getActiveReferralAgentId } from "@/lib/referral";
import AutocompleteField from "@/components/AutocompleteField";
import { provinces, getCitiesOfProvince } from "@/lib/iranData";
import { onlyPersian, clampDay, clampMonth, clampYear, isValid0912 } from "@/lib/form-validators";

type PT = "cash" | "inst" | "pre";

const toE = (s: string) =>
  s.replace(/[۰-۹]/g, (d) => (d.charCodeAt(0) - 1776).toString());
const isMobile = (v: string) => /^09\d{9}$/.test(toE(v));

const pad2 = (s: string) => (s.length === 1 ? "0" + s : s);

function BuyPage() {
  const LS_KEY = "buyForm";
  const [pt, setPt] = useState<PT>("cash");
  const [nm, setNm] = useState("");
  const [fm, setFm] = useState("");
  const [ph, setPh] = useState("");
  const [prov, setProv] = useState<number | "">("");
  const [city, setCity] = useState<number | "">("");
  const [pref, setPref] = useState("");
  const [hk, setHk] = useState("");
  const [acc, setAcc] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [birthDay, setBirthDay] = useState("");
  const [birthMonth, setBirthMonth] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [ready, setReady] = useState(false);
  const [attachmentIds, setAttachmentIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const submitRef = useRef(false);

  const cities = prov ? getCitiesOfProvince(Number(prov)) : [];

  // تبدیل شناسه عددی به نام برای نمایش در مودال تأیید
  const provLabel = (id: number | "") => {
    if (!id) return "";
    return provinces.find((p) => p.id === id)?.name ?? String(id);
  };
  const cityLabel = (pId: number | "", cId: number | "") => {
    if (!pId || !cId) return "";
    return (
      getCitiesOfProvince(Number(pId)).find((c) => c.id === cId)?.name ??
      String(cId)
    );
  };

  // وضعیت مودال نتیجه (موفق / ناموفق)
  const [showResult, setShowResult] = useState(false);
  const [resultVariant, setResultVariant] = useState<"success" | "error">("success");
  const [resultRequestId, setResultRequestId] = useState("");
  const [resultMessage, setResultMessage] = useState("");

  // Restore from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LS_KEY);
      if (saved) {
        const d = JSON.parse(saved);
        if (d.pt) setPt(d.pt);
        if (d.nm) setNm(d.nm);
        if (d.fm) setFm(d.fm);
        if (d.ph) setPh(d.ph);
        // prov/city اکنون شناسه عددی هستند؛ درفت‌های قدیمی (نام رشته‌ای) نادیده گرفته می‌شوند
        if (d.prov && provinces.some((p) => p.id === d.prov)) {
          setProv(d.prov);
          if (d.city) setCity(d.city);
        }
        if (d.pref) setPref(d.pref);
        if (d.hk) setHk(d.hk);
        if (d.acc !== undefined) setAcc(d.acc);
        if (d.birthDay) setBirthDay(d.birthDay);
        if (d.birthMonth) setBirthMonth(d.birthMonth);
        if (d.birthYear) setBirthYear(d.birthYear);
        if (d.attachmentIds && Array.isArray(d.attachmentIds)) setAttachmentIds(d.attachmentIds);
      }
    } catch {}
    setReady(true);
  }, []);

  // Save to localStorage on every change
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ pt, nm, fm, ph, prov, city, pref, hk, acc, birthDay, birthMonth, birthYear, attachmentIds }));
    } catch {}
  }, [pt, nm, fm, ph, prov, city, pref, hk, acc, birthDay, birthMonth, birthYear, attachmentIds, ready]);

  // پاک‌سازی کامل localStorage پس از ثبت موفق
  const clearSaved = () => {
    try {
      localStorage.removeItem("buyForm");
      localStorage.removeItem("sellForm");
      localStorage.removeItem("sellForm_draft");
      localStorage.removeItem("searchForm");
      localStorage.removeItem("investForm");
    } catch {}
  };

  const tabs: [PT, string][] = [
    ["cash", "خرید نقدی"],
    ["inst", "خرید اقساطی"],
    ["pre", "پیش سفارش"],
  ];

  const nmErr = submitted && nm.trim().length < 2;
  const fmErr = submitted && fm.trim().length < 2;
  const phErr = submitted && (!ph || !isMobile(ph));
  const provErr = submitted && !prov;
  const cityErr = submitted && !city;
  const bdErr = submitted && (!birthDay || !birthMonth || !birthYear);
  const accErr = submitted && !acc;
  const hkErr = submitted && !hk;
  const prefErr = submitted && pref !== "" && !isValid0912(pref);

  const handleSubmit = () => {
    setSubmitted(true);
    const isValid = nm && fm && ph && isMobile(ph) && prov && city && birthDay && birthMonth && birthYear && acc && hk && (!pref || isValid0912(pref));
    if (isValid) setShowConfirm(true);
  };

  const handleConfirmFinal = async () => {
    if (submitRef.current) return;
    submitRef.current = true;
    setSubmitting(true);
    try {
      const agentId = getActiveReferralAgentId();
      const res = await fetch("/api/forms/buy" + (agentId ? "?agentId=" + encodeURIComponent(agentId) : ""), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          formType: "buy_direct",
          formData: { nm, fm, ph, prov, city, birthDay: pad2(birthDay), birthMonth: pad2(birthMonth), birthYear, pref: pref || undefined, hk, attachmentIds },
        }),
      });
      const result = await res.json();
      if (res.ok || res.status === 200 || res.status === 201) {
        setShowConfirm(false);
        clearSaved();
        // Reset all form state
        setNm(""); setFm(""); setPh(""); setProv(""); setCity("");
        setPref(""); setHk(""); setAcc(false); setSubmitted(false);
        setBirthDay(""); setBirthMonth(""); setBirthYear("");
        setAttachmentIds([]);
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
    } catch (err) {
      // نمایش مودال خطای شبکه
      setResultVariant("error");
      setResultRequestId("");
      setResultMessage("خطا در ارسال اطلاعات");
      setShowResult(true);
    } finally {
      submitRef.current = false;
      setSubmitting(false);
    }
  };

  const handleEdit = () => { setShowConfirm(false); };

  return (
    <Layout
      ch={
        <>
          <div className="px-6 pt-4 flex-1 flex flex-col gap-5" style={{ maxWidth: "100%", width: "100%" }}>
            <div className="flex gap-0 rounded-xl overflow-hidden border-2 border-[#51BB70] afu d1 h-16" style={{ flexShrink: 0 }}>
              {tabs.map(([id, lb]) => (
                <button
                  key={id}
                  onClick={() => { setPt(id); setSubmitted(false); setShowConfirm(false); }}
                  className={`flex-1 py-2.5 text-s font-medium transition-all ${pt === id ? "bg-[#51BB70] text-[#011B2C] font-bold" : "bg-transparent text-white/80 hover:text-white"}`}
                >
                  {lb}
                </button>
              ))}
            </div>

            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
              {pt === "inst" && (
                <div className="flex flex-col gap-4">
                  <Installment attachmentIds={attachmentIds} onAttachmentIdsChange={setAttachmentIds} />
                </div>
              )}
              {pt === "pre" && (
                <div className="flex flex-col gap-4">
                  <Preorder attachmentIds={attachmentIds} onAttachmentIdsChange={setAttachmentIds} />
                </div>
              )}

              {pt === "cash" && (
                <div className="flex flex-col gap-4">
                  <div className="afu d2">
                    <FieldSet label="نام" value={nm} onChange={(e) => setNm(onlyPersian(e.target.value))} error={nmErr} helperText={nmErr ? (nm ? "نام باید حداقل ۲ حرف فارسی باشد" : "این فیلد اجباری است") : undefined} dir="rtl" />
                  </div>
                  <div className="afu d3">
                    <FieldSet label="نام خانوادگی" value={fm} onChange={(e) => setFm(onlyPersian(e.target.value))} error={fmErr} helperText={fmErr ? (fm ? "نام خانوادگی باید حداقل ۲ حرف فارسی باشد" : "این فیلد اجباری است") : undefined} dir="rtl" />
                  </div>
                  <div className="afu d4">
                    <FieldSet label="شماره موبایل" type="tel" value={ph} onChange={(e) => setPh(toE(e.target.value).replace(/\D/g, "").slice(0, 11))} error={phErr} helperText={phErr ? (!ph ? "این فیلد اجباری است" : "شماره باید ۱۱ رقم و با ۰۹ شروع شود") : undefined} dir="rtl" />
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
                        dir="rtl"
                        openOnFocus
                      />
                    </div>
                    <div className="flex-1">
                      <AutocompleteField
                        key={prov}
                        label="شهر"
                        options={cities}
                        value={city}
                        onChange={(id) => setCity(id as number)}
                        error={cityErr}
                        helperText={cityErr ? "این فیلد اجباری است" : undefined}
                        dir="rtl"
                        disabled={!prov}
                        openOnFocus
                      />
                    </div>
                  </div>
                  <div className="afu d4">
                    <label className="text-white text-sm font-medium mb-2 block text-right" dir="rtl">تاریخ تولد</label>
                    <div className="flex gap-2 items-center justify-end" dir="rtl">
                      <div className="flex-1">
                        <FieldSet label="روز" value={birthDay} onChange={(e) => { const v = toE(e.target.value).replace(/\D/g, "").slice(0, 2); setBirthDay(Number(v) > 31 ? "31" : v); }} onBlur={(e) => setBirthDay(clampDay(e.target.value))} error={bdErr && !birthDay} dir="rtl" />
                      </div>
                      <span className="text-white/60 font-bold">/</span>
                      <div className="flex-1">
                        <FieldSet label="ماه" value={birthMonth} onChange={(e) => { const v = toE(e.target.value).replace(/\D/g, "").slice(0, 2); setBirthMonth(Number(v) > 12 ? "12" : v); }} onBlur={(e) => setBirthMonth(clampMonth(e.target.value))} error={bdErr && !birthMonth} dir="rtl" />
                      </div>
                      <span className="text-white/60 font-bold">/</span>
                      <div className="flex-1" style={{ minWidth: 80 }}>
                        <FieldSet label="سال" value={birthYear} onChange={(e) => setBirthYear(toE(e.target.value).replace(/\D/g, "").slice(0, 4))} onBlur={(e) => setBirthYear(clampYear(e.target.value))} error={bdErr && !birthYear} dir="rtl" />
                      </div>
                    </div>
                    {bdErr && (
                      <div className="text-[#FF6B6B] text-xs text-right mt-1" dir="rtl">
                        تاریخ تولد اجباری است
                      </div>
                    )}
                  </div>
                  <div className="afu d5">
                    <FieldSet label="شماره دلخواه" value={pref} onChange={(e) => setPref(toE(e.target.value).replace(/\D/g, "").slice(0, 11))} error={prefErr} helperText={prefErr ? "شماره دلخواه باید با 0912 شروع شود" : undefined} dir="rtl" />
                  </div>
                  <div className="afu d6">
                    <HowKnow val={hk} onChange={setHk} forceError={submitted} />
                  </div>
                  {/* بارگذاری فایل — بالای دکمه ثبت */}
                  <FileUploadZone onAttachmentIdsChange={setAttachmentIds} />

                  <div className="flex flex-row-reverse items-center justify-between pb-6 afu d6">
                    <button className="ba px-8" onClick={handleSubmit}>ثبت</button>
                    <AcceptTerms ch={acc} onChange={setAcc} showErr={accErr} />
                  </div>
                </div>
              )}
            </div>
          </div>
          <BottomLogo />

          <ConfirmModal
            title="تأیید اطلاعات خرید"
            open={showConfirm}
            onClose={handleEdit}
            onConfirm={handleConfirmFinal}
            loading={submitting}
          >
            <ConfirmRow label="نام" value={nm} />
            <ConfirmRow label="نام خانوادگی" value={fm} />
            <ConfirmRow label="شماره موبایل" value={ph} />
            <ConfirmRow label="شهر" value={cityLabel(prov, city)} />
            <ConfirmRow label="استان" value={provLabel(prov)} />
            <ConfirmRow label="تاریخ تولد" value={`${birthYear}/${birthMonth}/${birthDay}`} />
            <ConfirmRow label="شماره دلخواه" value={pref || "—"} />
            <ConfirmRow label="نحوه آشنایی" value={hk} />
          </ConfirmModal>

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

export default BuyPage;