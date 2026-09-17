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

  useEffect(() => {
    if (!stepInstanceId) return;
    setLoading(true);
    fetch(`/api/workflow/step/${stepInstanceId}`, { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        const inst = data.data?.instanceData || {};
        // فرم امانی: کلیدهای nm/fm/prov/city/sph/duration/price/cond
        const ownerCons = inst.nm && inst.fm ? `${inst.nm} ${inst.fm}`.trim() : "";
        const provinceId = inst.prov || inst.dProv || inst.mProv;
        const cityId = inst.city || inst.dCity || inst.mCity;
        const provinceName =
          provinces.find((p) => p.id === Number(provinceId))?.name || "—";
        const cityName =
          getCitiesOfProvince(Number(provinceId)).find(
            (c) => c.id === Number(cityId)
          )?.name || "—";
        const dry = inst.cond === "new" || inst.mCond === "new" || inst.dCond === "new";
        setInitialData({
            ...inst,
          // قیمت کارشناس — قیمت واردشده توسط کارشناس فروش در مرحله ۲ (OKPrice)
          PriceAgentNotes: inst.OKPrice || inst.PriceAgentNotes || inst.salePrice || inst.purchasePrice || "—",
          // شماره سیم کارت امانی از فرم امانی
          EscrowContactNumber: inst.sph || inst.mSimPh || inst.ph || "—",
          simOwner: ownerCons || inst.simOwner || inst.ownerName || "—",
          // قیمت پیشنهادی مشتری از فرم امانی
          customerPrice: inst.price || inst.customerPrice || "—",
          duration: inst.duration ? String(inst.duration).replace(" روز", "") : "—",
          province: provinceName,
          city: cityName,
          statusType: dry,
          contactNumber: inst.ph || inst.mPh || inst.dPh || "—",
          previousAgentNotes: inst.agentNote || inst.previousAgentNotes || "—",
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
      stepTitle="فروش امانی"
      displayFields={["PriceAgentNotes", "customerPrice", "EscrowContactNumber", "simOwner", "duration", "province", "city", "statusType", "contactNumber", "previousAgentNotes"]}
      inputFields={["Inputsite"]}
      initialData={initialData}
      stepInstanceId={stepInstanceId!}
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
