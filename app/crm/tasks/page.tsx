"use client";

export const dynamic = "force-dynamic";

import { useMemo, useState } from "react";
import useSWR from "swr";

type Task = {
  id: string;
  type: string;
  title: string;
  description: string | null;
  dueAt: string | null;
  completedAt: string | null;
  priority: "low" | "normal" | "high" | "urgent";
  status: "pending" | "completed" | "cancelled";
  assignedTo: { id: string; fullName: string | null; username: string } | null;
  customer: { id: string; fullName: string | null; customerCode: string } | null;
};

type Recurring = {
  id: string;
  title: string;
  description: string | null;
  cronExpr: string;
  priority: string;
  isActive: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
  assignedTo: { id: string; fullName: string | null; username: string } | null;
};

const get = (url: string) => fetch(url, { credentials: "include" }).then((r) => r.json());

const PRIORITY_FA: Record<string, string> = {
  low: "کم", normal: "معمولی", high: "بالا", urgent: "فوری",
};
const PRIORITY_COLOR: Record<string, string> = {
  low: "#9ca3af", normal: "#51BB70", high: "#ff8c50", urgent: "#ef4444",
};
const BUCKET_LABEL: Record<string, string> = {
  overdue: "عقب‌افتاده", today: "امروز", tomorrow: "فردا", week: "این هفته", later: "بعداً",
};

export function groupByDue(tasks: Task[]): Record<string, Task[]> {
  const buckets: Record<string, Task[]> = { overdue: [], today: [], tomorrow: [], week: [], later: [] };
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = 86_400_000;
  for (const t of tasks) {
    if (!t.dueAt) { buckets.later.push(t); continue; }
    const due = new Date(t.dueAt);
    if (due < startOfToday) buckets.overdue.push(t);
    else if (due < new Date(+startOfToday + day)) buckets.today.push(t);
    else if (due < new Date(+startOfToday + 2 * day)) buckets.tomorrow.push(t);
    else if (due < new Date(+startOfToday + 7 * day)) buckets.week.push(t);
    else buckets.later.push(t);
  }
  return buckets;
}

export function nextRunFromCron(expr: string): Date | null {
  const fields = expr.trim().split(/\s+/);
  if (fields.length !== 5) return null;
  const m = /^\d+$/.test(fields[0]) ? Number(fields[0]) : 0;
  const h = /^\d+$/.test(fields[1]) ? Number(fields[1]) : 9;
  const now = new Date();
  const cand = new Date(now);
  cand.setHours(h, m, 0, 0);
  if (cand <= now) cand.setDate(cand.getDate() + 1);
  if (/^\d$/.test(fields[4])) {
    const target = Number(fields[4]);
    for (let i = 0; i < 8 && cand.getDay() !== target; i++) cand.setDate(cand.getDate() + 1);
  }
  return cand;
}

const emptyTaskForm = { title: "", type: "followup", description: "", dueAt: "", priority: "normal" };
const emptyRecForm = { title: "", description: "", recurrence: "daily", priority: "normal" };
const CRON_MAP: Record<string, string> = {
  daily: "0 9 * * *",
  weekly: "0 9 * * 6",
  monthly: "0 9 1 * *",
};

export default function TasksPage() {
  const [tab, setTab] = useState<"mine" | "recurring">("mine");
  const { data: taskData, mutate: refreshTasks } = useSWR("/api/crm/tasks?mine=true&limit=200", get, {
    refreshInterval: 30_000, revalidateOnFocus: false,
  });
  const { data: recData, mutate: refreshRec } = useSWR("/api/crm/tasks/recurring", get, {
    refreshInterval: 30_000, revalidateOnFocus: false,
  });
  const tasks: Task[] = Array.isArray(taskData?.data) ? taskData.data : [];
  const recurring: Recurring[] = Array.isArray(recData?.data) ? recData.data : [];

  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showRecModal, setShowRecModal] = useState(false);
  const [flash, setFlash] = useState("");
  const [taskForm, setTaskForm] = useState(emptyTaskForm);
  const [recForm, setRecForm] = useState(emptyRecForm);

  const filtered = tasks.filter(
    (t) => (!statusFilter || t.status === statusFilter) && (!priorityFilter || t.priority === priorityFilter)
  );
  const buckets = useMemo(() => groupByDue(filtered), [filtered]);

  const showMsg = (msg: string) => {
    setFlash(msg);
    setTimeout(() => setFlash(""), 3000);
  };

  const toggleComplete = async (t: Task) => {
    try {
      await fetch(`/api/crm/tasks/${t.id}`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: t.status === "completed" ? "pending" : "completed" }),
      });
      refreshTasks();
    } catch {}
  };

  const toggleRecActive = async (r: Recurring) => {
    try {
      await fetch(`/api/crm/tasks/recurring/${r.id}`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !r.isActive }),
      });
      refreshRec();
    } catch {}
  };

  const removeRec = async (r: Recurring) => {
    if (!confirm(`حذف تسک تکرارشونده «${r.title}»؟`)) return;
    try {
      await fetch(`/api/crm/tasks/recurring/${r.id}`, { method: "DELETE", credentials: "include" });
      refreshRec();
    } catch {}
  };

  const saveTask = async () => {
    try {
      const res = await fetch("/api/crm/tasks", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: taskForm.type, title: taskForm.title,
          description: taskForm.description || undefined,
          priority: taskForm.priority,
          dueAt: taskForm.dueAt ? new Date(taskForm.dueAt).toISOString() : undefined,
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setShowTaskModal(false); setTaskForm(emptyTaskForm); refreshTasks();
        showMsg("تسک ایجاد شد ✓");
      } else showMsg(`خطا: ${json?.error?.message ?? res.status}`);
    } catch { showMsg("خطای شبکه"); }
  };

  const saveRec = async () => {
    try {
      const next = nextRunFromCron(CRON_MAP[recForm.recurrence]);
      const res = await fetch("/api/crm/tasks/recurring", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: recForm.title, description: recForm.description || undefined,
          cronExpr: CRON_MAP[recForm.recurrence], priority: recForm.priority,
          nextRunAt: next ? next.toISOString() : undefined,
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setShowRecModal(false); setRecForm(emptyRecForm); refreshRec();
        showMsg("تسک تکرارشونده ایجاد شد ✓");
      } else showMsg(`خطا: ${json?.error?.message ?? res.status}`);
    } catch { showMsg("خطای شبکه"); }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-white text-2xl font-black">تسک‌ها</h1>
        <button
          onClick={() => (tab === "mine" ? setShowTaskModal(true) : setShowRecModal(true))}
          data-testid={tab === "mine" ? "task-create" : "recurring-create"}
          className="px-4 py-2 rounded-xl text-sm font-bold text-[#011B2C]" style={{ background: "#51BB70" }}>
          {tab === "mine" ? "+ تسک جدید" : "+ تسک تکرارشونده"}
        </button>
      </div>

      <div className="flex gap-2 mb-4">
        <button onClick={() => setTab("mine")} data-testid="tab-mine"
          className="px-4 py-2 rounded-xl text-sm font-bold"
          style={{ background: tab === "mine" ? "#51BB70" : "rgba(255,255,255,0.08)", color: tab === "mine" ? "#011B2C" : "#fff" }}>
          تسک‌های من
        </button>
        <button onClick={() => setTab("recurring")} data-testid="tab-recurring"
          className="px-4 py-2 rounded-xl text-sm font-bold"
          style={{ background: tab === "recurring" ? "#51BB70" : "rgba(255,255,255,0.08)", color: tab === "recurring" ? "#011B2C" : "#fff" }}>
          تسک‌های تکرارشونده
        </button>
        {flash && <span className="text-xs text-white/60 self-center" data-testid="tasks-flash">{flash}</span>}
      </div>

      {tab === "mine" && (
        <>
          <div className="flex gap-2 mb-4">
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg px-3 py-2 text-xs bg-[#11223d] text-white border border-white/10 outline-none">
              <option value="">همه وضعیت‌ها</option>
              <option value="pending">در انتظار</option>
              <option value="completed">تکمیل‌شده</option>
              <option value="cancelled">لغوشده</option>
            </select>
            <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}
              className="rounded-lg px-3 py-2 text-xs bg-[#11223d] text-white border border-white/10 outline-none">
              <option value="">همه اولویت‌ها</option>
              {Object.entries(PRIORITY_FA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>

          {Object.entries(BUCKET_LABEL).map(([key, label]) => {
            const items = buckets[key];
            if (!items?.length) return null;
            return (
              <div key={key} className="mb-5" data-testid={`bucket-${key}`}>
                <div className={`text-sm font-bold mb-2 ${key === "overdue" ? "text-red-400" : "text-white/60"}`}>
                  {label} ({items.length})
                </div>
                {items.map((t) => (
                  <div key={t.id} data-testid={`task-${t.title}`}
                    className="flex items-center gap-3 rounded-xl px-4 py-3 mb-1.5"
                    style={{ background: "#11223d", opacity: t.status === "completed" ? 0.5 : 1 }}>
                    <input type="checkbox" checked={t.status === "completed"}
                      onChange={() => toggleComplete(t)} data-testid={`task-check-${t.title}`}
                      className="w-4 h-4 accent-[#51BB70]" />
                    <div className="flex-1">
                      <div className={`text-sm ${t.status === "completed" ? "text-white/40 line-through" : "text-white"}`}>{t.title}</div>
                      <div className="text-white/40 text-[11px]">
                        {t.dueAt ? new Date(t.dueAt).toLocaleString("fa-IR") : "بدون تاریخ"}
                        {t.customer ? ` · ${t.customer.fullName ?? t.customer.customerCode}` : ""}
                      </div>
                    </div>
                    <span className="text-[10px] px-2 py-1 rounded-lg font-bold"
                      style={{ background: `${PRIORITY_COLOR[t.priority]}22`, color: PRIORITY_COLOR[t.priority] }}>
                      {PRIORITY_FA[t.priority]}
                    </span>
                  </div>
                ))}
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="text-white/40 text-sm py-10 text-center">تسکی یافت نشد</div>
          )}
        </>
      )}

      {tab === "recurring" && (
        <div>
          {recurring.length === 0 && (
            <div className="text-white/40 text-sm py-10 text-center">تسک تکرارشونده‌ای یافت نشد</div>
          )}
          {recurring.map((r) => (
            <div key={r.id} data-testid={`recurring-${r.title}`}
              className="flex items-center gap-3 rounded-xl px-4 py-3 mb-1.5"
              style={{ background: "#11223d", opacity: r.isActive ? 1 : 0.5 }}>
              <div className="flex-1">
                <div className="text-sm text-white">{r.title}</div>
                <div className="text-white/40 text-[11px]" dir="ltr">
                  cron: {r.cronExpr}
                  {r.nextRunAt ? ` · next: ${new Date(r.nextRunAt).toLocaleString("fa-IR")}` : ""}
                </div>
              </div>
              <button onClick={() => toggleRecActive(r)}
                className="px-2 py-1 rounded-lg text-[10px] font-bold"
                style={{ background: r.isActive ? "#51BB70" : "rgba(255,255,255,0.1)", color: r.isActive ? "#011B2C" : "#fff" }}>
                {r.isActive ? "فعال" : "غیرفعال"}
              </button>
              <button onClick={() => removeRec(r)}
                className="px-3 py-1.5 rounded-lg text-xs bg-red-500/20 text-red-300 hover:bg-red-500/30">حذف</button>
            </div>
          ))}
        </div>
      )}

      {showTaskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowTaskModal(false)}>
          <div className="rounded-2xl p-5 w-full max-w-md" style={{ background: "#11223d" }}
            onClick={(e) => e.stopPropagation()} data-testid="task-modal">
            <div className="text-white font-bold mb-4">تسک جدید</div>
            <label className="block text-white/60 text-xs mb-1">عنوان</label>
            <input value={taskForm.title} onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
              data-testid="task-title-input"
              className="w-full rounded-lg px-3 py-2 text-sm bg-[#0b1a2e] text-white border border-white/10 outline-none mb-3" />
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-white/60 text-xs mb-1">نوع</label>
                <select value={taskForm.type} onChange={(e) => setTaskForm({ ...taskForm, type: e.target.value })}
                  className="w-full rounded-lg px-3 py-2 text-sm bg-[#0b1a2e] text-white border border-white/10 outline-none">
                  <option value="call">تماس</option>
                  <option value="meeting">جلسه</option>
                  <option value="note">یادداشت</option>
                  <option value="followup">پیگیری</option>
                </select>
              </div>
              <div>
                <label className="block text-white/60 text-xs mb-1">اولویت</label>
                <select value={taskForm.priority} onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })}
                  className="w-full rounded-lg px-3 py-2 text-sm bg-[#0b1a2e] text-white border border-white/10 outline-none">
                  {Object.entries(PRIORITY_FA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
            </div>
            <label className="block text-white/60 text-xs mb-1">سررسید</label>
            <input type="datetime-local" value={taskForm.dueAt}
              onChange={(e) => setTaskForm({ ...taskForm, dueAt: e.target.value })} data-testid="task-due-input"
              className="w-full rounded-lg px-3 py-2 text-sm bg-[#0b1a2e] text-white border border-white/10 outline-none mb-3" />
            <label className="block text-white/60 text-xs mb-1">توضیحات</label>
            <textarea rows={2} value={taskForm.description}
              onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
              className="w-full rounded-lg px-3 py-2 text-sm bg-[#0b1a2e] text-white border border-white/10 outline-none mb-4 resize-none" />
            <div className="flex gap-2">
              <button onClick={saveTask} disabled={!taskForm.title} data-testid="task-save"
                className="flex-1 py-2 rounded-xl text-sm font-bold text-[#011B2C] disabled:opacity-40" style={{ background: "#51BB70" }}>
                ذخیره
              </button>
              <button onClick={() => setShowTaskModal(false)} className="px-4 py-2 rounded-xl text-sm bg-white/10 text-white">انصراف</button>
            </div>
          </div>
        </div>
      )}

      {showRecModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowRecModal(false)}>
          <div className="rounded-2xl p-5 w-full max-w-md" style={{ background: "#11223d" }}
            onClick={(e) => e.stopPropagation()} data-testid="recurring-modal">
            <div className="text-white font-bold mb-4">تسک تکرارشونده جدید</div>
            <label className="block text-white/60 text-xs mb-1">عنوان</label>
            <input value={recForm.title} onChange={(e) => setRecForm({ ...recForm, title: e.target.value })}
              data-testid="recurring-title-input"
              className="w-full rounded-lg px-3 py-2 text-sm bg-[#0b1a2e] text-white border border-white/10 outline-none mb-3" />
            <label className="block text-white/60 text-xs mb-1">تکرار</label>
            <select value={recForm.recurrence} onChange={(e) => setRecForm({ ...recForm, recurrence: e.target.value })}
              data-testid="recurring-recurrence-select"
              className="w-full rounded-lg px-3 py-2 text-sm bg-[#0b1a2e] text-white border border-white/10 outline-none mb-3">
              <option value="daily">روزانه (۹ صبح)</option>
              <option value="weekly">هفتگی (جمعه ۹ صبح)</option>
              <option value="monthly">ماهانه (۱م ماه، ۹ صبح)</option>
            </select>
            <label className="block text-white/60 text-xs mb-1">اولویت</label>
            <select value={recForm.priority} onChange={(e) => setRecForm({ ...recForm, priority: e.target.value })}
              className="w-full rounded-lg px-3 py-2 text-sm bg-[#0b1a2e] text-white border border-white/10 outline-none mb-4">
              {Object.entries(PRIORITY_FA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <div className="flex gap-2">
              <button onClick={saveRec} disabled={!recForm.title} data-testid="recurring-save"
                className="flex-1 py-2 rounded-xl text-sm font-bold text-[#011B2C] disabled:opacity-40" style={{ background: "#51BB70" }}>
                ذخیره
              </button>
              <button onClick={() => setShowRecModal(false)} className="px-4 py-2 rounded-xl text-sm bg-white/10 text-white">انصراف</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}



