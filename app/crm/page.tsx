"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import CrmCard from "@/components/crm/common/CrmCard";
import CrmBadge from "@/components/crm/common/CrmBadge";
import { Users, UserPlus, Activity, Star } from "lucide-react";

const SEGMENT_FA: Record<string, string> = {
  vip: "VIP",
  hot: "داغ",
  regular: "معمولی",
  cold: "سرد",
};

const PIE_COLORS = ["#51BB70", "#ff8c50", "#51BBFE", "#a0aabe"];

type Stats = {
  total: number;
  newToday: number;
  active30: number;
  avgScore: number;
  segments: { segment: string; count: number }[];
  dailySeries: { date: string; count: number }[];
  topCustomers: { id: string; fullName: string | null; customerCode: string; score: number }[];
};

export default function CrmDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/crm/stats", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => (d.success ? setStats(d.data) : setError(d?.error?.message || "خطا")))
      .catch(() => setError("خطا در دریافت آمار"));
  }, []);

  const cards = [
    { label: "کل مشتریان", value: stats?.total ?? "—", icon: <Users size={20} />, color: "#51BBFE" },
    { label: "مشتریان جدید امروز", value: stats?.newToday ?? "—", icon: <UserPlus size={20} />, color: "#51BB70" },
    { label: "مشتریان فعال (۳۰ روز اخیر)", value: stats?.active30 ?? "—", icon: <Activity size={20} />, color: "#ff8c50" },
    { label: "میانگین امتیاز", value: stats?.avgScore ?? "—", icon: <Star size={20} />, color: "#ffd166" },
  ];

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-white text-xl font-black" data-testid="crm-dashboard-title">
        داشبورد CRM
      </h1>

      {error && <div className="text-[#ff7a7a] text-sm">{error}</div>}

      {/* Stat cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4" data-testid="crm-stat-cards">
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

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-4">
        <CrmCard title="مشتریان جدید در ۷ روز اخیر">
          <div style={{ width: "100%", height: 260 }} data-testid="crm-line-chart">
            <ResponsiveContainer>
              <LineChart data={stats?.dailySeries ?? []}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="date" tick={{ fill: "#ffffff66", fontSize: 11 }} tickFormatter={(v: string) => v.slice(5)} />
                <YAxis tick={{ fill: "#ffffff66", fontSize: 11 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: "#11223d", border: "1px solid rgba(81,187,254,0.3)", borderRadius: 12, fontFamily: "Vazirmatn" }}
                  labelStyle={{ color: "#fff" }}
                />
                <Line type="monotone" dataKey="count" name="مشتری جدید" stroke="#51BB70" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CrmCard>

        <CrmCard title="توزیع Segment">
          <div style={{ width: "100%", height: 260 }} data-testid="crm-pie-chart">
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={(stats?.segments ?? []).map((s) => ({
                    name: SEGMENT_FA[s.segment] || s.segment,
                    value: s.count,
                  }))}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={3}
                >
                  {(stats?.segments ?? []).map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: "#11223d", border: "1px solid rgba(81,187,254,0.3)", borderRadius: 12, fontFamily: "Vazirmatn" }}
                />
                <Legend wrapperStyle={{ fontFamily: "Vazirmatn", fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CrmCard>
      </div>

      {/* Hot leads */}
      <CrmCard title="۵ مشتری با بالاترین امتیاز (Hot Leads)">
        <div className="flex flex-col gap-2" data-testid="crm-top-customers">
          {(stats?.topCustomers ?? []).map((c) => (
            <Link
              key={c.id}
              href={`/crm/customers/${c.id}`}
              className="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-white font-bold text-sm">{c.fullName || "بدون نام"}</span>
                <span className="text-white/30 text-xs" dir="ltr">{c.customerCode}</span>
              </div>
              <div className="flex items-center gap-2">
                <CrmBadge label={`${c.score}`} tone={c.score >= 50 ? "vip" : "regular"} />
              </div>
            </Link>
          ))}
          {stats && stats.topCustomers.length === 0 && (
            <div className="text-white/40 text-sm text-center py-6">هنوز مشتری ثبت نشده است</div>
          )}
        </div>
      </CrmCard>
    </div>
  );
}
