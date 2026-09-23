"use client";

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { Activity, Target, TrendingUp, Users } from "lucide-react";
import CrmCard from "@/components/crm/common/CrmCard";
import { crmFetch } from "@/lib/crm/client";

// ─── API envelopes (app/api/crm/metrics, reports/conversion, reports/forecast) ───
type RangeKey = "24h" | "7d" | "30d";

type Summary = {
  range: { key: string; days: number; from: string; to: string };
  customers: { total: number; new: number; active: number };
  forms: { total: number; byType: Record<string, number> };
  tasks: { assigned: number; completed: number; rejected: number; avgDurationMin: number };
  pipeline: { dealsCreated: number; dealsWon: number; dealsLost: number; totalValue: number };
  communication: { smsSent: number; smsReceived: number; callsMade: number };
  revenue: { total: number; currency: string };
};

type DailyMetric = {
  date: string;
  formsSubmitted: number;
  tasksAssigned: number;
  tasksCompleted: number;
  tasksRejected: number;
  revenue: number;
};

type Conversion = {
  stages: { name: string; code: string; count: number }[];
  transitions: { from: string; to: string; rate: number }[];
  overallConversion: number;
  totalValue: number;
  avgDealSize: number;
  avgTimeToWinDays: number;
};

type Forecast = {
  horizon: number;
  expectedRevenue: number;
  opportunities: number;
  byStage: { code: string; name: string; count: number; weightedValue: number }[];
  confidence: number;
};

const RANGES: { key: RangeKey; label: string; days: number }[] = [
  { key: "24h", label: "۲۴ ساعت", days: 1 },
  { key: "7d", label: "۷ روز", days: 7 },
  { key: "30d", label: "۳۰ روز", days: 30 },
];

const SEGMENT_FA: Record<string, string> = {
  vip: "VIP",
  hot: "داغ",
  regular: "معمولی",
  cold: "سرد",
};

const PIE_COLORS = ["#51BB70", "#ff8c50", "#51BBFE", "#a0aabe"];

const TICK = { fill: "#ffffff66", fontSize: 10 };
const TOOLTIP_STYLE = {
  background: "#11223d",
  border: "1px solid rgba(81,187,254,0.3)",
  borderRadius: 12,
  fontFamily: "Vazirmatn",
};

const faNum = (n: number) => (Number.isFinite(n) ? n : 0).toLocaleString("fa-IR");

// Revenue is Decimal(15,0) IRR — compact form for KPI cards, full digits elsewhere.
const faMoney = (n: number) => {
  const v = Number.isFinite(n) ? n : 0;
  if (Math.abs(v) >= 1_000_000_000)
    return `${(v / 1_000_000_000).toLocaleString("fa-IR", { maximumFractionDigits: 1 })} میلیارد`;
  if (Math.abs(v) >= 1_000_000) return `${Math.round(v / 1_000_000).toLocaleString("fa-IR")} میلیون`;
  return faNum(Math.round(v));
};

const faPct = (n: number) =>
  `${(Number.isFinite(n) ? n * 100 : 0).toLocaleString("fa-IR", { maximumFractionDigits: 1 })}٪`;

function Spinner({ text = "در حال بارگذاری…" }: { text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16" data-testid="crm-loading">
      <div
        className="w-8 h-8 rounded-full border-2 animate-spin"
        style={{ borderColor: "rgba(255,255,255,0.15)", borderTopColor: "#51BB70" }}
      />
      <div className="text-white/40 text-sm">{text}</div>
    </div>
  );
}

function NoDataHint() {
  return (
    <div className="text-white/35 text-[11px] text-center mb-2">
      برای این بازه داده‌ای ثبت نشده است
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="rounded-xl p-3"
      style={{ background: "rgba(10,22,40,0.6)", border: "1px solid rgba(81,187,254,0.15)" }}
    >
      <div className="text-white/40 text-[11px]">{label}</div>
      <div className="text-white font-bold text-sm mt-1">{value}</div>
    </div>
  );
}

export default function AnalyticsPage() {
  const [range, setRange] = useState<RangeKey>("7d");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [series, setSeries] = useState<DailyMetric[]>([]);
  const [conversion, setConversion] = useState<Conversion | null>(null);
  const [segments, setSegments] = useState<{ name: string; value: number }[]>([]);
  const [horizon, setHorizon] = useState(30);
  const [forecast, setForecast] = useState<Forecast | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const days = RANGES.find((r) => r.key === range)?.days ?? 7;

    const [summaryRes, seriesRes, conversionRes, statsRes] = await Promise.all([
      crmFetch(`/api/crm/metrics/summary?range=${range}`),
      crmFetch(`/api/crm/metrics?days=${days}`),
      // Funnel + overallConversion are all-time by API design (no createdAt window).
      crmFetch("/api/crm/reports/conversion"),
      // Segment distribution comes from the existing dashboard stats aggregate.
      crmFetch("/api/crm/stats"),
    ]);

    const failed = [summaryRes, seriesRes, conversionRes, statsRes].find((r) => !r.ok);
    if (failed) {
      setError(failed.data?.error?.message || `خطا در دریافت داده‌ها (${failed.status})`);
    }

    setSummary(summaryRes.ok ? (summaryRes.data?.data ?? null) : null);
    setSeries(seriesRes.ok && Array.isArray(seriesRes.data?.data) ? seriesRes.data.data : []);
    setConversion(conversionRes.ok ? (conversionRes.data?.data ?? null) : null);
    setSegments(
      statsRes.ok && Array.isArray(statsRes.data?.data?.segments)
        ? statsRes.data.data.segments.map((s: { segment: string; count: number }) => ({
            name: SEGMENT_FA[s.segment] || s.segment,
            value: s.count,
          }))
        : []
    );
    setLoading(false);
  }, [range]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    crmFetch(`/api/crm/reports/forecast?horizon=${horizon}`).then((res) => {
      if (cancelled) return;
      setForecast(res.ok ? (res.data?.data ?? null) : null);
    });
    return () => {
      cancelled = true;
    };
  }, [horizon]);

  const kpis = useMemo(
    () => [
      {
        label: "مشتریان کل",
        value: summary ? faNum(summary.customers.total) : "—",
        icon: <Users size={20} />,
        color: "#51BBFE",
      },
      {
        label: "مشتریان فعال",
        value: summary ? faNum(summary.customers.active) : "—",
        icon: <Activity size={20} />,
        color: "#51BB70",
      },
      {
        label: "نرخ تبدیل",
        value: conversion ? faPct(conversion.overallConversion) : "—",
        icon: <Target size={20} />,
        color: "#ff8c50",
      },
      {
        label: "درآمد کل",
        value: summary ? faMoney(summary.revenue.total) : "—",
        icon: <TrendingUp size={20} />,
        color: "#ffd166",
      },
    ],
    [summary, conversion]
  );

  const funnelStages = conversion?.stages ?? [];
  const transitions = conversion?.transitions ?? [];
  const funnelTop = funnelStages[0]?.count ?? 0;

  return (
    <div className="flex flex-col gap-5">
      {/* Header + range selector */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-white text-xl font-black" data-testid="crm-analytics-title">
          تحلیل‌ها
        </h1>
        <div
          className="flex rounded-xl overflow-hidden"
          style={{ border: "1px solid rgba(81,187,254,0.2)" }}
          data-testid="crm-analytics-range"
        >
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              data-testid={`crm-range-${r.key}`}
              className={`px-4 py-2 text-xs font-bold transition-colors ${
                range === r.key ? "bg-[#51BB70] text-[#011B2C]" : "text-white/60 hover:bg-white/10"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div
          className="rounded-xl px-4 py-3 text-sm text-[#ff7a7a]"
          style={{ background: "rgba(92,50,50,0.25)", border: "1px solid rgba(255,122,122,0.3)" }}
          data-testid="crm-analytics-error"
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
          {/* KPI cards */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4" data-testid="crm-analytics-kpis">
            {kpis.map((k) => (
              <CrmCard key={k.label}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-white/50 text-xs">{k.label}</div>
                    <div className="text-white text-2xl font-black mt-1">{k.value}</div>
                  </div>
                  <div style={{ color: k.color }}>{k.icon}</div>
                </div>
              </CrmCard>
            ))}
          </div>
          {/* Charts 2×2 */}
          <div className="grid lg:grid-cols-2 gap-4">
            <CrmCard title="فرم‌های ارسالی">
              {series.length === 0 && <NoDataHint />}
              <div style={{ width: "100%", height: 240 }} data-testid="crm-chart-forms">
                <ResponsiveContainer>
                  <LineChart data={series}>
                    <CartesianGrid stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="date" tick={TICK} tickFormatter={(v: string) => v.slice(5)} />
                    <YAxis tick={TICK} allowDecimals={false} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: "#fff" }} />
                    <Line
                      type="monotone"
                      dataKey="formsSubmitted"
                      name="فرم ارسالی"
                      stroke="#51BB70"
                      strokeWidth={2}
                      dot={{ r: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CrmCard>

            <CrmCard title="تسک‌ها">
              {series.length === 0 && <NoDataHint />}
              <div style={{ width: "100%", height: 240 }} data-testid="crm-chart-tasks">
                <ResponsiveContainer>
                  <BarChart data={series}>
                    <CartesianGrid stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="date" tick={TICK} tickFormatter={(v: string) => v.slice(5)} />
                    <YAxis tick={TICK} allowDecimals={false} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: "#fff" }} />
                    <Legend wrapperStyle={{ fontFamily: "Vazirmatn", fontSize: 11 }} />
                    <Bar dataKey="tasksAssigned" name="ارجاع‌شده" fill="#51BBFE" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="tasksCompleted" name="تکمیل‌شده" fill="#51BB70" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="tasksRejected" name="رد‌شده" fill="#ff7a7a" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CrmCard>

            <CrmCard title="مشتریان بر اساس Segment">
              {segments.length === 0 && <NoDataHint />}
              <div style={{ width: "100%", height: 240 }} data-testid="crm-chart-segments">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={segments}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={50}
                      outerRadius={85}
                      paddingAngle={3}
                    >
                      {segments.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <Legend wrapperStyle={{ fontFamily: "Vazirmatn", fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CrmCard>

            <CrmCard title="روند درآمد">
              {series.length === 0 && <NoDataHint />}
              <div style={{ width: "100%", height: 240 }} data-testid="crm-chart-revenue">
                <ResponsiveContainer>
                  <LineChart data={series}>
                    <CartesianGrid stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="date" tick={TICK} tickFormatter={(v: string) => v.slice(5)} />
                    <YAxis tick={TICK} tickFormatter={(v: number) => faMoney(v)} width={72} />
                    <Tooltip
                      contentStyle={TOOLTIP_STYLE}
                      labelStyle={{ color: "#fff" }}
                      formatter={(v) => faMoney(Number(v))}
                    />
                    <Line
                      type="monotone"
                      dataKey="revenue"
                      name="درآمد"
                      stroke="#ffd166"
                      strokeWidth={2}
                      dot={{ r: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CrmCard>
          </div>
          {/* Funnel */}
          <CrmCard
            title="قیف فروش"
            action={<span className="text-white/40 text-[11px]">همه فرصت‌ها (بدون محدودیت تاریخ)</span>}
          >
            <div className="flex items-stretch gap-2 overflow-x-auto pb-1" data-testid="crm-funnel">
              {funnelStages.map((s, i) => {
                const widthPct = funnelTop > 0 ? Math.round((s.count / funnelTop) * 100) : 0;
                const rate = transitions[i]?.rate;
                return (
                  <div key={s.code} className="flex items-center gap-2 flex-1 min-w-[118px]">
                    <div
                      className="flex-1 rounded-xl p-3 text-center"
                      style={{
                        background: "rgba(10,22,40,0.6)",
                        border: `1px solid ${
                          i === funnelStages.length - 1
                            ? "rgba(81,187,112,0.45)"
                            : "rgba(81,187,254,0.2)"
                        }`,
                      }}
                    >
                      <div className="text-white/50 text-[11px]">{s.name}</div>
                      <div className="text-white text-xl font-black" data-testid={`crm-funnel-${s.code}`}>
                        {faNum(s.count)}
                      </div>
                      <div
                        className="h-1.5 rounded-full mt-2 overflow-hidden"
                        style={{ background: "rgba(255,255,255,0.08)" }}
                      >
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${widthPct}%`, background: "#51BB70" }}
                        />
                      </div>
                    </div>
                    {rate !== undefined && (
                      <div className="shrink-0 text-center text-white/40 text-[11px]">
                        <div className="text-[#51BB70] font-bold">{faPct(rate)}</div>
                        <div>◀</div>
                      </div>
                    )}
                  </div>
                );
              })}
              {funnelStages.length === 0 && (
                <div className="text-white/40 text-sm text-center py-6 w-full">داده قیف در دسترس نیست</div>
              )}
            </div>

            {conversion && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
                <Stat label="میانگین اندازه معامله" value={`${faMoney(conversion.avgDealSize)} ریال`} />
                <Stat label="ارزش معاملات برنده" value={`${faMoney(conversion.totalValue)} ریال`} />
                <Stat label="میانگین زمان برنده شدن" value={`${faNum(conversion.avgTimeToWinDays)} روز`} />
              </div>
            )}
          </CrmCard>

          {/* Forecast */}
          <CrmCard
            title="پیش‌بینی فروش"
            action={
              <div className="flex gap-1" data-testid="crm-forecast-horizon">
                {[30, 60, 90].map((h) => (
                  <button
                    key={h}
                    onClick={() => setHorizon(h)}
                    data-testid={`crm-horizon-${h}`}
                    className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-colors ${
                      horizon === h ? "bg-[#51BB70] text-[#011B2C]" : "text-white/50 hover:bg-white/10"
                    }`}
                  >
                    {h.toLocaleString("fa-IR")} روز
                  </button>
                ))}
              </div>
            }
          >
            {!forecast ? (
              <div className="text-white/40 text-sm py-6 text-center">در حال محاسبه…</div>
            ) : (
              <div className="flex flex-col gap-4" data-testid="crm-forecast">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Stat label="درآمد مورد انتظار" value={`${faMoney(forecast.expectedRevenue)} ریال`} />
                  <Stat label="تعداد فرصت‌ها" value={faNum(forecast.opportunities)} />
                  <Stat label="افق پیش‌بینی" value={`${faNum(forecast.horizon)} روز`} />
                </div>

                <div>
                  <div className="flex items-center justify-between text-[11px] text-white/40 mb-1">
                    <span>میزان اعتماد</span>
                    <span className="text-white/70 font-bold" data-testid="crm-forecast-confidence">
                      {faPct(forecast.confidence)}
                    </span>
                  </div>
                  <div
                    className="h-2 rounded-full overflow-hidden"
                    style={{ background: "rgba(255,255,255,0.08)" }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.round(forecast.confidence * 100)}%`,
                        background: "#51BB70",
                      }}
                    />
                  </div>
                </div>

                {forecast.byStage.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {forecast.byStage.map((s) => (
                      <span
                        key={s.code}
                        className="px-3 py-1.5 rounded-xl text-[11px] text-white/70"
                        style={{
                          background: "rgba(10,22,40,0.6)",
                          border: "1px solid rgba(81,187,254,0.15)",
                        }}
                      >
                        {s.name}: {faNum(s.count)} · {faMoney(s.weightedValue)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CrmCard>


        </>
      )}
    </div>
  );
}

