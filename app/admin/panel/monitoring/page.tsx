'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Layout from '@/components/Layout';
import GlassCard from '@/components/GlassCard';
import {
  ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';

type Range = '24h' | '7d' | '30d';

const DEPT_FA: Record<string, string> = {
  PRICE: 'قیمت', PRODUCT: 'محصول', SELL: 'فروش', INVESTMENT: 'سرمایه‌گذاری',
};
const STATUS_FA: Record<string, string> = {
  ASSIGNED: 'در انتظار', IN_PROGRESS: 'در حال انجام', COMPLETED: 'تکمیل‌شده',
};
const DEPT_COLORS: Record<string, string> = {
  PRICE: '#51BB70', PRODUCT: '#4C9EEB', SELL: '#F5A623', INVESTMENT: '#B06CE8',
};
const STATUS_COLORS: Record<string, string> = {
  ASSIGNED: '#F5A623', IN_PROGRESS: '#4C9EEB', COMPLETED: '#51BB70',
};

export default function MonitoringPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [paused, setPaused] = useState(false);
  const [range, setRange] = useState<Range>('24h');
  const [department, setDepartment] = useState('');
  const [status, setStatus] = useState('');
  const queryRef = useRef('');
  queryRef.current = `range=${range}&department=${department}&status=${status}`;

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/monitoring?${queryRef.current}`, { credentials: 'include' });
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch (err) {
      console.error('Failed to load monitoring:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // refetch immediately when filters change
  useEffect(() => { load(); }, [load, range, department, status]);

  // auto-refresh every 10s (pause/resume)
  useEffect(() => {
    if (paused) return;
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, [paused, load]);

  // CSV export of SLA tasks (UTF-8 BOM for Excel)
  const exportCsv = () => {
    const rows: any[] = [
      ...(data?.overdueTasks || []).map((t: any) => ({ ...t, sla: 'عقب‌افتاده' })),
      ...(data?.nearDueTasks || []).map((t: any) => ({ ...t, sla: 'نزدیک سررسید' })),
    ];
    const header = ['workflowCode', 'stepName', 'department', 'operator', 'status', 'sla', 'dueAtFa'];
    const csv = [
      header.join(','),
      ...rows.map((r) => header.map((h) => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(',')),
    ].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sim24-sla-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ─── Chart data ───
  const fpd = data?.formsPerDay || [];
  const dept = data?.tasksByDepartment || [];
  const stb = data?.tasksByStatus || [];

  const kpis = [
    { label: 'کل فرم‌ها', value: data?.totalForms ?? 0, color: 'text-white' },
    { label: 'ورک‌فلوهای فعال', value: data?.activeWorkflowCount ?? 0, color: 'text-blue-400' },
    { label: 'تسک‌های در انتظار', value: data?.pendingTasks ?? 0, color: 'text-amber-400' },
    { label: 'تکمیل‌شده امروز', value: data?.completedToday ?? 0, color: 'text-[#51BB70]' },
    { label: 'عقب‌افتاده', value: data?.overdueCount ?? 0, color: (data?.overdueCount ?? 0) > 0 ? 'text-red-400' : 'text-white' },
    { label: 'فرم‌های جدید امروز', value: data?.newFormsToday ?? 0, color: 'text-white' },
  ];

  if (loading) {
    return (
      <Layout wide ch={<div className="flex flex-1 justify-center items-center text-white">در حال بارگذاری...</div>} />
    );
  }

  return (
    <Layout wide ch={
      <div className="flex flex-col flex-1 px-6 py-8 gap-6">
        {/* Header: title + pause/resume + export */}
        <GlassCard cls="w-full p-6" ch={
          <div className="flex flex-wrap justify-between items-center gap-3">
            <h1 className="text-white text-xl font-bold">📊 مانیتورینگ سیستم</h1>
            <div className="flex items-center gap-2">
              <span className="text-white/40 text-sm">
                {paused ? 'بروزرسانی متوقف' : 'بروزرسانی خودکار هر 10 ثانیه'}
              </span>
              <button type="button" onClick={() => setPaused((p) => !p)}
                className={`px-4 py-1.5 text-xs font-bold rounded-xl border transition-all ${
                  paused
                    ? 'bg-[#51BB70]/20 border-[#51BB70]/40 text-[#51BB70] hover:bg-[#51BB70]/30'
                    : 'bg-white/5 border-white/15 text-white/70 hover:bg-white/10'
                }`}>
                {paused ? '▶ ادامه' : '⏸ توقف'}
              </button>
              <button type="button" onClick={exportCsv}
                className="px-4 py-1.5 text-xs font-bold rounded-xl border border-white/15 bg-white/5 text-white/70 hover:bg-white/10 transition-all">
                ⬇ خروجی CSV
              </button>
            </div>
          </div>
        } />

        {/* Filters */}
        <GlassCard cls="w-full p-4" ch={
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-white/50 text-xs">بازه:</span>
            {(['24h', '7d', '30d'] as Range[]).map((r) => (
              <button key={r} type="button" onClick={() => setRange(r)}
                className={`px-3 py-1 text-xs rounded-lg border transition-all ${
                  range === r ? 'bg-[#51BB70]/25 border-[#51BB70]/50 text-white' : 'bg-white/5 border-white/15 text-white/60 hover:bg-white/10'
                }`}>
                {r === '24h' ? '۲۴ ساعت' : r === '7d' ? '۷ روز' : '۳۰ روز'}
              </button>
            ))}
            <span className="text-white/50 text-xs mr-4">دپارتمان:</span>
            <select value={department} onChange={(e) => setDepartment(e.target.value)}
              className="bg-white/5 border border-white/15 rounded-lg px-3 py-1 text-xs text-white focus:outline-none">
              <option value="">همه</option>
              {Object.keys(DEPT_FA).map((d) => <option key={d} value={d}>{DEPT_FA[d]}</option>)}
            </select>
            <span className="text-white/50 text-xs mr-4">وضعیت:</span>
            <select value={status} onChange={(e) => setStatus(e.target.value)}
              className="bg-white/5 border border-white/15 rounded-lg px-3 py-1 text-xs text-white focus:outline-none">
              <option value="">همه</option>
              <option value="ASSIGNED">در انتظار</option>
              <option value="IN_PROGRESS">در حال انجام</option>
            </select>
          </div>
        } />

        {/* KPI Cards (6) */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
          {kpis.map((k) => (
            <GlassCard key={k.label} cls="w-full p-4 text-center" ch={
              <>
                <p className="text-xs text-white/60">{k.label}</p>
                <p className={`text-3xl font-bold mt-2 ${k.color}`}>{k.value}</p>
              </>
            } />
          ))}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Forms per day — LineChart */}
          <GlassCard cls="w-full p-5" ch={
            <div>
              <h3 className="text-white text-sm font-bold mb-4">فرم‌ها در ۷ روز گذشته</h3>
              <div className="h-44" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={fpd} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                    <XAxis dataKey="day" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }} />
                    <YAxis allowDecimals={false} tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{ background: '#11223d', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 12, color: '#fff' }}
                      labelStyle={{ color: 'rgba(255,255,255,0.6)' }}
                    />
                    <Line type="monotone" dataKey="count" name="فرم" stroke="#51BB70" strokeWidth={2.5} dot={{ r: 3, fill: '#51BB70' }} activeDot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          } />

          {/* Tasks by department — PieChart */}
          <GlassCard cls="w-full p-5" ch={
            <div>
              <h3 className="text-white text-sm font-bold mb-2">تسک‌های فعال بر اساس دپارتمان</h3>
              <div className="h-44" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={dept.map((x: any) => ({ name: DEPT_FA[x.dept] || x.dept, value: x.count }))}
                      dataKey="value" nameKey="name"
                      cx="50%" cy="50%" innerRadius={38} outerRadius={62}
                      paddingAngle={3} stroke="rgba(255,255,255,0.15)"
                    >
                      {dept.map((x: any, i: number) => (
                        <Cell key={i} fill={DEPT_COLORS[x.dept] ?? '#888'} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: '#11223d', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 12, color: '#fff' }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          } />

          {/* Task status — BarChart */}
          <GlassCard cls="w-full p-5" ch={
            <div>
              <h3 className="text-white text-sm font-bold mb-2">
                وضعیت تسک‌ها{department ? ` — ${DEPT_FA[department]}` : ''}
              </h3>
              <div className="h-44" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stb.map((x: any) => ({ name: STATUS_FA[x.status] || x.status, count: x.count }))} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                    <XAxis dataKey="name" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }} />
                    <YAxis allowDecimals={false} tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }} />
                    <Tooltip
                      cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                      contentStyle={{ background: '#11223d', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 12, color: '#fff' }}
                    />
                    <Bar dataKey="count" name="تسک" radius={[6, 6, 0, 0]}>
                      {stb.map((x: any, i: number) => (
                        <Cell key={i} fill={STATUS_COLORS[x.status] ?? '#888'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          } />
        </div>

        {/* SLA timers */}
        <GlassCard cls="w-full p-6" ch={
          <div>
            <div className="flex flex-wrap justify-between items-center gap-2 mb-4">
              <h2 className="text-lg font-bold">⏱ SLA — سررسید تسک‌ها</h2>
              <div className="flex items-center gap-3 text-xs">
                <span className="text-red-400">🔴 عقب‌افتاده: {data?.overdueCount ?? 0}</span>
                <span className="text-amber-400">🟡 نزدیک سررسید: {data?.nearDueCount ?? 0}</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-white/5">
                    <th className="py-3 px-4 text-right">ورک‌فلو</th>
                    <th className="py-3 px-4 text-right">مرحله</th>
                    <th className="py-3 px-4 text-right">دپارتمان</th>
                    <th className="py-3 px-4 text-right">اپراتور</th>
                    <th className="py-3 px-4 text-right">سررسید</th>
                    <th className="py-3 px-4 text-right">وضعیت SLA</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.overdueList || []).map((t: any) => (
                    <tr key={t.id} className="border-b border-white/5 bg-red-500/5 hover:bg-red-500/10">
                      <td className="py-2 px-4 text-white">{t.workflowCode || '—'}</td>
                      <td className="py-2 px-4">{t.stepName || '—'}</td>
                      <td className="py-2 px-4">{DEPT_FA[t.department] || t.department || '—'}</td>
                      <td className="py-2 px-4">{t.operator || '—'}</td>
                      <td className="py-2 px-4 text-white/60 text-xs">{t.dueAtFa || '—'}</td>
                      <td className="py-2 px-4"><span className="text-red-400 font-bold">🔴 عقب‌افتاده</span></td>
                    </tr>
                  ))}
                  {(data?.nearDueList || []).map((t: any) => (
                    <tr key={t.id} className="border-b border-white/5 bg-amber-500/5 hover:bg-amber-500/10">
                      <td className="py-2 px-4 text-white">{t.workflowCode || '—'}</td>
                      <td className="py-2 px-4">{t.stepName || '—'}</td>
                      <td className="py-2 px-4">{DEPT_FA[t.department] || t.department || '—'}</td>
                      <td className="py-2 px-4">{t.operator || '—'}</td>
                      <td className="py-2 px-4 text-white/60 text-xs">{t.dueAtFa || '—'}</td>
                      <td className="py-2 px-4"><span className="text-amber-400 font-bold">🟡 نزدیک سررسید</span></td>
                    </tr>
                  ))}
                  {!(data?.overdueList?.length || data?.nearDueList?.length) && (
                    <tr><td colSpan={6} className="py-6 text-center text-white/40">تسکی با مشکل SLA وجود ندارد ✓</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        } />

        {/* Active Workflows */}
        <GlassCard cls="w-full p-6" ch={
          <div>
            <h2 className="text-lg font-bold mb-4">ورک‌فلوهای فعال</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-white/5">
                    <th className="py-3 px-4 text-right">ورک‌فلو</th>
                    <th className="py-3 px-4 text-right">مرحله فعلی</th>
                    <th className="py-3 px-4 text-right">دپارتمان</th>
                    <th className="py-3 px-4 text-right">اپراتور</th>
                    <th className="py-3 px-4 text-right">وضعیت</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.activeWorkflows || []).map((w: any) => (
                    <tr key={w.id} className="border-b border-white/5 hover:bg-white/5">
                      <td className="py-2 px-4">
                        <div className="text-white">{w.workflowCode || '—'}</div>
                        <div className="text-white/40 text-xs">{w.workflowTitle || ''}</div>
                      </td>
                      <td className="py-2 px-4">{w.currentStepName || '—'}</td>
                      <td className="py-2 px-4">{DEPT_FA[w.currentStepDepartment] || w.currentStepDepartment || '—'}</td>
                      <td className="py-2 px-4">{w.assignedOperator || '—'}</td>
                      <td className="py-2 px-4">
                        <span className={w.status === 'IN_PROGRESS' ? 'text-blue-400' : 'text-yellow-400'}>
                          {w.status === 'IN_PROGRESS' ? 'در حال انجام' : 'در انتظار'}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {!(data?.activeWorkflows?.length > 0) && (
                    <tr><td colSpan={5} className="py-6 text-center text-white/40">ورک‌فلوی فعالی موجود نیست</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        } />

        {/* Latest Forms */}
        <GlassCard cls="w-full p-6 flex-1" ch={
          <div>
            <h2 className="text-lg font-bold mb-4">آخرین فرم‌ها</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-white/5">
                    <th className="py-3 px-4 text-right">نام مشتری</th>
                    <th className="py-3 px-4 text-right">کد فرم</th>
                    <th className="py-3 px-4 text-right">وضعیت</th>
                    <th className="py-3 px-4 text-right">تاریخ</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.latestForms || []).map((f: any) => (
                    <tr key={f.id} className="border-b border-white/5">
                      <td className="py-2 px-4">{f.fullName || '—'}</td>
                      <td className="py-2 px-4">{f.workflowCode || '—'}</td>
                      <td className="py-2 px-4">
                        <span className={f.workflowStarted ? 'text-[#51BB70]' : 'text-red-400'}>
                          {f.workflowStarted ? 'شروع شده' : 'ناموفق'}
                        </span>
                      </td>
                      <td className="py-2 px-4 text-white/60 text-xs">{f.createdAtFa || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        } />
      </div>
    } />
  );
}
