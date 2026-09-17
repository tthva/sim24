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
        const ownerDirect = inst.dNm && inst.dFm ? `${inst.dNm} ${inst.dFm}`.trim() : "";
        const ownerCons = inst.nm && inst.fm ? `${inst.nm} ${inst.fm}`.trim() : "";
        const ownerMarket = inst.mNm && inst.mFm ? `${inst.mNm} ${inst.mFm}`.trim() : "";
        const provinceId = inst.dProv || inst.mProv || inst.prov;
        const cityId = inst.dCity || inst.mCity || inst.city;
        const provinceName =
          provinces.find((p) => p.id === Number(provinceId))?.name || "—";
        const cityName =
          getCitiesOfProvince(Number(provinceId)).find(
            (c) => c.id === Number(cityId)
          )?.name || "—";
        const phone = inst.dSimPh || inst.mSimPh || inst.ph || "—";
        setInitialData({
            ...inst,
          SaleContactNumber: phone,
          simOwner: ownerDirect || ownerCons || ownerMarket || inst.simOwner || inst.ownerName || "—",
          province: provinceName,
          city: cityName,
          contactNumber: inst.dPh || inst.mPh || "—",
          // قیمت فروش — قیمت کارشناس قیمت (مرحله ۱) نه قیمت پیشنهادی مشتری
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
      stepTitle="فروش سیم کارت"
      displayFields={["SaleContactNumber", "simOwner", "SalePrice"]}
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
