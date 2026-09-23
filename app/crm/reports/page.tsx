"use client";

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  BarChart3,
  Briefcase,
  ChartPie,
  Download,
  ExternalLink,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import CrmCard from "@/components/crm/common/CrmCard";
import CrmButton from "@/components/crm/common/CrmButton";
import CrmTable, { Td, Th } from "@/components/crm/common/CrmTable";
import { crmFetch } from "@/lib/crm/client";

type Summary = {
  customers: { total: number; new: number; active: number };
  revenue: { total: number; currency: string };
};

type Conversion = {
  overallConversion: number;
  totalValue: number;
  avgDealSize: number;
  avgTimeToWinDays: number;
};

type Communication = {
  id: string;
  channel: string;
  direction: string;
  subject: string | null;
  content: string;
  createdAt: string;
  customer: { id: string; fullName: string | null; customerCode: string } | null;
  operator: { id: string; fullName: string | null; username: string } | null;
};

// Launcher cards point at pages that already exist — this page ships no
// report builder of its own (Phase 4.6 scope).
const REPORT_CARDS = [
  {
    href: "/crm/reports/rejections",
    label: "گزارش ریجکت‌ها",
    desc: "دلایل ریجکت، دسته‌بندی و روند روزانه",
    icon: <BarChart3 size={22} />,
    color: "#ff7a7a",
  },
  {
    href: "/crm/pipeline",
    label: "پایپ‌لاین فروش",
    desc: "کانبان مراحل و ارزش هر معامله",
    icon: <Briefcase size={22} />,
    color: "#51BBFE",
  },
  {
    href: "/crm/analytics",
    label: "تحلیل‌ها و قیف فروش",
    desc: "KPI، نمودارها، قیف تبدیل و پیش‌بینی",
    icon: <ChartPie size={22} />,
    color: "#51BB70",
  },
];

const CHANNEL_FA: Record<string, string> = {
  sms: "پیامک",
  call: "تماس",
  note: "یادداشت",
  chat: "چت",
};

const DIRECTION_FA: Record<string, string> = { inbound: "ورودی", outbound: "خروجی" };

const faNum = (n: number) => (Number.isFinite(n) ? n : 0).toLocaleString("fa-IR");

const faMoney = (n: number) => {
  const v = Number.isFinite(n) ? n : 0;
  if (Math.abs(v) >= 1_000_000_000)
    return `${(v / 1_000_000_000).toLocaleString("fa-IR", { maximumFractionDigits: 1 })} میلیارد`;
  if (Math.abs(v) >= 1_000_000) return `${Math.round(v / 1_000_000).toLocaleString("fa-IR")} میلیون`;
  return faNum(Math.round(v));
};

const faPct = (n: number) =>
  `${(Number.isFinite(n) ? n * 100 : 0).toLocaleString("fa-IR", { maximumFractionDigits: 1 })}٪`;

const faDateTime = (iso: string) => new Date(iso).toLocaleString("fa-IR");

function Spinner() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16" data-testid="crm-loading">
      <div
        className="w-8 h-8 rounded-full border-2 animate-spin"
        style={{ borderColor: "rgba(255,255,255,0.15)", borderTopColor: "#51BB70" }}
      />
      <div className="text-white/40 text-sm">در حال بارگذاری…</div>
    </div>
  );
}

export default function ReportsPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [conversion, setConversion] = useState<Conversion | null>(null);
  const [recent, setRecent] = useState<Communication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [summaryRes, conversionRes, commRes] = await Promise.all([
      // 30d window only supplies the all-time customer/revenue headline numbers.
      crmFetch("/api/crm/metrics/summary?range=30d"),
      crmFetch("/api/crm/reports/conversion"),
      crmFetch("/api/crm/communications?limit=8"),
    ]);

    const failed = [summaryRes, conversionRes, commRes].find((r) => !r.ok);
    if (failed) {
      setError(failed.data?.error?.message || `خطا در دریافت داده‌ها (${failed.status})`);
    }

    setSummary(summaryRes.ok ? (summaryRes.data?.data ?? null) : null);
    setConversion(conversionRes.ok ? (conversionRes.data?.data ?? null) : null);
    setRecent(commRes.ok && Array.isArray(commRes.data?.data) ? commRes.data.data : []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Phase 4.6: export is a console-only placeholder — no server-side export API yet.
  const exportCsv = (label: string) => {
    console.log("[CRM reports] CSV export requested:", label);
  };

  const quickStats = [
    {
      label: "مشتریان کل",
      value: summary ? faNum(summary.customers.total) : "—",
      icon: <Users size={20} />,
      color: "#51BBFE",
    },
    {
      label: "درآمد کل (۳۰ روز)",
      value: summary ? `${faMoney(summary.revenue.total)} ریال` : "—",
      icon: <TrendingUp size={20} />,
      color: "#51BB70",
    },
    {
      label: "میانگین اندازه معامله",
      value: conversion ? `${faMoney(conversion.avgDealSize)} ریال` : "—",
      icon: <BarChart3 size={20} />,
      color: "#ffd166",
    },
    {
      label: "نرخ تبدیل",
      value: conversion ? faPct(conversion.overallConversion) : "—",
      icon: <Target size={20} />,
      color: "#ff8c50",
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-white text-xl font-black" data-testid="crm-reports-title">
          گزارش‌ها
        </h1>
        <CrmButton variant="ghost" onClick={() => exportCsv("quick-stats")}>
          <span className="flex items-center gap-1">
            <Download size={15} /> خروجی CSV
          </span>
        </CrmButton>
      </div>

      {error && (
        <div
          className="rounded-xl px-4 py-3 text-sm text-[#ff7a7a]"
          style={{ background: "rgba(92,50,50,0.25)", border: "1px solid rgba(255,122,122,0.3)" }}
          data-testid="crm-reports-error"
        >
          {error}
        </div>
      )}

      {loading && !summary ? (
        <CrmCard>
          <Spinner />
        </CrmCard>
      ) : (
        <>
          {/* Quick stats */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4" data-testid="crm-quick-stats">
            {quickStats.map((s) => (
              <CrmCard key={s.label}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-white/50 text-xs">{s.label}</div>
                    <div className="text-white text-2xl font-black mt-1">{s.value}</div>
                  </div>
                  <div style={{ color: s.color }}>{s.icon}</div>
                </div>
              </CrmCard>
            ))}
          </div>

          {/* Report launcher */}
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4" data-testid="crm-report-cards">
            {REPORT_CARDS.map((c) => (
              <Link key={c.href} href={c.href} data-testid={`crm-report-card-${c.href}`}>
                <CrmCard className="hover:bg-white/5 transition-colors h-full">
                  <div className="flex items-start justify-between gap-3">
                    <div style={{ color: c.color }}>{c.icon}</div>
                    <ExternalLink size={15} className="text-white/30" />
                  </div>
                  <div className="text-white font-bold text-sm mt-3">{c.label}</div>
                  <div className="text-white/40 text-xs mt-1">{c.desc}</div>
                </CrmCard>
              </Link>
            ))}
          </div>

          {/* Recent activity */}
          <CrmCard
            title="آخرین فعالیت‌ها"
            action={
              <button
                onClick={() => exportCsv("recent-activity")}
                className="text-white/50 hover:text-white text-[11px] flex items-center gap-1"
                data-testid="crm-export-activity"
              >
                <Download size={13} /> CSV
              </button>
            }
          >
            <div data-testid="crm-recent-activity">
              <CrmTable
                head={
                  <>
                    <Th>مشتری</Th>
                    <Th>کانال</Th>
                    <Th>جهت</Th>
                    <Th>موضوع / متن</Th>
                    <Th>اپراتور</Th>
                    <Th>تاریخ</Th>
                  </>
                }
                empty={recent.length === 0 ? "فعالیتی ثبت نشده است" : undefined}
              >
                {recent.map((m) => (
                  <tr key={m.id} className="hover:bg-white/5">
                    <Td>
                      <span className="text-white font-bold text-xs">
                        {m.customer?.fullName || m.customer?.customerCode || "—"}
                      </span>
                    </Td>
                    <Td>
                      <span className="text-white/70 text-xs">{CHANNEL_FA[m.channel] || m.channel}</span>
                    </Td>
                    <Td>
                      <span className="text-white/50 text-xs">{DIRECTION_FA[m.direction] || m.direction}</span>
                    </Td>
                    <Td>
                      <span className="text-white/60 text-xs">
                        {m.subject || m.content.slice(0, 40)}
                      </span>
                    </Td>
                    <Td>
                      <span className="text-white/50 text-xs">
                        {m.operator?.fullName ?? m.operator?.username ?? "—"}
                      </span>
                    </Td>
                    <Td>
                      <span className="text-white/40 text-[11px]">{faDateTime(m.createdAt)}</span>
                    </Td>
                  </tr>
                ))}
              </CrmTable>
            </div>
          </CrmCard>
        </>
      )}

    </div>
  );
}

