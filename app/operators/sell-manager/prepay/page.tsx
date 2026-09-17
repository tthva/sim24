'use client';

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import RoleWorkflowPage from "@/components/WorkflowPage";
import { computeEachInstallment } from "@/lib/installment";
import { provinces, getCitiesOfProvince, getCityById } from "@/lib/iranData";

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
        const provinceId = inst.prov || inst.dProv || inst.mProv;
        const cityId = inst.city || inst.dCity || inst.mCity;
        const provinceName =
          provinces.find((p) => p.id === Number(provinceId))?.name || "—";
        const cityName =
          getCitiesOfProvince(Number(provinceId)).find(
            (c) => c.id === Number(cityId)
          )?.name || getCityById(Number(cityId))?.name || "—";
        // مبلغ هر قسط — همان محاسبه سمت مشتری: (sp − dp) با احتساب سود اقساط ÷ mo
        const total = Number(String(inst.sp || inst.SimPrice || 0).replace(/[^\d]/g, ""));
        const prepay = Number(String(inst.dp || inst.SimPrepay || 0).replace(/[^\d]/g, ""));
        const months = Number(inst.mo || 0);
        const eachInstallment = months > 0 ? computeEachInstallment(total, prepay, months) : 0;
        setInitialData({
            ...inst,
          previousAgentNotes: inst.previousAgentNotes || inst.agentNote || inst.agentreport || "—",
          province: provinceName,
          city: cityName,
          simOwner: ownerDirect || ownerCons || ownerMarket || inst.simOwner || inst.ownerName || "—",
          contactNumber: inst.ph || inst.dPh || inst.mPh || "—",
          BuyContactNumber: inst.pref || inst.BuyContactNumber || "—",
          SimPrice: inst.sp || inst.price || inst.SimPrice || "—",
          SimPrepay: inst.dp || inst.SimPrepay || "—",
          prepaytype: inst.mo ? inst.mo + " ماه" : inst.prepaytype || "—",
          Simghest: eachInstallment > 0 ? eachInstallment : inst.ghest || inst.Simghest || "—",
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
            href="/operators/sell-manager"
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
      stepTitle="خرید اقساطی"
      displayFields={[
        "simOwner",
        "province",
        "city",
        "BuyContactNumber",
        "contactNumber",
        "SimPrice",
        "SimPrepay",
        "prepaytype",
        "Simghest",
        "previousAgentNotes",
      ]}
      inputFields={["mozakere", "paying", "confirm", "sanad", "agentreport"]}
      initialData={initialData}
      stepInstanceId={stepInstanceId!}
        redirectUrl="/operators/sell-manager"
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
