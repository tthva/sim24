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

  useEffect(() => {
    if (!stepInstanceId) return;
    fetch(`/api/workflow/step/${stepInstanceId}`, { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        const inst = data.data?.instanceData || {};
        const phone = inst.dSimPh || inst.mSimPh || inst.ph || "—";
        const dry = inst.dCond === "new" || inst.mCond === "new" || inst.cond === "new";
        const customerPrice = inst.customerPrice || inst.dPrice || inst.mPrice || inst.price || "—";

        // Convert numeric IDs to province/city names
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

        setInitialData({
            ...inst,
          province: provinceName,
          city: cityName,
          SaleContactNumber: phone,
          statusType: dry,
          customerPrice: customerPrice,
        });
      });
  }, [stepInstanceId]);

  if (!stepInstanceId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-white text-lg">لطفاً از لیست تسک‌ها وارد شوید</p>
        <a
          href="/operators/price-expert"
          className="px-6 py-2 bg-[#51BB70] text-[#011B2C] rounded-xl font-bold"
        >
          بازگشت به داشبورد
        </a>
      </div>
    );
  }

  return (
    <RoleWorkflowPage
      stepTitle="فروش سیم کارت"
      displayFields={["province", "city", "SaleContactNumber", "statusType", "customerPrice"]}
      inputFields={["purchasePrice", "salePrice", "agentNote"]}
      initialData={initialData}
      stepInstanceId={stepInstanceId ?? undefined}
      redirectUrl="/operators/price-expert"
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