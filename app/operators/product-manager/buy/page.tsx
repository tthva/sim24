'use client';
export const dynamic = 'force-dynamic';

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { provinces, getCitiesOfProvince } from "@/lib/iranData";
import RoleWorkflowPage from "@/components/WorkflowPage";

function InnerComponent() {
  const searchParams = useSearchParams();
  const stepInstanceId = searchParams?.get("stepInstanceId");
  const [initialData, setInitialData] = useState<any>({});
  // Two-stage PRODUCT step (BUY_DIRECT / BUY_INSTALLMENT): the same page renders
  // both PRODUCT stages; the step detail API exposes step.isFinal which tells us
  // whether this is the final product review (حذف از سایت stage).
  const [isFinalStep, setIsFinalStep] = useState(false);

  useEffect(() => {
    if (!stepInstanceId) return;
    fetch(`/api/workflow/step/${stepInstanceId}`, { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        const inst = data.data?.instanceData || {};
        setIsFinalStep(!!data.data?.step?.isFinal);

        const provinceId = inst.dProv || inst.mProv || inst.prov;
        const cityId = inst.dCity || inst.mCity || inst.city;

        const provinceName =
          provinceId !== undefined && provinceId !== null
            ? provinces.find((p) => p.id === Number(provinceId))?.name || "—"
            : "—";

        const cityName =
          provinceId !== undefined && provinceId !== null && cityId !== undefined && cityId !== null
            ? getCitiesOfProvince(Number(provinceId)).find((c) => c.id === Number(cityId))?.name || "—"
            : "—";

        const dry = inst.dCond === "new" || inst.mCond === "new" || inst.cond === "new";

        setInitialData({
            ...inst,
          province: provinceName,
          city: cityName,
          // BUY step: the customer's desired number is stored in `pref`
          // (BUY_DIRECT form). BUY_INSTALLMENT now also sends `pref`.
          BuyDesiredNumber: inst.pref || inst.BuyContactNumber || "—",
          statusType: dry,
          customerPrice: inst.dPrice || inst.mPrice || inst.price || "—",
        });
      });
  }, [stepInstanceId]);

  if (!stepInstanceId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-white text-lg">لطفاً از لیست تسک‌ها وارد شوید</p>
        <a
          href="/operators/product-manager"
          className="px-6 py-2 bg-[#51BB70] text-[#011B2C] rounded-xl font-bold"
        >
          بازگشت به داشبورد
        </a>
      </div>
    );
  }

  return (
    <RoleWorkflowPage
      stepTitle={isFinalStep ? "بررسی نهایی محصول" : "بررسی محصول"}
      displayFields={["BuyDesiredNumber"]}
      inputFields={["isAvailable", "ProductPrice", "Avablity", "agentNote"]}
      initialData={initialData}
      stepInstanceId={stepInstanceId ?? undefined}
      isFinalStep={isFinalStep}
      redirectUrl="/operators/product-manager"
      />
  );
}

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center min-h-screen gap-4">
          <p className="text-white text-lg">در حال بارگذاری...</p>
        </div>
      }
    >
      <InnerComponent />
    </Suspense>
  );
}
