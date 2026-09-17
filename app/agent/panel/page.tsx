"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Layout from "@/components/Layout";
import GlassCard from "@/components/GlassCard";

interface Agent {
  id: string;
  username: string;
  adminId: string;
}

interface Stats {
  totalForms: number;
  uniqueCustomers: number;
  byType: { buy: number; sell: number; invest: number };
  monthly: { month: string; count: number }[];
  weekly: { week: string; count: number }[];
}

const PERSIAN_MONTHS = [
  "فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور",
  "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند",
];

function toPersianDateShort(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("fa-IR");
  } catch { return dateStr; }
}

function getPersianMonth(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("fa-IR", { month: "long" });
  } catch { return dateStr; }
}

function MiniBar({ value, max, label, color }: { value: number; max: number; label: string; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-2">
      <span className="text-white/60 text-xs w-20 text-left">{label}</span>
      <div className="flex-1 h-5 bg-white/5 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-white font-bold text-sm w-8 text-right">{value}</span>
    </div>
  );
}

export default function AgentPanelPage() {
  const router = useRouter();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [error, setError] = useState("");
  
  // DEBUG: Track component mounts and renders
  const renderId = useRef(Math.random().toString(36).slice(2, 9));
  const mountCount = useRef(0);
  mountCount.current++;
  
  console.log(`[AGENT_PANEL] Render #${mountCount.current} (id: ${renderId.current}) at ${new Date().toISOString()}`);
  
  // Track if this is a client-side navigation
  const isNavigation = useRef(false);
  if (typeof window !== 'undefined') {
    const nav = sessionStorage.getItem('agent-panel-nav');
    if (nav && nav === 'true') {
      isNavigation.current = true;
      sessionStorage.removeItem('agent-panel-nav');
    }
  }

  useEffect(() => {
    console.log(`[AGENT_PANEL] useEffect #${mountCount.current} running (id: ${renderId.current}, isNav: ${isNavigation.current})`);
    fetchAgent();
    fetchStats();
  }, []);

  async function fetchAgent() {
    const requestId = Math.random().toString(36).slice(2, 9);
    console.log(`[AGENT_PANEL] fetchAgent started (render: ${renderId.current}, req: ${requestId})`);
    try {
      const res = await fetch("/api/agent/me", { credentials: "include" });
      console.log(`[AGENT_PANEL] fetchAgent response (render: ${renderId.current}, req: ${requestId}, status: ${res.status})`);
      if (res.status === 401) { router.push("/login"); return; }
      if (!res.ok) throw new Error("خطا در دریافت اطلاعات");
      const data = await res.json();
      setAgent(data.agent);
    } catch (err: any) {
      console.error(`[AGENT_PANEL] fetchAgent error (render: ${renderId.current}, req: ${requestId}):`, err);
      setError(err.message);
      router.push("/login");
    } finally {
      setLoading(false);
    }
  }

  async function fetchStats() {
    const requestId = Math.random().toString(36).slice(2, 9);
    console.log(`[AGENT_PANEL] fetchStats started (render: ${renderId.current}, req: ${requestId})`);
    try {
      const res = await fetch("/api/agent/stats", { credentials: "include" });
      console.log(`[AGENT_PANEL] fetchStats response (render: ${renderId.current}, req: ${requestId}, status: ${res.status})`);
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error(`[AGENT_PANEL] fetchStats error (render: ${renderId.current}, req: ${requestId}):`, err);
    } finally {
      setStatsLoading(false);
    }
  }

  async function handleLogout() {
    try {
      await fetch("/api/operator/auth", { method: "DELETE", credentials: "include" });
      router.push("/login");
    } catch (err) { console.error("Logout error:", err); }
  }

  if (loading) {
    return <Layout ch={<div className="flex flex-1 justify-center items-center text-white">در حال بارگذاری...</div>} />;
  }

  if (error || !agent) {
    return (
      <Layout ch={
        <div className="flex flex-col flex-1 justify-center items-center px-8 gap-4">
          <div className="text-red-400 text-center">{error || "خطای نامشخص"}</div>
          <button onClick={() => router.push("/login")} className="ba">بازگشت به ورود</button>
        </div>
      } />
    );
  }

  const maxType = stats ? Math.max(stats.byType.buy, stats.byType.sell, stats.byType.invest, 1) : 1;
  const maxMonthly = stats ? Math.max(...stats.monthly.map((m) => m.count), 1) : 1;
  const maxWeekly = stats ? Math.max(...stats.weekly.map((w) => w.count), 1) : 1;

  return (
    <Layout
      ch={
        <div className="flex flex-col flex-1 px-6 py-8 gap-6">
          {/* Header */}
          <GlassCard cls="w-full p-6" ch={
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-white text-3xl font-bold">🎯 پنل نماینده</h1>
                <p className="text-white/60 mt-1">خوش آمدید، {agent.username}</p>
              </div>
              <button onClick={handleLogout} className="px-4 py-2 bg-red-600/30 hover:bg-red-600/50 text-red-400 rounded-lg transition text-sm">خروج</button>
            </div>
          } />

          {/* Stats */}
          {statsLoading ? (
            <div className="text-white/50 text-center py-4">در حال بارگذاری آمار...</div>
          ) : stats ? (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <GlassCard cls="p-4" ch={
                  <div className="text-center">
                    <div className="text-3xl mb-1">📝</div>
                    <div className="text-white text-2xl font-bold">{stats.totalForms}</div>
                    <div className="text-white/60 text-xs mt-1">کل فرم‌ها</div>
                  </div>
                } />
                <GlassCard cls="p-4" ch={
                  <div className="text-center">
                    <div className="text-3xl mb-1">👥</div>
                    <div className="text-white text-2xl font-bold">{stats.uniqueCustomers}</div>
                    <div className="text-white/60 text-xs mt-1">مشتریان منحصربه‌فرد</div>
                  </div>
                } />
                <GlassCard cls="p-4" ch={
                  <div className="text-center">
                    <div className="text-3xl mb-1">📊</div>
                    <div className="text-white text-2xl font-bold">{stats.byType.buy + stats.byType.sell + stats.byType.invest}</div>
                    <div className="text-white/60 text-xs mt-1">تمامی درخواست‌ها</div>
                  </div>
                } />
                <GlassCard cls="p-4" ch={
                  <div className="text-center">
                    <div className="text-3xl mb-1">📈</div>
                    <div className="text-[#51BB70] text-2xl font-bold">{stats.byType.buy}</div>
                    <div className="text-white/60 text-xs mt-1">خرید</div>
                  </div>
                } />
              </div>

              {/* Charts Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Weekly trend - now first */}
                <GlassCard cls="w-full p-6" ch={
                  <div>
                    <h3 className="text-white font-bold text-lg mb-4">روند هفتگی (۴ هفته اخیر)</h3>
                    <div className="flex items-end gap-3 h-28">
                      {stats.weekly.map((w) => {
                        const pct = (w.count / maxWeekly) * 100;
                        return (
                          <div key={w.week} className="flex-1 flex flex-col items-center gap-1">
                            <span className="text-white/40 text-[10px]">{w.count || ""}</span>
                            <div
                              className="w-full rounded-t transition-all duration-500"
                              style={{ height: `${Math.max(pct, 2)}%`, backgroundColor: w.count > 0 ? "#3B82F6" : "#ffffff15" }}
                              title={`هفته ${w.week.slice(-2)}: ${w.count}`}
                            />
                            <span className="text-white/40 text-[10px]">هفته {w.week.slice(-2)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                } />

                {/* Breakdown by type */}
                <GlassCard cls="w-full p-6" ch={
                  <div>
                    <h3 className="text-white font-bold text-lg mb-4">تفکیک بر اساس نوع فرم</h3>
                    <div className="space-y-3">
                      <MiniBar label="خرید" value={stats.byType.buy} max={maxType} color="#51BB70" />
                      <MiniBar label="فروش" value={stats.byType.sell} max={maxType} color="#3B82F6" />
                      <MiniBar label="سرمایه‌گذاری" value={stats.byType.invest} max={maxType} color="#F59E0B" />
                    </div>
                  </div>
                } />
              </div>

              {/* Monthly trend - now full width at bottom */}
              <GlassCard cls="w-full p-6" ch={
                <div>
                  <h3 className="text-white font-bold text-lg mb-4">روند ماهانه (۱۲ ماه اخیر)</h3>
                  <div className="flex items-end gap-1 h-36 w-full overflow-x-auto pb-2">
                    {stats.monthly.map((m) => {
                      const pct = (m.count / maxMonthly) * 100;
                      const monthLabel = getPersianMonth(m.month + "-15");
                      return (
                        <div key={m.month} className="min-w-[48px] flex-1 flex flex-col items-center gap-1">
                          <span className="text-white/40 text-[10px]">{m.count || ""}</span>
                          <div
                            className="w-full rounded-t transition-all duration-500"
                            style={{ height: `${Math.max(pct, 2)}%`, backgroundColor: m.count > 0 ? "#51BB70" : "#ffffff15" }}
                            title={`${monthLabel}: ${m.count}`}
                          />
                          <span className="text-white/40 text-[10px] truncate max-w-[48px] text-center">{monthLabel?.slice(0, 6) || m.month.slice(-2)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              } />
            </>
          ) : (
            <div className="text-white/50 text-center py-4">خطا در دریافت آمار</div>
          )}

          {/* Navigation Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Link href="/">
              <GlassCard cls="w-full p-6 cursor-pointer hover:border-blue-500/50 transition h-full" ch={
                <div>
                  <div className="text-4xl mb-3">🏠</div>
                  <h2 className="text-xl font-bold text-white">صفحه اصلی سامانه</h2>
                  <p className="text-white/60 mt-2">ورود به صفحه اصلی سیم۲۴ و دسترسی به تمامی امکانات</p>
                </div>
              } />
            </Link>

            <Link href="/agent/panel/forms">
              <GlassCard cls="w-full p-6 cursor-pointer hover:border-blue-500/50 transition h-full" ch={
                <div>
                  <div className="text-4xl mb-3">📋</div>
                  <h2 className="text-xl font-bold text-white">فرم‌های ثبت شده</h2>
                  <p className="text-white/60 mt-2">مشاهده و فیلتر فرم‌های مشتریان شما</p>
                </div>
              } />
            </Link>

            <GlassCard cls="w-full p-6 h-full" ch={
              <div>
                <div className="text-4xl mb-3">🔗</div>
                <h2 className="text-xl font-bold text-white">لینک ورود به سامانه</h2>
                <p className="text-white/60 mt-2 mb-3">این لینک را به مشتریان خود بدهید تا با کلیک روی آن وارد سامانه شوند و خرید/فروش خود را ثبت کنند:</p>
                <code className="block bg-white/5 p-3 rounded-lg text-sm text-blue-400 break-all text-left overflow-auto max-h-20">
                  {`${typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"}/?agentId=${agent.id}`}
                </code>
                <button
                  onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/?agentId=${agent.id}`); }}
                  className="ba mt-3 w-full"
                >📋 کپی لینک</button>
              </div>
            } />
          </div>
        </div>
      }
    />
  );
}