"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Layout from "@/components/Layout";
import GlassCard from "@/components/GlassCard";

type StepInstance = {
  id: string;
  status: string;
  stepOrder: number | null;
  stepCode: string | null;
  stepTitle: string | null;
  stepDepartment: string | null;
  assignedTo: { id: string; username: string | undefined; fullName: string | null | undefined } | null;
  assignedAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  dueAt: Date | null;
};

type WorkflowInstance = {
  id: string;
  status: string;
  currentStepOrder: number | null;
  dueAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  metadata: any;
  workflowCode: string | null;
  workflowTitle: string | null;
  workflowDepartment: string | null;
  stepInstances: StepInstance[];
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: "در انتظار",
  IN_PROGRESS: "در حال انجام",
  COMPLETED: "تکمیل شده",
  REJECTED: "رد شده",
  CANCELLED: "لغو شده",
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: "text-yellow-400",
  IN_PROGRESS: "text-blue-400",
  COMPLETED: "text-[#51BB70]",
  REJECTED: "text-red-400",
  CANCELLED: "text-white/40",
};

const STEP_STATUS_LABELS: Record<string, string> = {
  PENDING: "در انتظار",
  ASSIGNED: "اختصاص یافته",
  IN_PROGRESS: "در حال انجام",
  COMPLETED: "تکمیل شده",
  SKIPPED: "رد شده",
  REJECTED: "رد شده",
};

const STEP_STATUS_COLORS: Record<string, string> = {
  PENDING: "text-yellow-400",
  ASSIGNED: "text-blue-400",
  IN_PROGRESS: "text-blue-400",
  COMPLETED: "text-[#51BB70]",
  SKIPPED: "text-white/40",
  REJECTED: "text-red-400",
};

export default function AdminWorkflowsPage() {
  const r = useRouter();
  const [instances, setInstances] = useState<WorkflowInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedInstance, setSelectedInstance] = useState<WorkflowInstance | null>(null);
  const [filters, setFilters] = useState({ status: "", formType: "", dateFrom: "", dateTo: "" });

  useEffect(() => { fetchInstances(); }, [filters]);

  const fetchInstances = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.status) params.set("status", filters.status);
      if (filters.formType) params.set("formType", filters.formType);
      if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
      if (filters.dateTo) params.set("dateTo", filters.dateTo);
      params.set("limit", "20");
      const res = await fetch(`/api/admin/workflow-instances?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setInstances(data.items || []);
    } catch { setInstances([]); } finally { setLoading(false); }
  };

  const formatDate = (d: Date | null | undefined) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("fa-IR", { year: "numeric", month: "2-digit", day: "2-digit" });
  };

  return (
    <>
      <Layout wide ch={
        <div className="flex flex-col flex-1 px-6 py-8 gap-6">
          <GlassCard cls="w-full p-6" ch={
            <div className="flex justify-between items-center">
              <h1 className="text-white text-xl font-bold">📊 مدیریت ورک‌فلوها</h1>
              <button onClick={() => r.back()} className="text-white/60 text-sm">بازگشت</button>
            </div>
          } />

          <GlassCard cls="w-full p-6" ch={
            <div className="flex flex-wrap gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-white/50 text-xs">وضعیت</label>
                <select value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
                  className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm">
                  <option value="">همه</option>
                  <option value="PENDING">در انتظار</option>
                  <option value="IN_PROGRESS">در حال انجام</option>
                  <option value="COMPLETED">تکمیل شده</option>
                  <option value="REJECTED">رد شده</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-white/50 text-xs">نوع فرم</label>
                <input value={filters.formType} onChange={(e) => setFilters((f) => ({ ...f, formType: e.target.value }))}
                  className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm"
                  placeholder="buy_direct, sell_market, etc." />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-white/50 text-xs">از تاریخ</label>
                <input type="date" value={filters.dateFrom} onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))}
                  className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-white/50 text-xs">تا تاریخ</label>
                <input type="date" value={filters.dateTo} onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))}
                  className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm" />
              </div>
              <div className="flex items-end">
                <button onClick={fetchInstances} className="ba px-6 py-2">اعمال فیلتر</button>
              </div>
            </div>
          } />

          <GlassCard cls="w-full p-6 flex-1" ch={
            <div className="overflow-x-auto">
              <table className="w-full text-white/80">
                <thead>
                  <tr className="border-b border-white/20">
                    <th className="text-right p-3">شناسه</th>
                    <th className="text-right p-3">ورک‌فلو</th>
                    <th className="text-right p-3">مرحله فعلی</th>
                    <th className="text-right p-3">وضعیت</th>
                    <th className="text-right p-3">تاریخ</th>
                    <th className="text-center p-3">عملیات</th>
                  </tr>
                </thead>
                <tbody>
                  {instances.map((inst) => (
                    <tr key={inst.id} className="border-b border-white/10 hover:bg-white/5">
                      <td className="p-3 font-mono text-xs">{inst.id.slice(0, 8)}</td>
                      <td className="p-3">
                        <div className="text-white">{inst.workflowCode || "—"}</div>
                        <div className="text-white/40 text-xs">{inst.workflowTitle || ""}</div>
                      </td>
                      <td className="p-3">{inst.currentStepOrder ?? "—"}</td>
                      <td className="p-3"><span className={STATUS_COLORS[inst.status] || "text-white/60"}>{STATUS_LABELS[inst.status] || inst.status}</span></td>
                      <td className="p-3">{formatDate(inst.createdAt)}</td>
                      <td className="p-3 text-center">
                        <button onClick={() => setSelectedInstance(inst)} className="text-blue-400 hover:text-blue-300 text-sm">جزئیات</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          } />
        </div>
      } />

      {selectedInstance && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.7)" }} onClick={() => setSelectedInstance(null)}>
          <div className="w-full max-w-3xl max-h-[85vh] overflow-y-auto rounded-2xl border border-white/10 p-6 shadow-2xl"
            style={{ background: "linear-gradient(to bottom, #203253, #11223d)" }} dir="rtl" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-white text-xl font-bold">جزئیات ورک‌فلو</h2>
              <button onClick={() => setSelectedInstance(null)} className="text-white/60 hover:text-white text-2xl leading-none px-2">×</button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6 text-sm">
              <div className="bg-white/5 rounded-lg p-3">
                <span className="text-white/50 text-xs">شناسه</span>
                <p className="text-white font-mono text-xs mt-1">{selectedInstance.id}</p>
              </div>
              <div className="bg-white/5 rounded-lg p-3">
                <span className="text-white/50 text-xs">کد ورک‌فلو</span>
                <p className="text-white mt-1">{selectedInstance.workflowCode || "—"}</p>
              </div>
              <div className="bg-white/5 rounded-lg p-3">
                <span className="text-white/50 text-xs">عنوان</span>
                <p className="text-white mt-1">{selectedInstance.workflowTitle || "—"}</p>
              </div>
              <div className="bg-white/5 rounded-lg p-3">
                <span className="text-white/50 text-xs">دپارتمان</span>
                <p className="text-white mt-1">{selectedInstance.workflowDepartment || "—"}</p>
              </div>
              <div className="bg-white/5 rounded-lg p-3">
                <span className="text-white/50 text-xs">وضعیت</span>
                <p className={`mt-1 ${STATUS_COLORS[selectedInstance.status] || "text-white/60"}`}>
                  {STATUS_LABELS[selectedInstance.status] || selectedInstance.status}
                </p>
              </div>
              <div className="bg-white/5 rounded-lg p-3">
                <span className="text-white/50 text-xs">مرحله فعلی</span>
                <p className="text-white mt-1">{selectedInstance.currentStepOrder ?? "—"}</p>
              </div>
              <div className="bg-white/5 rounded-lg p-3">
                <span className="text-white/50 text-xs">تاریخ ایجاد</span>
                <p className="text-white mt-1">{formatDate(selectedInstance.createdAt)}</p>
              </div>
              <div className="bg-white/5 rounded-lg p-3">
                <span className="text-white/50 text-xs">تاریخ تکمیل</span>
                <p className="text-white mt-1">{formatDate(selectedInstance.completedAt)}</p>
              </div>
            </div>
            <h3 className="text-white font-bold mb-3 text-sm">مراحل ورک‌فلو</h3>
            <div className="space-y-3">
              {selectedInstance.stepInstances.map((step, idx) => (
                <div key={step.id} className="bg-white/5 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-3">
                      <span className="bg-white/10 text-white/60 text-xs w-6 h-6 rounded-full flex items-center justify-center">{idx + 1}</span>
                      <div>
                        <span className="text-white font-medium">{step.stepTitle || step.stepCode || "—"}</span>
                        <span className="text-white/40 text-xs mr-2">({step.stepDepartment})</span>
                      </div>
                    </div>
                    <span className={`text-xs ${STEP_STATUS_COLORS[step.status] || "text-white/60"}`}>
                      {STEP_STATUS_LABELS[step.status] || step.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs mt-2">
                    <div><span className="text-white/40">اپراتور:</span><span className="text-white mr-1">{step.assignedTo?.username || step.assignedTo?.fullName || "—"}</span></div>
                    <div><span className="text-white/40">اختصاص:</span><span className="text-white mr-1">{formatDate(step.assignedAt)}</span></div>
                    <div><span className="text-white/40">شروع:</span><span className="text-white mr-1">{formatDate(step.startedAt)}</span></div>
                    <div><span className="text-white/40">تکمیل:</span><span className="text-white mr-1">{formatDate(step.completedAt)}</span></div>
                  </div>
                </div>
              ))}
              {selectedInstance.stepInstances.length === 0 && <div className="text-white/40 text-center py-6">مرحله‌ای ثبت نشده</div>}
            </div>
            <button onClick={() => setSelectedInstance(null)} className="ba w-full mt-6">بستن</button>
          </div>
        </div>
      )}
    </>
  );
}