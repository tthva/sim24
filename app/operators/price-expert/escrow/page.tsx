
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

        const provinceId = inst.prov || inst.dProv || inst.mProv;
        const cityId = inst.city || inst.dCity || inst.mCity;

        const provinceName =
          provinceId !== undefined && provinceId !== null
            ? provinces.find((p: any) => p.id === Number(provinceId))?.name || "—"
            : "—";

        const cityName =
          provinceId !== undefined && provinceId !== null && cityId !== undefined && cityId !== null
            ? getCitiesOfProvince(Number(provinceId)).find((c: any) => c.id === Number(cityId))?.name || "—"
            : "—";

        const dry = inst.cond === "new" || inst.dCond === "new" || inst.mCond === "new";

        setInitialData({
            ...inst,
          customerPrice: inst.price || inst.customerPrice || "—",
          duration: inst.duration ? inst.duration.replace(" روز", "") : "—",
          EscrowContactNumber: inst.sph || inst.EscrowContactNumber || "—",
          province: provinceName,
          city: cityName,
          statusType: dry,
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
      stepTitle="فروش امانی"
      displayFields={["customerPrice", "duration", "EscrowContactNumber", "province", "city", "statusType"]}
      inputFields={["salePrice", "agentNote"]}
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
