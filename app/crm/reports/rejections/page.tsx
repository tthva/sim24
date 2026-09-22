"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import useSWR from "swr";
import {
  ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell,
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from "recharts";

type Report = {
  totalRejections: number;
  completedSteps: number;
  rejectionRate: number;
  byReason: { code: string; name: string; category: string | null; count: number }[];
  byCategory: { category: string; count: number }[];
  series: { date: string; count: number }[];
  recent: {
    id: string;
    stepInstanceId: string;
    rejectedAt: string;
    notes: string | null;
    reason: { code: string; name: string; category: string | null };
    rejectedBy: { fullName: string | null; username: string } | null;
  }[];
};

const get = (url: string) => fetch(url, { credentials: "include" }).then((r) => r.json());

const PIE_COLORS = ["#51BB70", "#ff8c50", "#51BBFE", "#a0aabe", "#ec4899", "#f59e0b"];
const CAT_FA: Record<string, string> = {
  pricing: "قیمت", quality: "کیفیت", customer: "مشتری", other: "سایر",
};

export default function RejectionsReportPage() {
  const [days, setDays] = useState(30);
  const { data } = useSWR(`/api/crm/reports/rejections?days=${days}`, get, {
    refreshInterval: 30_000, revalidateOnFocus: false,
  });
  const report: Report | undefined = data?.data;

  const exportCsv = () => {
    if (!report?.recent?.length) return;
    const rows = [
      ["تاریخ", "مرحله", "دلیل", "دسته", "اپراتور", "توضیحات"],
      ...report.recent.map((r) => [
        new Date(r.rejectedAt).toLocaleString("fa-IR"),
        r.stepInstanceId,
        r.reason?.name ?? "",
        CAT_FA[r.reason?.category ?? "other"] ?? "",
        r.rejectedBy?.fullName ?? "",
        r.notes ?? "",
      ]),
    ];
    const csv = "\uFEFF" + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `rejections-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-white text-2xl font-black">گزارش ریجکت‌ها</h1>
        <div className="flex gap-2 items-center">
          <select value={days} onChange={(e) => setDays(Number(e.target.value))}
            className="rounded-lg px-3 py-2 text-xs bg-[#11223d] text-white border border-white/10 outline-none">
            <option value={7}>۷ روز</option>
            <option value={30}>۳۰ روز</option>
            <option value={90}>۹۰ روز</option>
          </select>
          <button onClick={exportCsv} data-testid="export-csv"
            className="px-4 py-2 rounded-xl text-xs font-bold bg-white/10 text-white hover:bg-white/20">
            ⬇ CSV
          </button>
        </div>
      </div>

      {!report ? (
        <div className="text-white/40 text-sm py-10 text-center">در حال بارگذاری…</div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="rounded-2xl p-4" style={{ background: "#11223d" }}>
              <div className="text-white/40 text-xs">کل ریجکت‌ها</div>
              <div className="text-white text-2xl font-black" data-testid="kpi-total">{report.totalRejections}</div>
            </div>
            <div className="rounded-2xl p-4" style={{ background: "#11223d" }}>
              <div className="text-white/40 text-xs">مراحل تکمیل‌شده</div>
              <div className="text-white text-2xl font-black">{report.completedSteps}</div>
            </div>
            <div className="rounded-2xl p-4" style={{ background: "#11223d" }}>
              <div className="text-white/40 text-xs">نرخ ریجکت</div>
              <div className="text-2xl font-black" style={{ color: report.rejectionRate > 20 ? "#ef4444" : "#51BB70" }} data-testid="kpi-rate">
                {report.rejectionRate}%
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            <div className="rounded-2xl p-4" style={{ background: "#11223d" }} data-testid="chart-by-reason">
              <div className="text-white/60 text-xs mb-3">ریجکت بر اساس دلیل</div>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={report.byReason.slice(0, 10)}>
                  <CartesianGrid stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="name" tick={{ fill: "#fff", fontSize: 10 }} />
                  <YAxis tick={{ fill: "#fff", fontSize: 10 }} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: "#0b1a2e", border: "1px solid rgba(255,255,255,0.1)" }} />
                  <Bar dataKey="count" fill="#51BB70" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="rounded-2xl p-4" style={{ background: "#11223d" }} data-testid="chart-by-category">
              <div className="text-white/60 text-xs mb-3">بر اساس دسته</div>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={report.byCategory} dataKey="count" nameKey="category"
                    innerRadius={55} outerRadius={95} label>
                    {report.byCategory.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: "#0b1a2e", border: "1px solid rgba(255,255,255,0.1)" }} />
                  <Legend formatter={(v: string) => CAT_FA[v] ?? v} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-2xl p-4 mb-6" style={{ background: "#11223d" }} data-testid="chart-trend">
            <div className="text-white/60 text-xs mb-3">روند {days} روز اخیر</div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={report.series}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="date" tick={{ fill: "#fff", fontSize: 9 }} />
                <YAxis tick={{ fill: "#fff", fontSize: 10 }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "#0b1a2e", border: "1px solid rgba(255,255,255,0.1)" }} />
                <Line type="monotone" dataKey="count" stroke="#51BB70" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="rounded-2xl p-4" style={{ background: "#11223d" }}>
            <div className="text-white/60 text-xs mb-3">آخرین ریجکت‌ها</div>
            <table className="w-full text-right">
              <thead>
                <tr className="text-white/40 text-[11px] border-b border-white/10">
                  <th className="pb-2">دلیل</th>
                  <th className="pb-2">اپراتور</th>
                  <th className="pb-2">تاریخ</th>
                  <th className="pb-2">توضیحات</th>
                </tr>
              </thead>
              <tbody>
                {report.recent.map((r) => (
                  <tr key={r.id} className="text-white text-xs border-b border-white/5">
                    <td className="py-2">{r.reason?.name}</td>
                    <td className="py-2 text-white/60">{r.rejectedBy?.fullName ?? r.rejectedBy?.username}</td>
                    <td className="py-2 text-white/60">{new Date(r.rejectedAt).toLocaleString("fa-IR")}</td>
                    <td className="py-2 text-white/40">{r.notes ?? "—"}</td>
                  </tr>
                ))}
                {report.recent.length === 0 && (
                  <tr><td colSpan={4} className="text-center text-white/30 py-6">ریجکتی ثبت نشده</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}



