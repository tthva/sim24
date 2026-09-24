"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Link from "next/link";
import CrmCard from "@/components/crm/common/CrmCard";
import CrmBadge from "@/components/crm/common/CrmBadge";
import { Users, ListChecks, CheckCircle2, Briefcase, Star } from "lucide-react";

type MyStats = {
  myCustomers: number;
  myTasks: number;
  myTasksCompletedToday: number;
  myOpportunities: number;
  avgLeadScore: number;
};

type MyTask = {
  id: string;
  status: string;
  dueAt: string | null;
  createdAt: string;
  step: { title: string; department: string };
};

type MyCustomer = {
  id: string;
  fullName: string | null;
  customerCode: string;
  primaryPhone: string;
  segment: string;
  score: number;
  createdAt: string;
};

type MyOpportunity = {
  id: string;
  title: string;
  estimatedValue: number | null;
  probability: number | null;
  stage: { name: string; color: string | null };
};

type MyDashboardData = {
  myStats: MyStats;
  myTasksToday: MyTask[];
  myCustomersRecent: MyCustomer[];
  myOpportunities: MyOpportunity[];
};

const STATUS_FA: Record<string, string> = {
  ASSIGNED: "در انتظار",
  IN_PROGRESS: "در حال انجام",
};

// ─── Phase 4.8d-1 — Personal CRM dashboard (own work only) ─────
// Data comes from GET /api/crm/my-dashboard which is hard-scoped to the
// signed-in user (no crm.view_all bypass here — managers see the global
// view at /crm).
export default function CrmMyDashboardPage() {
  const [data, setData] = useState<MyDashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/crm/my-dashboard", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => (d.success ? setData(d.data) : setError(d?.error?.message || "خطا")))
      .catch(() => setError("خطا در دریافت آمار"));
  }, []);

  const stats = data?.myStats;
  const cards = [
    { label: "مشتریان من", value: stats?.myCustomers ?? "—", icon: <Users size={20} />, color: "#51BBFE" },
    { label: "تسک‌های فعال من", value: stats?.myTasks ?? "—", icon: <ListChecks size={20} />, color: "#ff8c50" },
    { label: "تکمیل‌شده امروز", value: stats?.myTasksCompletedToday ?? "—", icon: <CheckCircle2 size={20} />, color: "#51BB70" },
    { label: "فرصت‌های من", value: stats?.myOpportunities ?? "—", icon: <Briefcase size={20} />, color: "#51BBFE" },
    { label: "میانگین امتیاز سرنخ‌ها", value: stats?.avgLeadScore ?? "—", icon: <Star size={20} />, color: "#ffd166" },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h1 className="text-white text-xl font-black" data-testid="crm-my-dashboard-title">
          داشبورد من
        </h1>
        <Link
          href="/crm/tasks?scope=mine"
          className="text-[#51BB70] text-xs font-bold hover:underline"
          data-testid="crm-my-dashboard-tasks-link"
        >
          مشاهده همه تسک‌های من ←
        </Link>
      </div>

      {error && <div className="text-[#ff7a7a] text-sm">{error}</div>}

      {/* KPI cards */}
      <div className="grid grid-cols-2 xl:grid-cols-5 gap-4" data-testid="crm-my-stats">
        {cards.map((c) => (
          <CrmCard key={c.label}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-white/50 text-xs">{c.label}</div>
                <div className="text-white text-3xl font-black mt-1">{c.value}</div>
              </div>
              <div style={{ color: c.color }}>{c.icon}</div>
            </div>
          </CrmCard>
        ))}
      </div>

      {/* Lists */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* My tasks */}
        <CrmCard title="تسک‌های امروز من">
          <div className="flex flex-col gap-2" data-testid="crm-my-tasks">
            {(data?.myTasksToday ?? []).map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-white/5 transition-colors"
              >
                <span className="text-white text-sm font-bold">{t.step.title}</span>
                <div className="flex items-center gap-2">
                  {t.dueAt && (
                    <span className="text-white/40 text-xs">
                      {new Date(t.dueAt).toLocaleDateString("fa-IR")}
                    </span>
                  )}
                  <CrmBadge
                    label={STATUS_FA[t.status] || t.status}
                    tone={t.status === "IN_PROGRESS" ? "hot" : "regular"}
                  />
                </div>
              </div>
            ))}
            {data && data.myTasksToday.length === 0 && (
              <div className="text-white/40 text-sm text-center py-6" data-testid="crm-my-tasks-empty">
                تسک فعالی ندارید
              </div>
            )}
          </div>
        </CrmCard>

        {/* My recent customers */}
        <CrmCard title="مشتریان اخیر من">
          <div className="flex flex-col gap-2" data-testid="crm-my-customers">
            {(data?.myCustomersRecent ?? []).map((c) => (
              <Link
                key={c.id}
                href={`/crm/customers/${c.id}`}
                className="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-white font-bold text-sm">{c.fullName || "بدون نام"}</span>
                  <span className="text-white/30 text-xs" dir="ltr">
                    {c.customerCode}
                  </span>
                </div>
                <CrmBadge label={c.segment} tone={c.segment} />
              </Link>
            ))}
            {data && data.myCustomersRecent.length === 0 && (
              <div className="text-white/40 text-sm text-center py-6" data-testid="crm-my-customers-empty">
                مشتری ثبت نشده است
              </div>
            )}
          </div>
        </CrmCard>

        {/* My opportunities */}
        <CrmCard title="فرصت‌های من (بالاترین ارزش)">
          <div className="flex flex-col gap-2" data-testid="crm-my-opportunities">
            {(data?.myOpportunities ?? []).map((o) => (
              <div
                key={o.id}
                className="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-white/5 transition-colors"
              >
                <span className="text-white text-sm font-bold">{o.title}</span>
                <div className="flex items-center gap-2">
                  {o.estimatedValue != null && (
                    <span className="text-[#51BB70] text-xs font-black">
                      {o.estimatedValue.toLocaleString("fa-IR")}
                    </span>
                  )}
                  <CrmBadge label={o.stage.name} />
                </div>
              </div>
            ))}
            {data && data.myOpportunities.length === 0 && (
              <div className="text-white/40 text-sm text-center py-6" data-testid="crm-my-opportunities-empty">
                فرصتی ثبت نشده است
              </div>
            )}
          </div>
        </CrmCard>
      </div>
    </div>
  );
}
