"use client";

import Link from "next/link";
import { useMemo } from "react";

export type DepartmentCode = "PRICE" | "SELL" | "PRODUCT" | "INVESTMENT";

export type OperatorTask = {
  stepInstanceId: string;
  workflowCode: string;
  workflowTitle: string;
  stepName: string;
  // backend returns this via /api/workflow/tasks
  stepDepartment: string;
  stepOrder: number;
  instanceStatus: string;
  dueAt?: string | null;
  createdAt: string;
  customerFullName?: string | null;
  customerPhone?: string | null;
};

const DEPT_LABELS: Record<DepartmentCode, string> = {
  PRICE: "کارشناس قیمت",
  SELL: "مدیر فروش",
  PRODUCT: "مدیر محصول",
  INVESTMENT: "سرمایه‌گذاری",
};

const DEPT_COLORS: Record<DepartmentCode, string> = {
  PRICE: "bg-emerald-500/20 text-emerald-300",
  INVESTMENT: "bg-amber-500/20 text-amber-300",
  PRODUCT: "bg-blue-500/20 text-blue-300",
  SELL: "bg-violet-500/20 text-violet-300",
};

export default function DepartmentDashboard({
  department,
  tasks,
  loading,
  error,
}: {
  department: DepartmentCode;
  tasks: OperatorTask[];
  loading: boolean;
  error?: string | null;
}) {
  const deptLabel = DEPT_LABELS[department];
  const deptColor = DEPT_COLORS[department];

  const shown = useMemo(() => {
    return tasks.slice().sort((a, b) => {
      // newest first
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [tasks]);

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-gradient-to-b from-[#203253] to-[#11223d] text-white p-4 md:p-6"
    >
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex justify-between items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">
              {deptLabel} — پنل اپراتور
            </h1>
            <p className="text-white/60 mt-1">
              {loading ? "در حال بارگذاری..." : `${shown.length} وظیفه فعال`}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href={`/operators/${department === "PRICE" ? "price-expert" : department === "SELL" ? "sell-manager" : department === "PRODUCT" ? "product-manager" : "Investment"}`}
              className="text-sm text-white/50 hover:text-white transition"
            >
              ← داشبورد
            </Link>
          </div>
        </div>

        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">وظایف اخیر</h2>
            <div className="text-xs px-3 py-1 rounded-full border border-white/10 bg-white/5 text-white/70">
              {deptLabel}
            </div>
          </div>

          {error ? (
            <div className="text-red-400/80 text-center py-10">
              <p className="text-4xl mb-4">⚠️</p>
              <p className="text-lg">{error}</p>
            </div>
          ) : loading ? (
            <div className="text-white/50 text-center py-10">در حال بارگذاری...</div>
          ) : shown.length === 0 ? (
            <div className="text-white/50 text-center py-10">
              <p className="text-4xl mb-4">✅</p>
              <p className="text-lg">وظیفه‌ای برای این بخش یافت نشد</p>
            </div>
          ) : (
            <div className="space-y-3">
              {shown.map((task) => (
                <Link
                  key={task.stepInstanceId}
                  href={`/operators/workflow/${task.stepInstanceId}`}
                  className="block bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl p-5 transition group"
                >
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-white font-bold text-lg">
                          {task.workflowTitle}
                        </span>
                        <span className="text-xs text-white/40">({task.workflowCode})</span>
                      </div>
                      <p className="text-white/70">{task.stepName}</p>
                      {task.customerFullName && (
                        <p className="text-white/50 text-sm mt-1">
                          👤 {task.customerFullName}
                          {task.customerPhone && (
                            <span dir="ltr" className="mr-2 text-white/40">
                              📞 {task.customerPhone}
                            </span>
                          )}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <span
                        className={`text-xs px-2.5 py-1 rounded-full ${deptColor}`}
                      >
                        {task.stepDepartment}
                      </span>
                      <span className="text-xs text-white/40">
                        {new Date(task.createdAt).toLocaleDateString("fa-IR")}
                      </span>
                      <span className="text-blue-400 group-hover:text-blue-300 transition text-sm">
                        ورود ←
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

