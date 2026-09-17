'use client';

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import RoleWorkflowPage from "@/components/WorkflowPage";
import { provinces, getCitiesOfProvince } from "@/lib/iranData";

export const dynamic = 'force-dynamic';

function InnerComponent() {
  const searchParams = useSearchParams();
  const stepInstanceId = searchParams?.get("stepInstanceId");
  const [initialData, setInitialData] = useState<any>({});
  const [loading, setLoading] = useState(false);
  // Stage 4 of SELL_MARKET_SWAP is the FINAL PRODUCT step (isFinal=true):
  // finalize the SELL line (mSimPh) — فقط «وارد کردن در سایت» (Inputsite),
  // مانند مرحله نهایی خرید. SalePrice از salePrice مرحله ۱ می‌آید.
  const [isFinalStep, setIsFinalStep] = useState(false);

  useEffect(() => {
    if (!stepInstanceId) return;
    setLoading(true);
    fetch(`/api/workflow/step/${stepInstanceId}`, { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        const inst = data.data?.instanceData || {};
        setIsFinalStep(!!data.data?.step?.isFinal);
        const ownerDirect = inst.dNm && inst.dFm ? `${inst.dNm} ${inst.dFm}`.trim() : "";
        const ownerCons = inst.nm && inst.fm ? `${inst.nm} ${inst.fm}`.trim() : "";
        const ownerMarket = inst.mNm && inst.mFm ? `${inst.mNm} ${inst.mFm}`.trim() : "";
        const provinceId = inst.mProv || inst.dProv || inst.prov;
        const cityId = inst.mCity || inst.dCity || inst.city;
        const provinceName =
          provinces.find((p) => p.id === Number(provinceId))?.name || "—";
        const cityName =
          getCitiesOfProvince(Number(provinceId)).find(
            (c) => c.id === Number(cityId)
          )?.name || "—";
        const phone = inst.mSimPh || inst.dSimPh || inst.ph || "—";
        const dry =
          inst.mCond === "new" ||
          inst.dCond === "new" ||
          inst.cond === "new";
        setInitialData({
            ...inst,
          SaleContactNumber: phone,
          simOwner: ownerDirect || ownerCons || ownerMarket || inst.simOwner || inst.ownerName || "—",
          province: provinceName,
          city: cityName,
          contactNumber: inst.mPh || inst.dPh || "—",
          // «قیمت فروش» = قیمت کارشناس قیمت از مرحله ۱ (salePrice) — NOT the
          // customer's asking price (mPrice/dPrice).
          SalePrice: inst.salePrice || inst.SalePrice || "—",
        });
      })
      .catch((err) => console.error("Failed to load step:", err))
      .finally(() => setLoading(false));
  }, [stepInstanceId]);

  if (!stepInstanceId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#203253] to-[#11223d]">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center max-w-md">
          <p className="text-white text-lg mb-4">شناسه مرحله یافت نشد</p>
          <a
            href="/operators/product-manager"
            className="inline-block bg-[#4f7cff] text-white px-6 py-2 rounded-xl"
          >
            بازگشت به داشبورد
          </a>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#203253] to-[#11223d] text-white">
        در حال بارگذاری...
      </div>
    );
  }

  return (
    <RoleWorkflowPage
      stepTitle="تعویض سیم کارت مرحله ۴"
      displayFields={["SaleContactNumber", "simOwner", "SalePrice"]}
      inputFields={["Inputsite"]}
      initialData={initialData}
      stepInstanceId={stepInstanceId!}
      isFinalStep={isFinalStep}
        redirectUrl="/operators/product-manager"
    />
  );
}

export default function PricingExpertPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#203253] to-[#11223d] text-white">
          در حال بارگذاری...
        </div>
      }
    >
      <InnerComponent />
    </Suspense>
  );
}
