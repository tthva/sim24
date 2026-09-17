"use client";

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
  // Two-stage PRODUCT step (SELL_MARKET_SWAP): stage 2 «بررسی محصول» is the FIRST
  // product check (isFinal=false → Avablity renders disabled), stage 4 would be
  // the final one. Mirrors product-manager/buy's isFinalStep pattern.
  const [isFinalStep, setIsFinalStep] = useState(false);

  useEffect(() => {
    if (!stepInstanceId) return;
    setLoading(true);
    fetch(`/api/workflow/step/${stepInstanceId}`, { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        const inst = data.data?.instanceData || {};
        // Two-stage PRODUCT gating (mirrors product-manager/buy):
        //   stage 2 «بررسی محصول» → first-stage mode (isAvailable + ProductPrice
        //     active, Avablity disabled);
        //   stage 4 «حذف از سایت» → final-stage mode (ONLY Avablity editable +
        //     required, other ticks locked showing their saved values).
        // Stage 4 is not the workflow-final step (that's stage 5), so the
        // stepOrder check drives the gating, not step.isFinal alone.
        const stepOrder = Number(data.data?.step?.stepOrder);
        setIsFinalStep(stepOrder === 4 || !!data.data?.step?.isFinal);
        // DEBUG: بررسی مقدار قيمت سيم کارت ذخیره‌شده پس از بازگشایی تسک
        console.log("inst.ProductPrice:", inst.ProductPrice);
        const provinceId = inst.mProv || inst.dProv || inst.prov;
        const cityId = inst.mCity || inst.dCity || inst.city;
        const provinceName =
          provinces.find((p) => p.id === Number(provinceId))?.name || "—";
        const cityName =
          getCitiesOfProvince(Number(provinceId)).find(
            (c) => c.id === Number(cityId)
          )?.name || "—";
        // شماره دلخواه — عددی که مشتری می‌خواهد (بررسی موجودی آن در مرحله ۲)
        const desiredPhone =
          inst.mDesPh || inst.mSimPh || inst.ph || "—";
        const dry =
          inst.mCond === "new" ||
          inst.dCond === "new" ||
          inst.cond === "new";
        setInitialData({
            ...inst,
          province: provinceName,
          city: cityName,
          WantedContactNumber: desiredPhone,
          statusType: dry,
          customerPrice: inst.mPrice || inst.dPrice || "—",
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
      stepTitle="تعویض سیم کارت مرحله ۲"
      displayFields={["WantedContactNumber"]}
      inputFields={["isAvailable", "ProductPrice", "Avablity", "agentNote"]}
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
