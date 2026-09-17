"use client";

export const dynamic = "force-dynamic";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import RoleWorkflowPage from "@/components/WorkflowPage";
import Link from "next/link";

function InnerComponent() {
  const searchParams = useSearchParams();
  const stepInstanceId = searchParams?.get("stepInstanceId");
  const [initialData, setInitialData] = useState<any>({});
  const [loading, setLoading] = useState(true);
  // نوع سرمایه‌گذاری (از instanceData.it) — عنوان صفحه را تعیین می‌کند
  const [investType, setInvestType] = useState<string | null>(null);

  useEffect(() => {
    if (!stepInstanceId) {
      setLoading(false);
      return;
    }
    let cancelled = false;

    async function loadStep() {
      try {
        const res = await fetch(`/api/workflow/step/${stepInstanceId}`, {
          credentials: "include",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        const inst = data.data?.instanceData || {};
        setInvestType(typeof inst.it === "string" ? inst.it : null);
        const ownerDirect = inst.dNm && inst.dFm ? `${inst.dNm} ${inst.dFm}`.trim() : "";
        const ownerCons = inst.nm && inst.fm ? `${inst.nm} ${inst.fm}`.trim() : "";
        const ownerMarket = inst.mNm && inst.mFm ? `${inst.mNm} ${inst.mFm}`.trim() : "";
        // نوع سرمایه‌گذاری به فارسی — از inst.it (installment | buy-sell)
        const investTypeFa =
          inst.it === "installment"
            ? "مشارکت در فروش اقساط با سود ثابت ماهانه"
            : inst.it === "buy-sell"
              ? "مشارکت در خرید و فروش (بانکداری سیم‌کارت ۰۹۱۲)"
              : null;
        setInitialData({
            ...inst,
          contactNumber: inst.ph || inst.dPh || inst.mPh || "—",
          // نمایش فارسی (در صورت نبود، مقدار خام)
          investmentType: investTypeFa || inst.investmentType || inst.it || "—",
          simOwner: ownerDirect || ownerCons || ownerMarket || inst.simOwner || inst.ownerName || "—",
        });
      } catch (err) {
        console.error("Failed to load step:", err);
        if (!cancelled) {
          setInitialData({
            contactNumber: "—",
            investmentType: "—",
            simOwner: "—",
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadStep();
    return () => {
      cancelled = true;
    };
  }, [stepInstanceId]);

  if (!stepInstanceId) {
    return (
      <div
        dir="rtl"
        className="min-h-screen text-white bg-[linear-gradient(180deg,var(--main-color)_0%,var(--secondary-color)_100%)] flex items-center justify-center p-4"
      >
        <div className="text-center bg-white/5 border border-white/10 rounded-3xl p-8 max-w-md w-full">
          <p className="text-white/80 mb-6">
            شناسه مرحله یافت نشد. لطفا از داشبورد وارد شوید.
          </p>
          <Link
            href="/operators/Investment"
            className="inline-flex w-full md:w-auto items-center justify-center h-12 px-8 rounded-2xl bg-green-500 text-white font-bold hover:bg-green-400 transition-colors shadow-lg shadow-green-500/20"
          >
            بازگشت به داشبورد
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div
        dir="rtl"
        className="min-h-screen flex items-center justify-center text-white bg-[linear-gradient(180deg,var(--main-color)_0%,var(--secondary-color)_100%)]"
      >
        <div className="animate-pulse">در حال بارگذاری...</div>
      </div>
    );
  }

  // عنوان صفحه بر اساس نوع سرمایه‌گذاری
  const stepTitle =
    investType === "installment"
      ? "سرمایه گذاری سود ثابت ماهانه"
      : investType === "buy-sell"
        ? "سرمایه گذاری خرید و فروش ۰۹۱۲"
        : "سرمایه گذاری";

  return (
    <RoleWorkflowPage
      stepTitle={stepTitle}
      displayFields={[
        "investmentType",
        "simOwner",
        "contactNumber",
      ]}
      inputFields={["investmentConfirm", "agentNote"]}
      initialData={initialData}
      stepInstanceId={stepInstanceId!}
        redirectUrl="/operators/Investment"
    />
  );
}

export default function PricingExpertPage() {
  return (
    <Suspense
      fallback={
        <div
          dir="rtl"
          className="min-h-screen flex items-center justify-center text-white bg-[linear-gradient(180deg,var(--main-color)_0%,var(--secondary-color)_100%)]"
        >
          <div className="animate-pulse">در حال بارگذاری...</div>
        </div>
      }
    >
      <InnerComponent />
    </Suspense>
  );
}
