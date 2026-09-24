"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  CircleCheck,
  CircleX,
  FileText,
  MessageSquare,
  Play,
  StickyNote,
  Target,
  ThumbsDown,
  Trophy,
  UserPlus,
} from "lucide-react";
import CrmCard from "@/components/crm/common/CrmCard";
import { crmFetch } from "@/lib/crm/client";

// ─── Types (mirror of API contract, Phase 4.8c) ──────────
type TimelineEntryType =
  | "form_submitted"
  | "workflow_started"
  | "step_assigned"
  | "step_completed"
  | "step_rejected"
  | "communication"
  | "opportunity_created"
  | "opportunity_won"
  | "opportunity_lost"
  | "note_added"
  | "activity";

type TimelineEntry = {
  id: string;
  type: TimelineEntryType;
  title: string;
  description: string | null;
  timestamp: string;
  status?: string | null;
  meta?: Record<string, string | number | null>;
};

// ─── Per-type presentation ───────────────────────────────
const TYPE_FA: Record<TimelineEntryType, string> = {
  form_submitted: "ثبت فرم",
  workflow_started: "شروع فرایند",
  step_assigned: "ارجاع مرحله",
  step_completed: "تکمیل مرحله",
  step_rejected: "رد مرحله",
  communication: "ارتباط",
  opportunity_created: "فرصت جدید",
  opportunity_won: "برد فرصت",
  opportunity_lost: "باخت فرصت",
  note_added: "یادداشت",
  activity: "فعالیت",
};

const TYPE_COLOR: Record<TimelineEntryType, string> = {
  form_submitted: "#51BBFE",
  workflow_started: "#51BB70",
  step_assigned: "#ff8c50",
  step_completed: "#51BB70",
  step_rejected: "#ff7a7a",
  communication: "#51BBFE",
  opportunity_created: "#ff8c50",
  opportunity_won: "#51BB70",
  opportunity_lost: "#ff7a7a",
  note_added: "#a0aabe",
  activity: "#51BBFE",
};

// lucide-react v1 icon names (CheckCircle2/XCircle removed in v1)
const TYPE_ICON: Record<TimelineEntryType, typeof Play> = {
  form_submitted: FileText,
  workflow_started: Play,
  step_assigned: UserPlus,
  step_completed: CircleCheck,
  step_rejected: CircleX,
  communication: MessageSquare,
  opportunity_created: Target,
  opportunity_won: Trophy,
  opportunity_lost: ThumbsDown,
  note_added: StickyNote,
  activity: CalendarClock,
};

const ALL_TYPES = Object.keys(TYPE_FA) as TimelineEntryType[];

const faDateTime = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("fa-IR", {
        year: "numeric", month: "short", day: "numeric",
        hour: "2-digit", minute: "2-digit",
      })
    : "—";

// ─── TimelineTab ─────────────────────────────────────────
export function TimelineTab({ customerId }: { customerId: string }) {
  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [enabled, setEnabled] = useState<Set<TimelineEntryType>>(new Set(ALL_TYPES));
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");

    try {
      const res = await crmFetch(`/api/crm/customers/${customerId}/timeline`);
      if (!res.ok) {
        setErr(res.data?.error?.message || "خطا در بارگذاری تایم‌لاین");
        return;
      }
      setEntries(res.data?.data?.entries ?? []);
    } catch {
      setErr("خطا در بارگذاری تایم‌لاین");
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => { load(); }, [load]);

  const toggleType = (t: TimelineEntryType) => {
    setEnabled((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  };

  const filtered = useMemo(() => {
    const from = fromDate ? new Date(`${fromDate}T00:00:00`).getTime() : null;
    const to = toDate ? new Date(`${toDate}T23:59:59.999`).getTime() : null;
    return entries.filter((e) => {
      if (!enabled.has(e.type)) return false;
      const t = new Date(e.timestamp).getTime();
      if (from !== null && t < from) return false;
      if (to !== null && t > to) return false;
      return true;
    });
  }, [entries, enabled, fromDate, toDate]);

  // Types actually present — only show relevant filter chips
  const presentTypes = useMemo(
    () => ALL_TYPES.filter((t) => entries.some((e) => e.type === t)),
    [entries]
  );

  const dateInputStyle = {
    background: "rgba(10,22,40,0.6)",
    border: "1px solid rgba(81,187,254,0.2)",
  } as const;

  return (
    <CrmCard title="تایم‌لاین فعالیت‌ها">
      {/* ── Filters ── */}
      <div className="flex flex-col gap-3 mb-5" data-testid="timeline-filters">
        <div className="flex flex-wrap gap-2">
          {presentTypes.map((t) => {
            const Icon = TYPE_ICON[t];
            const active = enabled.has(t);
            return (
              <label
                key={t}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold transition-colors cursor-pointer"
                style={{
                  background: active ? `${TYPE_COLOR[t]}2e` : "rgba(10,22,40,0.5)",
                  border: `1px solid ${active ? TYPE_COLOR[t] : "rgba(255,255,255,0.08)"}`,
                  color: active ? TYPE_COLOR[t] : "rgba(255,255,255,0.35)",
                }}
                data-testid={`timeline-filter-${t}`}
                data-active={active}
              >
                <input
                  type="checkbox"
                  checked={active}
                  onChange={() => toggleType(t)}
                  aria-label={`نمایش ${TYPE_FA[t]}`}
                  className="w-3 h-3 cursor-pointer"
                  style={{ accentColor: TYPE_COLOR[t] }}
                />
                <Icon size={12} />
                {TYPE_FA[t]}
              </label>
            );
          })}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-white/40 text-[11px]">از تاریخ</span>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="text-white text-xs px-2 py-1.5 rounded-lg outline-none"
            style={dateInputStyle}
            data-testid="timeline-date-from"
          />
          <span className="text-white/40 text-[11px]">تا تاریخ</span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="text-white text-xs px-2 py-1.5 rounded-lg outline-none"
            style={dateInputStyle}
            data-testid="timeline-date-to"
          />
          {(fromDate || toDate || enabled.size < ALL_TYPES.length) && (
            <button
              onClick={() => { setFromDate(""); setToDate(""); setEnabled(new Set(ALL_TYPES)); }}
              className="text-[11px] font-bold text-[#51BB70] hover:underline mr-1"
            >
              حذف فیلترها
            </button>
          )}
        </div>
      </div>


      {/* ── States ── */}
      {loading && (
        <div className="text-white/40 text-sm text-center py-10" data-testid="timeline-loading">
          در حال بارگذاری…
        </div>
      )}

      {!loading && err && (
        <div className="text-center py-10" data-testid="timeline-error">
          <div className="text-[#ff7a7a] text-sm mb-3">{err}</div>
          <button
            onClick={load}
            className="text-[#51BB70] text-xs font-bold hover:underline"
          >
            تلاش مجدد
          </button>
        </div>
      )}

      {!loading && !err && filtered.length === 0 && (
        <div className="text-white/40 text-sm text-center py-10" data-testid="timeline-empty">
          فعالیتی ثبت نشده است
        </div>
      )}

      {/* ── Vertical timeline ── */}
      {!loading && !err && filtered.length > 0 && (
        <div className="flex flex-col gap-0" data-testid="timeline-list">
          {filtered.map((e, i) => {
            const Icon = TYPE_ICON[e.type];
            const color = TYPE_COLOR[e.type];
            const metaPairs = Object.entries(e.meta || {}).filter(
              ([, v]) => v !== null && v !== undefined && v !== ""
            );
            return (
              <div key={e.id} className="flex gap-3 pb-4 last:pb-0" data-testid="timeline-entry" data-type={e.type}>
                <div className="flex flex-col items-center">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                    style={{ background: `${color}2e`, border: `1px solid ${color}` }}
                  >
                    <Icon size={14} style={{ color }} />
                  </div>
                  {i < filtered.length - 1 && (
                    <div className="w-px flex-1 bg-white/10 my-1" />
                  )}
                </div>
                <div className="flex-1 pb-1 min-w-0">
                  <div className="flex justify-between flex-wrap gap-1 items-start">
                    <span className="text-white text-sm font-bold">{e.title}</span>
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold whitespace-nowrap"
                      style={{ background: `${color}2e`, color }}
                    >
                      {TYPE_FA[e.type]}
                    </span>
                  </div>
                  {e.description && (
                    <div className="text-white/50 text-xs mt-1 whitespace-pre-wrap break-words">
                      {e.description}
                    </div>
                  )}
                  {metaPairs.length > 0 && (
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                      {metaPairs.map(([k, v]) => (
                        <span key={k} className="text-white/35 text-[11px]">
                          {k}: {String(v)}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-white/30 text-[11px]">{faDateTime(e.timestamp)}</span>
                    {e.status && (
                      <span className="text-white/25 text-[11px]">({e.status})</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </CrmCard>
  );
}

export default TimelineTab;
