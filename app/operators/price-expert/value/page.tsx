"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import RoleWorkflowPage from "@/components/WorkflowPage";

function InnerComponent() {
  const searchParams = useSearchParams();
  const stepInstanceId = searchParams?.get("stepInstanceId");
  const [initialData, setInitialData] = useState<any>(null);

  useEffect(() => {
    if (!stepInstanceId) return;
    fetch(`/api/workflow/step/${stepInstanceId}`, {
      credentials: "include",
    })
      .then((r) => r.json())
      .then((data) => {
        console.log("API response:", JSON.stringify(data));
        const inst = data.data?.instanceData || {};
        const phone = inst.ph || "—";
        const dry =
          inst.cond === "new" ||
          inst.dCond === "new" ||
          inst.status === "new" ||
          inst.simType === "new";
        setInitialData({
            ...inst,
          // شماره استعلام (خط 0912 در حال ارزش‌گذاری)
          SaleContactNumber: phone,
          // شماره تماس مشتری — uph فیلد اختصاصی فرم استعلام؛ fallback به ph
          contactNumber: inst.uph || inst.ph || "—",
          statusType: dry,
        });

        console.log("extracted phone:", phone);
        console.log("extracted dry:", dry);
        console.log("instanceData keys:", Object.keys(inst));
      })
      .catch(() => {
        setInitialData({
          SaleContactNumber: "—",
          contactNumber: "—",
          statusType: "کارکرده",
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

  if (!initialData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-white text-lg">در حال بارگذاری...</p>
      </div>
    );
  }

  return (
    <RoleWorkflowPage
      stepTitle="ارزش سیم کارت"
      displayFields={["SaleContactNumber", "contactNumber", "statusType"]}
      inputFields={["ValuePrice", "smsSent"]}
      initialData={initialData}
      stepInstanceId={stepInstanceId}
      redirectUrl="/operators/price-expert"
      smsFields={["contactNumber"]}
      smsGatedFields={["smsSent"]}
      />
  );
}

export default function PricingExpertPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><p className="text-white text-lg">در حال بارگذاری...</p></div>}>
      <InnerComponent />
    </Suspense>
  );
}
