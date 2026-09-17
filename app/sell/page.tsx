"use client";
import { useState, useEffect, useRef } from "react";
import Layout from "@/components/Layout";
import BottomLogo from "@/components/BottomLogo";
import AcceptTerms from "@/components/AcceptTerms";
import FieldSet from "@/components/FieldSet";
import HowKnow from "@/components/HowKnow";
import Consignment from "@/components/Consignment";
import AutocompleteField from "@/components/AutocompleteField";
import FileUploadZone from "@/components/FileUploadZone";
import ConfirmModal, { ConfirmRow } from "@/components/ConfirmModal";
import SuccessConfirmationModal from "@/components/ConfirmationModal";
import { provinces, getCitiesOfProvince } from "@/lib/iranData";
import { getActiveReferralAgentId } from "@/lib/referral";
import DirectSellForm from "@/components/DirectSellForm";
import MarketSwapForm from "@/components/MarketSwapForm";
import { isValid0912 } from "@/lib/form-validators";

type Cond = "new" | "used";
type ST = "direct" | "cons" | "market";
type Own = "self" | "other";

const toE = (s: string) =>
  s.replace(/[۰-۹]/g, (d) => (d.charCodeAt(0) - 1776).toString());
const isMobile = (v: string) => /^09\d{9}$/.test(toE(v));

const formatPrice = (val: string) => {
  if (!val) return "";
  const num = toE(val).replace(/\D/g, "");
  return num.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

const pad2 = (s: string) => (s.length === 1 ? "0" + s : s);


const LS_KEY_SELL = "sellForm";
function SellPage() {
  const [st, setSt] = useState<ST>("direct");
  const [submitted, setSubmitted] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [acc, setAcc] = useState(false);
  const [ready, setReady] = useState(false);

  // Read tab from URL query params on mount (client-side only to avoid SSR issues)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab");
    if (tab && ["direct", "cons", "market"].includes(tab)) {
      setSt(tab as ST);
    }
  }, []);

  const [dNm, setDNm] = useState("");
  const [dFm, setDFm] = useState("");
  const [dPh, setDPh] = useState("");
  const [dProv, setDProv] = useState<number | "">("");
  const [dCity, setDCity] = useState<number | "">("");
  const [dBD, setDBD] = useState("");
  const [dBM, setDBM] = useState("");
  const [dBY, setDBY] = useState("");
  const [dOwn, setDOwn] = useState<Own>("other");
  const [dCond, setDCond] = useState<Cond>("used");
  const [dSimPh, setDSimPh] = useState("");
  const [dPrice, setDPrice] = useState("");
  const [dHk, setDHk] = useState("");

  // ====== فیلدهای تب تعویض سیم کارت (market) ======
  const [mNm, setMNm] = useState("");
  const [mFm, setMFm] = useState("");
  const [mPh, setMPh] = useState("");
  const [mProv, setMProv] = useState<number | "">("");
  const [mCity, setMCity] = useState<number | "">("");
  const [mBD, setMBD] = useState("");
  const [mBM, setMBM] = useState("");
  const [mBY, setMBY] = useState("");
  const [mPrice, setMPrice] = useState("");
  const [mSimPh, setMSimPh] = useState(""); // شماره فروشی
  const [mDesPh, setMDesPh] = useState(""); // شماره دلخواه
  const [mOwn, setMOwn] = useState<Own>("other");
  const [mCond, setMCond] = useState<Cond>("used");
  const [mHk, setMHk] = useState("");

  const [consData, setConsData] = useState<Record<string, any>>({
    own: "self",
    cond: "used",
  });
  const [attachmentIds, setAttachmentIds] = useState<string[]>([]);
  const [consResetKey, setConsResetKey] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const submitRef = useRef(false);

  // وضعیت مودال نتیجه (موفق / ناموفق)
  const [showResult, setShowResult] = useState(false);
  const [resultVariant, setResultVariant] = useState<"success" | "error">("success");
  const [resultRequestId, setResultRequestId] = useState("");
  const [resultMessage, setResultMessage] = useState("");

  const dCities = dProv ? getCitiesOfProvince(Number(dProv)) : [];
  const mCities = mProv ? getCitiesOfProvince(Number(mProv)) : [];

  // Restore from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LS_KEY_SELL);
      if (saved) {
        const d = JSON.parse(saved);
        if (d.st) setSt(d.st);
        if (d.acc !== undefined) setAcc(d.acc);
        if (d.dNm) setDNm(d.dNm);
        if (d.dFm) setDFm(d.dFm);
        if (d.dPh) setDPh(d.dPh);
        if (d.dProv) setDProv(d.dProv);
        if (d.dCity) setDCity(d.dCity);
        if (d.dBD) setDBD(d.dBD);
        if (d.dBM) setDBM(d.dBM);
        if (d.dBY) setDBY(d.dBY);
        if (d.dOwn) setDOwn(d.dOwn);
        if (d.dCond) setDCond(d.dCond);
        if (d.dSimPh) setDSimPh(d.dSimPh);
        if (d.dPrice) setDPrice(d.dPrice);
        if (d.dHk) setDHk(d.dHk);
        if (d.mNm) setMNm(d.mNm);
        if (d.mFm) setMFm(d.mFm);
        if (d.mPh) setMPh(d.mPh);
        if (d.mProv) setMProv(d.mProv);
        if (d.mCity) setMCity(d.mCity);
        if (d.mBD) setMBD(d.mBD);
        if (d.mBM) setMBM(d.mBM);
        if (d.mBY) setMBY(d.mBY);
        if (d.mPrice) setMPrice(d.mPrice);
        if (d.mSimPh) setMSimPh(d.mSimPh);
        if (d.mDesPh) setMDesPh(d.mDesPh);
        if (d.mOwn) setMOwn(d.mOwn);
        if (d.mCond) setMCond(d.mCond);
        if (d.mHk) setMHk(d.mHk);
        // Restore consignment tab data
        if (d.consData && typeof d.consData === "object") {
          setConsData((prev) => ({
            own: "self",
            cond: "used",
            ...prev,
            ...d.consData,
          }));
        }
      }
    } catch {}
    setReady(true);
  }, []);

  // Save to localStorage on every change
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(
        LS_KEY_SELL,
        JSON.stringify({
          st,
          acc,
          dNm,
          dFm,
          dPh,
          dProv,
          dCity,
          dBD,
          dBM,
          dBY,
          dOwn,
          dCond,
          dSimPh,
          dPrice,
          dHk,
          mNm,
          mFm,
          mPh,
          mProv,
          mCity,
          mBD,
          mBM,
          mBY,
          mPrice,
          mSimPh,
          mDesPh,
          mOwn,
          mCond,
          mHk,
          consData,
        }),
      );
    } catch {}
  }, [
    st,
    acc,
    dNm,
    dFm,
    dPh,
    dProv,
    dCity,
    dBD,
    dBM,
    dBY,
    dOwn,
    dCond,
    dSimPh,
    dPrice,
    dHk,
    mNm,
    mFm,
    mPh,
    mProv,
    mCity,
    mBD,
    mBM,
    mBY,
    mPrice,
    mSimPh,
    mDesPh,
    mOwn,
    mCond,
    mHk,
    consData,
    ready,
  ]);

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
  const handleConsignmentChange = (field: string, value: any) => {
    setConsData((prev) => ({ ...prev, [field]: value }));
  };

  const tabs: [ST, string][] = [
    ["direct", "فروش سیمکارت"],
    ["market", "تعویض سیمکارت"],
    ["cons", "فروش امانی"],
  ];

  const dNmE = submitted && st === "direct" && dNm.trim().length < 2;
  const dFmE = submitted && st === "direct" && dFm.trim().length < 2;
  const dPhE = submitted && st === "direct" && (!dPh || !isMobile(dPh));
  const dPrE = submitted && st === "direct" && !dProv;
  const dCiE = submitted && st === "direct" && !dCity;
  const dHkE = submitted && st === "direct" && !dHk;

  const dBdE = submitted && st === "direct" && (!dBD || !dBM || !dBY);
  const dPriceE =
    submitted &&
    st === "direct" &&
    (!dPrice || Number(dPrice.replace(/,/g, "")) <= 0);
  const accE = submitted && !acc;

  // ====== اعتبارسنجی تب تعویض ======
  const mNmE = submitted && st === "market" && mNm.trim().length < 2;
  const mFmE = submitted && st === "market" && mFm.trim().length < 2;
  const mPhE = submitted && st === "market" && (!mPh || !isMobile(mPh));
  const mPrE = submitted && st === "market" && !mProv;
  const mCiE = submitted && st === "market" && !mCity;
  const mPriceE =
    submitted &&
    st === "market" &&
    (!mPrice || Number(mPrice.replace(/,/g, "")) <= 0);
  const mSimPhE =
    submitted && st === "market" && (!mSimPh || !isValid0912(mSimPh));
  const mDesPhE =
    submitted && st === "market" && (!mDesPh || !isValid0912(mDesPh));
  const mHkE = submitted && st === "market" && !mHk;
  const mBdE = submitted && st === "market" && (!mBD || !mBM || !mBY);

  const handleSubmit = () => {
    setSubmitted(true);
    console.log("consData:", JSON.stringify(consData));
    console.log("acc:", acc);
    if (
      st === "direct" &&
      dNm &&
      dFm &&
      dPh &&
      isMobile(dPh) &&
      dProv &&
      dCity &&
      dHk &&
      acc &&
      dBD &&
      dBM &&
      dBY &&
      dSimPh &&
      isValid0912(dSimPh) &&
      dPrice &&
      Number(dPrice.replace(/,/g, "")) > 0
    )
      setShowConfirm(true);
    else if (
      st === "market" &&
      mNm &&
      mFm &&
      mPh &&
      isMobile(mPh) &&
      mProv &&
      mCity &&
      mPrice &&
      Number(mPrice.replace(/,/g, "")) > 0 &&
      mSimPh &&
      isValid0912(mSimPh) &&
      mDesPh &&
      isValid0912(mDesPh) &&
      mHk &&
      acc &&
      mBD &&
      mBM &&
      mBY
    )
      setShowConfirm(true);
    else if (
      st === "cons" &&
      consData.nm &&
      consData.fm &&
      consData.ph &&
      isMobile(consData.ph) &&
      consData.prov &&
      consData.city &&
      consData.birthDay &&
      consData.birthMonth &&
      consData.birthYear &&
      consData.sph &&
      isValid0912(consData.sph) &&
      consData.price &&
      consData.duration &&
      consData.hk &&
      acc
    )
      setShowConfirm(true);
  };

  return (
    <Layout
      ch={
        <>
          <div className="px-6 pt-4 flex-1 flex flex-col gap-5 relative">
            <div
              className="flex gap-0 rounded-xl overflow-hidden border-2 border-[#51BB70] afu d1 h-16"
              style={{ flexShrink: 0 }}
            >
              {tabs.map(([id, lb]) => (
                <button
                  key={id}
                  onClick={() => {
                    setSt(id);
                    setSubmitted(false);
                    setShowConfirm(false);
                  }}
                  className={`flex-1 py-2.5 text-s font-medium transition-all ${st === id ? "bg-[#51BB70] text-[#011B2C] font-bold" : "bg-transparent text-white/80 hover:text-white"}`}
                >
                  {lb}
                </button>
              ))}
            </div>

            {/* ====== تب فروش مستقیم ====== */}
            {st === "direct" && (
              <DirectSellForm
                submitted={submitted}
                dNm={dNm}
                dFm={dFm}
                dPh={dPh}
                dProv={dProv}
                dCity={dCity}
                dBD={dBD}
                dBM={dBM}
                dBY={dBY}
                dOwn={dOwn}
                dCond={dCond}
                dSimPh={dSimPh}
                dPrice={dPrice}
                dHk={dHk}
                dCities={dCities}
                provinces={provinces}
                dNmE={dNmE}
                dFmE={dFmE}
                dPhE={dPhE}
                dPrE={dPrE}
                dCiE={dCiE}
                dBdE={dBdE}
                dPriceE={dPriceE}
                dHkE={dHkE}
                setDNm={setDNm}
                setDFm={setDFm}
                setDPh={setDPh}
                setDProv={setDProv}
                setDCity={setDCity}
                setDBD={setDBD}
                setDBM={setDBM}
                setDBY={setDBY}
                setDOwn={setDOwn}
                setDCond={setDCond}
                setDSimPh={setDSimPh}
                setDPrice={setDPrice}
                setDHk={setDHk}
                isMobile={isMobile}
                formatPrice={formatPrice}
              />
            )}

            {st === "cons" && (
              <div className="afu flex flex-col gap-4">
                <Consignment
                  key={consResetKey}
                  submitted={submitted}
                  onFieldChange={handleConsignmentChange}
                  initialData={consData}
                />
              </div>
            )}

            {st === "market" && (
              <MarketSwapForm
                submitted={submitted}
                mNm={mNm}
                mFm={mFm}
                mPh={mPh}
                mProv={mProv}
                mCity={mCity}
                mBD={mBD}
                mBM={mBM}
                mBY={mBY}
                mPrice={mPrice}
                mSimPh={mSimPh}
                mDesPh={mDesPh}
                mOwn={mOwn}
                mCond={mCond}
                mHk={mHk}
                mCities={mCities}
                provinces={provinces}
                mNmE={mNmE}
                mFmE={mFmE}
                mPhE={mPhE}
                mPrE={mPrE}
                mCiE={mCiE}
                mPriceE={mPriceE}
                mSimPhE={mSimPhE}
                mDesPhE={mDesPhE}
                mHkE={mHkE}
                mBdE={mBdE}
                setMNm={setMNm}
                setMFm={setMFm}
                setMPh={setMPh}
                setMProv={setMProv}
                setMCity={setMCity}
                setMBD={setMBD}
                setMBM={setMBM}
                setMBY={setMBY}
                setMPrice={setMPrice}
                setMSimPh={setMSimPh}
                setMDesPh={setMDesPh}
                setMOwn={setMOwn}
                setMCond={setMCond}
                setMHk={setMHk}
                isMobile={isMobile}
                formatPrice={formatPrice}
              />
            )}

            {/* بارگذاری فایل — برای همه تب‌ها، بالای دکمه ثبت */}
            <FileUploadZone onAttachmentIdsChange={setAttachmentIds} />

            <div className="flex flex-row-reverse items-center justify-between pb-6 afu d6">
              <button className="ba px-8" onClick={handleSubmit}>
                ثبت
              </button>
              <AcceptTerms ch={acc} onChange={setAcc} showErr={accE} />
            </div>
          </div>
          <BottomLogo />

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
                  {st === "direct" && (
                    <>
                      <ConfirmRow label="نام" value={dNm} />
                      <ConfirmRow label="نام خانوادگی" value={dFm} />
                      <ConfirmRow label="شماره تماس" value={dPh} />
                      <ConfirmRow label="استان" value={provLabel(dProv)} />
                      <ConfirmRow label="شهر" value={cityLabel(dProv, dCity)} />
                      <ConfirmRow
                        label="تاریخ تولد"
                        value={`${dBY}/${dBM}/${dBD}`}
                      />
                      <ConfirmRow
                        label="مالک سیم‌کارت"
                        value={dOwn === "self" ? "خودم" : "دیگری"}
                        isBadge
                      />
                      <ConfirmRow
                        label="وضعیت سیم‌کارت"
                        value={dCond === "new" ? "خشک" : "کارکرده"}
                        isBadge
                      />
                      {dSimPh && (
                        <ConfirmRow label="شماره فروشی" value={dSimPh} />
                      )}
                      {dPrice && (
                        <ConfirmRow
                          label="قیمت پیشنهادی"
                          value={`${formatPrice(dPrice)} تومان`}
                        />
                      )}
                      {dHk && <ConfirmRow label="نحوه آشنایی" value={dHk} />}
                    </>
                  )}
                  {st === "market" && (
                    <>
                      <ConfirmRow label="نام" value={mNm} />
                      <ConfirmRow label="نام خانوادگی" value={mFm} />
                      <ConfirmRow label="شماره تماس" value={mPh} />
                      <ConfirmRow label="استان" value={provLabel(mProv)} />
                      <ConfirmRow label="شهر" value={cityLabel(mProv, mCity)} />
                      <ConfirmRow
                        label="تاریخ تولد"
                        value={`${mBY}/${mBM}/${mBD}`}
                      />
                      <ConfirmRow
                        label="قیمت"
                        value={`${formatPrice(mPrice) || "—"} تومان`}
                      />
                      <ConfirmRow label="شماره فروشی" value={mSimPh} />
                      <ConfirmRow label="شماره دلخواه" value={mDesPh} />
                      <ConfirmRow
                        label="مالک سیم‌کارت"
                        value={mOwn === "self" ? "خودم" : "دیگری"}
                        isBadge
                      />
                      <ConfirmRow
                        label="وضعیت سیم‌کارت"
                        value={mCond === "new" ? "خشک" : "کارکرده"}
                        isBadge
                      />
                      {mHk && <ConfirmRow label="نحوه آشنایی" value={mHk} />}
                    </>
                  )}
                  {st === "cons" && (
                    <>
                      <ConfirmRow label="نام" value={consData.nm || "—"} />
                      <ConfirmRow
                        label="نام خانوادگی"
                        value={consData.fm || "—"}
                      />
                      <ConfirmRow
                        label="شماره تماس"
                        value={consData.ph || "—"}
                      />
                      <ConfirmRow
                        label="استان"
                        value={provLabel(consData.prov)}
                      />
                      <ConfirmRow
                        label="شهر"
                        value={cityLabel(consData.prov, consData.city)}
                      />
                      <ConfirmRow
                        label="تاریخ تولد"
                        value={`${consData.birthYear || "—"}/${consData.birthMonth || "—"}/${consData.birthDay || "—"}`}
                      />
                      <ConfirmRow
                        label="شماره امانت"
                        value={consData.sph || "—"}
                      />
                      <ConfirmRow
                        label="قیمت توافقی"
                        value={formatPrice(consData.price || "")}
                      />
                      <ConfirmRow
                        label="مدت زمان"
                        value={consData.duration || "—"}
                      />
                      <ConfirmRow
                        label="مالک سیم‌کارت"
                        value={consData.own === "self" ? "خودم" : "دیگری"}
                        isBadge
                      />
                      <ConfirmRow
                        label="وضعیت سیم‌کارت"
                        value={consData.cond === "new" ? "خشک" : "کارکرده"}
                        isBadge
                      />
                      {consData.hk && (
                        <ConfirmRow label="نحوه آشنایی" value={consData.hk} />
                      )}
                    </>
                  )}
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
                      if (submitRef.current) return;
                      submitRef.current = true;
                      setSubmitting(true);
                      let formType: string;
                      let formData: Record<string, unknown>;
                      if (st === "direct") {
                        formType = "sell_direct";
                                                formData = {
                          dNm,
                          dFm,
                          dPh,
                          dProv,
                          dCity,
                          dBD: pad2(dBD),
                          dBM: pad2(dBM),
                          dBY,
                          dOwn,
                          dCond,
                          dSimPh,
                          dPrice,
                          dHk,
                          attachmentIds,
                        };
                      } else if (st === "market") {
                        formType = "sell_market";
                        formData = {
                          mNm,
                          mFm,
                          mPh,
                          mProv,
                          mCity,
                          mBD: pad2(mBD),
                          mBM: pad2(mBM),
                          mBY,
                          mPrice,
                          mOwn,
                          mCond,
                          mHk,
                          mDesPh,
                          mSimPh,
                          attachmentIds,
                        };
                      } else {
                        formType = "sell_cons";
                        formData = {
                          ...consData,
                          birthDay: pad2(consData.birthDay),
                          birthMonth: pad2(consData.birthMonth),
                          prov: Number(consData.prov),
                          city: Number(consData.city),
                          attachmentIds,
                        };
                      }
                      try {
                        const agentId = getActiveReferralAgentId();
                        const url =
                          "/api/forms/sell" +
                          (agentId
                            ? `?agentId=${encodeURIComponent(agentId)}`
                            : "");
                        const res = await fetch(url, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ formType, formData }),
                        });
                        console.log("FULL URL:", url);
                        console.log("FULL formType:", formType);
                        console.log("FULL formData:", JSON.stringify(formData));
                        console.log("FULL payload body:", JSON.stringify({ formType, formData }));
                        const result = await res.json();
                        console.log("API response:", JSON.stringify(result));
                        if (
                          res.ok ||
                          res.status === 200 ||
                          res.status === 201
                        ) {
                          setShowConfirm(false);
                          // پاک‌سازی کامل localStorage پس از ثبت موفق
                          localStorage.removeItem("sellForm");
                          localStorage.removeItem("buyForm");
                          localStorage.removeItem("sellForm_draft");
                          localStorage.removeItem("searchForm");
                          localStorage.removeItem("investForm");
                          // Reset all form state
                          setDNm("");
                          setDFm("");
                          setDPh("");
                          setDProv("");
                          setDCity("");
                          setDBD("");
                          setDBM("");
                          setDBY("");
                          setDOwn("other");
                          setDCond("used");
                          setDSimPh("");
                          setDPrice("");
                          setDHk("");
                          setMNm("");
                          setMFm("");
                          setMPh("");
                          setMProv("");
                          setMCity("");
                          setMBD("");
                          setMBM("");
                          setMBY("");
                          setMPrice("");
                          setMSimPh("");
                          setMDesPh("");
                          setMOwn("other");
                          setMCond("used");
                          setMHk("");
                          setConsData({ own: "self", cond: "used" });
                          setConsResetKey((k) => k + 1);
                          setAttachmentIds([]);
                          setAcc(false);
                          setSubmitted(false);
                          // نمایش مودال موفقیت
                          setResultVariant("success");
                          setResultRequestId(result.data?.id || "");
                          setResultMessage("");
                          setShowResult(true);
                        } else {
                          // نمایش مودال خطا
                          setResultVariant("error");
                          setResultRequestId(result?.error?.code || "");
                          setResultMessage(
                            result?.error?.message || result?.message || "خطا در ثبت فرم",
                          );
                          setShowResult(true);
                        }
                      } catch {
                        // نمایش مودال خطای شبکه
                        setResultVariant("error");
                        setResultRequestId("");
                        setResultMessage("خطا در ارسال اطلاعات");
                        setShowResult(true);
                      } finally {
                        submitRef.current = false;
                        setSubmitting(false);
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

export default SellPage;

