"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Layout from "@/components/Layout";
import GlassCard from "@/components/GlassCard";

// ─── Admin Queue Monitor (Phase 4.8e hardening) ─────────────────
// Live view of the background task queue (lib/queue.ts) via
// GET /api/admin/queue: backend (redis|memory), waiting/active/completed/
// failed counters and registered job handlers. Auto-refreshes every 5 s;
// refresh is manual-fallback via the button when the tab is hidden.

type QueueStats = {
  backend: "redis" | "memory";
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  registeredHandlers: string[];
};

const FA_LABELS: Record<string, string> = {
  backend: "بک‌اند",
  waiting: "در انتظار",
  active: "در حال اجرا",
  completed: "تکمیل‌شده",
  failed: "ناموفق",
};

const BACKEND_FA: Record<string, string> = {
  redis: "رِدیس (پایدار)",
  memory: "حافظه (fallback)",
};

function toFa(n: number): string {
  return n.toLocaleString("fa-IR");
}

export default function AdminQueuePage() {
  const r = useRouter();
  const [stats, setStats] = useState<QueueStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/queue", { credentials: "include" });
      if (res.status === 401 || res.status === 403) {
        r.replace("/admin/login");
        return;
      }
      if (!res.ok) throw new Error("خطا در دریافت وضعیت صف");
      const data = await res.json();
      setStats(data.data);
      setError("");
      setLastUpdated(new Date());
    } catch (err: any) {
      setError(err?.message || "خطای نامشخص");
    } finally {
      setLoading(false);
    }
  }, [r]);

  useEffect(() => {
    fetchStats();
    const timer = setInterval(fetchStats, 5000);
    return () => clearInterval(timer);
  }, [fetchStats]);

  if (loading && !stats) {
    return (
      <Layout
        wide
        ch={<div className="flex flex-1 justify-center items-center text-white">در حال بارگذاری...</div>}
      />
    );
  }

  const counterCards = stats
    ? (["waiting", "active", "completed", "failed"] as const).map((key) => ({
        key,
        value: stats[key],
        color: key === "failed" ? "#ff7a7a" : key === "active" ? "#ffd166" : "#51BB70",
      }))
    : [];

  return (
    <Layout
      wide
      ch={
        <div className="flex flex-col flex-1 px-6 py-8 gap-6">
          <GlassCard
            cls="w-full p-6"
            ch={
              <div className="flex justify-between items-center">
                <div>
                  <h1 className="text-white text-xl font-bold">مانیتور صف پس‌زمینه</h1>
                  {lastUpdated && (
                    <p className="text-white/40 text-xs mt-1" data-testid="queue-updated-at">
                      آخرین بروزرسانی: {lastUpdated.toLocaleTimeString("fa-IR")} • بروزرسانی خودکار هر ۵ ثانیه
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={fetchStats} className="bg-white/15 text-white text-sm rounded px-4 py-2 hover:bg-white/25">
                    بروزرسانی
                  </button>
                  <button onClick={() => r.back()} className="text-white/60 text-sm">
                    بازگشت
                  </button>
                </div>
              </div>
            }
          />

          {error && (
            <GlassCard cls="w-full p-6" ch={<div className="text-[#ff7a7a] text-center" data-testid="queue-error">{error}</div>} />
          )}

          {stats && (
            <>
              <GlassCard
                cls="w-full p-6"
                ch={
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4" data-testid="queue-stats">
                    <div className="bg-white/5 rounded-xl p-4">
                      <div className="text-white/50 text-sm">{FA_LABELS.backend}</div>
                      <div
                        className={`text-lg font-bold mt-1 ${stats.backend === "redis" ? "text-[#51BB70]" : "text-[#ffd166]"}`}
                        data-testid="queue-backend"
                      >
                        {BACKEND_FA[stats.backend] || stats.backend}
                      </div>
                    </div>
                    {counterCards.map((c) => (
                      <div key={c.key} className="bg-white/5 rounded-xl p-4">
                        <div className="text-white/50 text-sm">{FA_LABELS[c.key]}</div>
                        <div className="text-2xl font-bold mt-1" style={{ color: c.color }} data-testid={`queue-${c.key}`}>
                          {toFa(c.value)}
                        </div>
                      </div>
                    ))}
                  </div>
                }
              />

              {stats.failed > 0 && (
                <GlassCard
                  cls="w-full p-6"
                  ch={
                    <div className="text-[#ff7a7a] text-sm" data-testid="queue-dead-letter-warning">
                      ⚠️ {toFa(stats.failed)} job پس از {toFa(3)} تلاش در dead-letter باقی مانده است. جزئیات در لاگ سرور
                      (برچسب <span className="font-mono">[QUEUE]</span>) موجود است.
                    </div>
                  }
                />
              )}

              <GlassCard
                cls="w-full p-6 flex-1"
                ch={
                  <div>
                    <h3 className="text-white font-bold text-sm mb-3">اجراکارنده‌های ثبت‌شده (Handlers)</h3>
                    {stats.registeredHandlers.length === 0 ? (
                      <div className="text-white/40 text-sm text-center py-6" data-testid="queue-handlers-empty">
                        هیچ اجراکارنده‌ای در این فرایند ثبت نشده است
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2" data-testid="queue-handlers">
                        {stats.registeredHandlers.map((h) => (
                          <span
                            key={h}
                            className="bg-white/10 rounded-lg px-3 py-2 text-sm text-white font-mono"
                          >
                            {h}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                }
              />
            </>
          )}
        </div>
      }
    />
  );
}
