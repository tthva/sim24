"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

type StepDetail = {
  stepInstanceId: string;
  status: string;
  step: {
    id: string;
    title: string;
    code: string;
    department: string;
    stepOrder: number;
    formSchema: unknown;
    allowedActions: string[];
    isInitial: boolean;
    isFinal: boolean;
    slaHours: number | null;
    rejectBehavior: string;
  };
  workflow: {
    code: string;
    title: string;
  };
  instanceData: Record<string, any>;
  assignedTo: { id: string; name: string | null } | null;
  dueAt: string | null;
  createdAt: string;
};

export default function WorkflowStepDetailPage() {
  const params = useParams();
  const stepInstanceId = params.stepInstanceId as string;

  const [detail, setDetail] = useState<StepDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!stepInstanceId) return;
    const fetchDetail = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/workflow/step/${stepInstanceId}`, {
          credentials: "include",
        });
        const json = await res.json();
        if (!res.ok) {
          setError(json.error || "خطا در دریافت جزئیات");
        } else {
          setDetail(json.data);
        }
      } catch (e) {
        setError("خطا در ارتباط با سرور");
      } finally {
        setLoading(false);
      }
    };
    fetchDetail();
  }, [stepInstanceId]);

  const getDashboardLink = (department: string) => {
    switch (department) {
      case "PRICE":
        return "/operators/price-expert";
      case "SELL":
        return "/operators/sell-manager";
      case "PRODUCT":
        return "/operators/product-manager";
      case "INVESTMENT":
        return "/operators/Investment";
      default:
        return "/operators/price-expert";
    }
  };

  const formatPrice = (value: any) => {
    if (value === null || value === undefined || value === "") return "—";
    const num = typeof value === "string" ? parseFloat(value.toString().replace(/[^\d.-]/g, "")) : value;
    if (isNaN(num)) return value;
    return num.toLocaleString("en-US") + " تومان";
  };

  const renderField = (key: string, value: any) => {
    if (value === null || value === undefined || value === "") return null;
    const isPrice = /price|cost|amount|purchase|sale|pay|prepay|qest|down/i.test(key);
    return (
      <div key={key} className="bg-white/5 border border-white/10 rounded-xl p-4">
        <p className="text-xs text-white/50 mb-1">{key}</p>
        <p className="font-bold text-white break-words">
          {isPrice ? formatPrice(value) : String(value)}
        </p>
      </div>
    );
  };

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-gradient-to-b from-[#203253] to-[#11223d] text-white p-4 md:p-6"
    >
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <Link
              href={detail ? getDashboardLink(detail.step.department) : "/operators/price-expert"}
              className="text-sm text-white/50 hover:text-white transition"
            >
              ← داشبورد
            </Link>
            <h1 className="text-2xl md:text-3xl font-bold mt-2">
              {loading ? "در حال بارگذاری..." : detail?.step.title || "جزئیات وظیفه"}
            </h1>
            {detail && (
              <p className="text-white/60 mt-1">
                {detail.workflow.title} ({detail.workflow.code}) — مرحله {detail.step.stepOrder}
              </p>
            )}
          </div>
          {detail && (
            <span className="text-xs px-3 py-1 rounded-full border border-white/10 bg-white/5 text-white/70">
              {detail.step.department}
            </span>
          )}
        </div>

        {error ? (
          <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-8 text-center">
            <p className="text-3xl mb-3">⚠️</p>
            <p className="text-red-300">{error}</p>
          </div>
        ) : loading ? (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center text-white/50">
            در حال بارگذاری...
          </div>
        ) : detail ? (
          <>
            {/* اطلاعات مشتری و وضعیت */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-white/50 mb-1">وضعیت</p>
                <p className="font-bold text-white">{detail.status}</p>
              </div>
              <div>
                <p className="text-xs text-white/50 mb-1">اختصاص به</p>
                <p className="font-bold text-white">
                  {detail.assignedTo?.name || "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-white/50 mb-1">تاریخ ایجاد</p>
                <p className="font-bold text-white">
                  {new Date(detail.createdAt).toLocaleDateString("fa-IR")}
                </p>
              </div>
            </div>

            {/* داده‌های فرم */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
              <h2 className="text-xl font-bold mb-4">داده‌های فرم</h2>
              {detail.instanceData && Object.keys(detail.instanceData).length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {Object.entries(detail.instanceData).map(([key, value]) =>
                    renderField(key, value)
                  )}
                </div>
              ) : (
                <p className="text-white/50 text-center py-6">
                  داده‌ای ثبت نشده است
                </p>
              )}
            </div>

            {/* اقدامات مجاز */}
            {detail.step.allowedActions?.length > 0 && (
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
                <h2 className="text-xl font-bold mb-4">اقدامات</h2>
                <div className="flex flex-wrap gap-2">
                  {detail.step.allowedActions.map((action) => (
                    <span
                      key={action}
                      className="text-xs px-3 py-1.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                    >
                      {action}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
