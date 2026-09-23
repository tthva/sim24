"use client";

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useState } from "react";
import { FlaskConical, Plus, RefreshCw, Trash2, X } from "lucide-react";
import CrmCard from "@/components/crm/common/CrmCard";
import CrmBadge from "@/components/crm/common/CrmBadge";
import CrmButton from "@/components/crm/common/CrmButton";
import CrmTable, { Td, Th } from "@/components/crm/common/CrmTable";
import RuleFormModal, {
  ACTION_OPTIONS,
  TRIGGER_OPTIONS,
  type RuleDraft,
} from "@/components/crm/automation/RuleFormModal";
import { crmFetch } from "@/lib/crm/client";

type Rule = {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  priority: number;
  trigger: string;
  triggerConfig: unknown;
  conditions: { field: string; op: string; value?: unknown }[];
  actions: { type: string; config?: Record<string, unknown> }[];
  runCount: number;
  lastRunAt: string | null;
  createdAt: string;
  createdBy: { id: string; fullName: string | null; username: string } | null;
  _count?: { logs: number };
};

type LogRow = {
  id: string;
  ruleId: string;
  triggeredBy: string;
  entityType: string | null;
  entityId: string | null;
  success: boolean;
  error: string | null;
  durationMs: number | null;
  createdAt: string;
};

type TestResult = { conditionsMatched: boolean; wouldRunActions: string[]; error?: string };

type FilterKey = "all" | "active" | "inactive";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "همه" },
  { key: "active", label: "فعال" },
  { key: "inactive", label: "غیرفعال" },
];

const triggerLabel = (t: string) => TRIGGER_OPTIONS.find((o) => o.value === t)?.label ?? t;
const actionLabel = (t: string) => ACTION_OPTIONS.find((o) => o.value === t)?.label ?? t;

const faNum = (n: number) => (Number.isFinite(n) ? n : 0).toLocaleString("fa-IR");
const faDateTime = (iso: string | null) => (iso ? new Date(iso).toLocaleString("fa-IR") : "—");

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

export default function AutomationSettingsPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editingRule, setEditingRule] = useState<Rule | null>(null);
  const [detail, setDetail] = useState<{ rule: Rule; logs: LogRow[] } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [testTarget, setTestTarget] = useState<Rule | null>(null);
  const [testSample, setTestSample] = useState("{}");
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  const showMsg = (m: string) => {
    setFlash(m);
    setTimeout(() => setFlash(""), 3000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ limit: "100" });
    if (filter !== "all") params.set("isActive", filter === "active" ? "true" : "false");

    const res = await crmFetch(`/api/crm/automation/rules?${params.toString()}`);
    if (res.ok) {
      setRules(Array.isArray(res.data?.data?.rules) ? res.data.data.rules : []);
      setTotal(res.data?.data?.total ?? 0);
    } else {
      setError(res.data?.error?.message || `خطا در دریافت قوانین (${res.status})`);
      setRules([]);
    }
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleRule = async (rule: Rule) => {
    const res = await crmFetch(`/api/crm/automation/rules/${rule.id}/toggle`, { method: "POST" });
    if (res.ok) {
      showMsg(res.data?.data?.isActive ? "قانون فعال شد ✓" : "قانون غیرفعال شد ✓");
      load();
    } else {
      showMsg(`خطا: ${res.data?.error?.message ?? res.status}`);
    }
  };

  const deleteRule = async (rule: Rule) => {
    if (!window.confirm(`حذف قانون «${rule.name}»؟ لاگ‌های آن هم حذف می‌شود.`)) return;
    const res = await crmFetch(`/api/crm/automation/rules/${rule.id}`, { method: "DELETE" });
    if (res.ok) {
      showMsg("قانون حذف شد ✓");
      setDetail(null);
      load();
    } else {
      showMsg(`خطا: ${res.data?.error?.message ?? res.status}`);
    }
  };

  const openDetail = async (rule: Rule) => {
    setDetail({ rule, logs: [] });
    setDetailLoading(true);
    setDetailError(null);
    const [detailRes, logsRes] = await Promise.all([
      crmFetch(`/api/crm/automation/rules/${rule.id}`),
      // The detail route also embeds the last 20 logs; the dedicated logs
      // endpoint is used so history matches the documented API path.
      crmFetch(`/api/crm/automation/logs?ruleId=${rule.id}&limit=20`),
    ]);
    const fullRule: Rule = detailRes.ok ? (detailRes.data?.data ?? rule) : rule;
    const logs: LogRow[] =
      logsRes.ok && Array.isArray(logsRes.data?.data?.logs) ? logsRes.data.data.logs : [];
    setDetail({ rule: fullRule, logs });
    if (!detailRes.ok || !logsRes.ok) setDetailError("بخشی از داده‌های جزئیات دریافت نشد");
    setDetailLoading(false);
  };

  const openTest = (rule: Rule) => {
    setTestTarget(rule);
    setTestSample("{}");
    setTestResult(null);
    setTestError(null);
  };

  const submitTest = async () => {
    if (!testTarget) return;
    let sample: unknown;
    try {
      sample = testSample.trim() ? JSON.parse(testSample) : {};
    } catch {
      setTestError("نمونه داده باید JSON معتبر باشد");
      return;
    }
    setTesting(true);
    setTestError(null);
    const res = await crmFetch(`/api/crm/automation/rules/${testTarget.id}/test`, {
      method: "POST",
      body: { sampleData: sample },
    });
    setTesting(false);
    if (res.ok) setTestResult(res.data?.data ?? null);
    else setTestError(res.data?.error?.message || `خطا در اجرای آزمایشی (${res.status})`);
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Header + filters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-white text-xl font-black" data-testid="crm-automation-title">
          اتوماسیون
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <div
            className="flex rounded-xl overflow-hidden"
            style={{ border: "1px solid rgba(81,187,254,0.2)" }}
            data-testid="crm-rule-filters"
          >
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                data-testid={`crm-rule-filter-${f.key}`}
                className={`px-4 py-2 text-xs font-bold transition-colors ${
                  filter === f.key ? "bg-[#51BB70] text-[#011B2C]" : "text-white/60 hover:bg-white/10"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <button
            onClick={load}
            className="p-2 rounded-xl text-white/50 hover:text-white hover:bg-white/10"
            aria-label="بروزرسانی"
            data-testid="crm-rule-refresh"
          >
            <RefreshCw size={16} />
          </button>
          <CrmButton
            onClick={() => {
              setEditingRule(null);
              setShowForm(true);
            }}
          >
            <span className="flex items-center gap-1" data-testid="crm-new-rule">
              <Plus size={16} /> قانون جدید
            </span>
          </CrmButton>
        </div>
      </div>

      {error && (
        <div
          className="rounded-xl px-4 py-3 text-sm text-[#ff7a7a]"
          style={{ background: "rgba(92,50,50,0.25)", border: "1px solid rgba(255,122,122,0.3)" }}
          data-testid="crm-automation-error"
        >
          {error}
        </div>
      )}

      {/* Rules list */}
      <CrmCard
        title={`قوانین اتوماسیون (${faNum(rules.length)} از ${faNum(total)})`}
        action={
          flash ? (
            <span className="text-[#51BB70] text-[11px]" data-testid="crm-automation-flash">
              {flash}
            </span>
          ) : undefined
        }
      >
        {loading && rules.length === 0 ? (
          <Spinner />
        ) : (
          <CrmTable
            head={
              <>
                <Th>نام</Th>
                <Th>تریگر</Th>
                <Th>اولویت</Th>
                <Th>وضعیت</Th>
                <Th>اجراها</Th>
                <Th>آخرین اجرا</Th>
                <Th>عملیات</Th>
              </>
            }
            empty={rules.length === 0 ? "قانونی یافت نشد" : undefined}
          >
            {rules.map((r) => (
              <tr key={r.id} className="hover:bg-white/5" data-testid={`crm-rule-row-${r.name}`}>
                <Td>
                  <div className="text-white font-bold text-xs">{r.name}</div>
                  {r.description && (
                    <div className="text-white/40 text-[11px] mt-0.5">{r.description}</div>
                  )}
                </Td>
                <Td>
                  <CrmBadge label={triggerLabel(r.trigger)} />
                </Td>
                <Td>
                  <span className="text-white/70 text-xs">{faNum(r.priority)}</span>
                </Td>
                <Td>
                  <button
                    onClick={() => toggleRule(r)}
                    data-testid={`crm-rule-toggle-${r.id}`}
                    aria-label={r.isActive ? "غیرفعال کردن" : "فعال کردن"}
                    className="relative w-10 h-5 rounded-full transition-colors"
                    style={{ background: r.isActive ? "#51BB70" : "rgba(255,255,255,0.15)" }}
                  >
                    <span
                      className="absolute top-0.5 w-4 h-4 rounded-full bg-white"
                      style={r.isActive ? { right: 2 } : { left: 2 }}
                    />
                  </button>
                </Td>
                <Td>
                  <span className="text-white/70 text-xs">{faNum(r.runCount)}</span>
                </Td>
                <Td>
                  <span className="text-white/40 text-[11px]">{faDateTime(r.lastRunAt)}</span>
                </Td>
                <Td>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => openDetail(r)}
                      className="text-[#51BBFE] text-xs font-bold hover:underline"
                      data-testid={`crm-rule-detail-${r.id}`}
                    >
                      جزئیات
                    </button>
                    <button
                      onClick={() => openTest(r)}
                      className="text-[#ffd166] text-xs font-bold hover:underline"
                      data-testid={`crm-rule-test-${r.id}`}
                    >
                      تست
                    </button>
                    <button
                      onClick={() => {
                        setEditingRule(r);
                        setShowForm(true);
                      }}
                      className="text-[#51BB70] text-xs font-bold hover:underline"
                      data-testid={`crm-rule-edit-${r.id}`}
                    >
                      ویرایش
                    </button>
                  </div>
                </Td>
              </tr>
            ))}
          </CrmTable>
        )}
      </CrmCard>
      {/* Rule detail panel */}
      {detail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setDetail(null)}
          data-testid="crm-rule-detail-panel"
        >
          <div
            className="rounded-2xl p-5 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            style={{ background: "#11223d" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <div className="text-white font-bold">{detail.rule.name}</div>
                {detail.rule.description && (
                  <div className="text-white/40 text-xs mt-1">{detail.rule.description}</div>
                )}
              </div>
              <button
                onClick={() => setDetail(null)}
                className="text-white/40 hover:text-white"
                aria-label="بستن"
                data-testid="crm-rule-detail-close"
              >
                <X size={18} />
              </button>
            </div>

            {detailError && <div className="text-[#ff7a7a] text-xs mb-3">{detailError}</div>}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <div className="rounded-xl p-3" style={{ background: "rgba(10,22,40,0.6)" }}>
                <div className="text-white/40 text-[11px]">تریگر</div>
                <div className="text-white text-xs font-bold mt-1">{triggerLabel(detail.rule.trigger)}</div>
              </div>
              <div className="rounded-xl p-3" style={{ background: "rgba(10,22,40,0.6)" }}>
                <div className="text-white/40 text-[11px]">اولویت</div>
                <div className="text-white text-xs font-bold mt-1">{faNum(detail.rule.priority)}</div>
              </div>
              <div className="rounded-xl p-3" style={{ background: "rgba(10,22,40,0.6)" }}>
                <div className="text-white/40 text-[11px]">وضعیت</div>
                <div className="mt-1">
                  <CrmBadge
                    label={detail.rule.isActive ? "فعال" : "غیرفعال"}
                    tone={detail.rule.isActive ? "active" : "inactive"}
                  />
                </div>
              </div>
              <div className="rounded-xl p-3" style={{ background: "rgba(10,22,40,0.6)" }}>
                <div className="text-white/40 text-[11px]">اجراها</div>
                <div className="text-white text-xs font-bold mt-1">{faNum(detail.rule.runCount)}</div>
              </div>
            </div>

            <div className="text-white/40 text-[11px]">
              سازنده: {detail.rule.createdBy?.fullName ?? detail.rule.createdBy?.username ?? "—"} · ایجاد:{" "}
              {faDateTime(detail.rule.createdAt)} · آخرین اجرا: {faDateTime(detail.rule.lastRunAt)}
            </div>

            <div className="text-white/80 text-xs font-bold mt-4 mb-2">شرایط</div>
            <div className="flex flex-col gap-1" data-testid="crm-detail-conditions">
              {(detail.rule.conditions ?? []).map((c, i) => (
                <div key={i} className="text-white/60 text-xs font-mono" dir="ltr">
                  {c.field} {c.op} {c.value === undefined ? "" : JSON.stringify(c.value)}
                </div>
              ))}
              {(detail.rule.conditions ?? []).length === 0 && (
                <div className="text-white/30 text-[11px]">بدون شرط</div>
              )}
            </div>
            <div className="text-white/80 text-xs font-bold mt-4 mb-2">اقدام‌ها</div>
            <div className="flex flex-col gap-2" data-testid="crm-detail-actions">
              {(detail.rule.actions ?? []).map((a, i) => (
                <div
                  key={i}
                  className="rounded-xl p-3"
                  style={{ background: "rgba(10,22,40,0.6)", border: "1px solid rgba(81,187,254,0.15)" }}
                >
                  <div className="text-white text-xs font-bold">{actionLabel(a.type)}</div>
                  <div className="text-white/50 text-[11px] font-mono mt-1 whitespace-pre-wrap" dir="ltr">
                    {JSON.stringify(a.config ?? {}, null, 2)}
                  </div>
                </div>
              ))}
              {(detail.rule.actions ?? []).length === 0 && (
                <div className="text-white/30 text-[11px]">اقدامی تعریف نشده</div>
              )}
            </div>

            <div className="text-white/80 text-xs font-bold mt-4 mb-2">
              لاگ‌های اخیر{" "}
              {detailLoading && <span className="text-white/30 font-normal">(در حال بارگذاری…)</span>}
            </div>
            <div className="flex flex-col gap-1 max-h-64 overflow-y-auto" data-testid="crm-detail-logs">
              {detail.logs.map((l) => (
                <div
                  key={l.id}
                  className="flex items-center justify-between gap-2 rounded-lg px-3 py-2"
                  style={{ background: "rgba(10,22,40,0.5)" }}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <CrmBadge label={l.success ? "موفق" : "ناموفق"} tone={l.success ? "active" : "inactive"} />
                    <span className="text-white/60 text-[11px] truncate" dir="ltr">
                      {l.triggeredBy}
                    </span>
                    {l.error && <span className="text-[#ff7a7a] text-[11px] truncate">{l.error}</span>}
                  </div>
                  <span className="text-white/30 text-[11px] shrink-0">{faDateTime(l.createdAt)}</span>
                </div>
              ))}
              {detail.logs.length === 0 && !detailLoading && (
                <div className="text-white/30 text-[11px]">لاگی ثبت نشده است</div>
              )}
            </div>

            <div className="flex flex-wrap gap-2 mt-5">
              <CrmButton variant="ghost" onClick={() => toggleRule(detail.rule)}>
                {detail.rule.isActive ? "غیرفعال کردن" : "فعال کردن"}
              </CrmButton>
              <CrmButton
                variant="ghost"
                onClick={() => {
                  setEditingRule(detail.rule);
                  setShowForm(true);
                }}
              >
                ویرایش
              </CrmButton>
              <CrmButton variant="danger" onClick={() => deleteRule(detail.rule)}>
                <span className="flex items-center gap-1" data-testid="crm-rule-delete">
                  <Trash2 size={14} /> حذف
                </span>
              </CrmButton>
            </div>

          </div>
        </div>
      )}
      {/* Test modal */}
      {testTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setTestTarget(null)}
          data-testid="crm-rule-test-modal"
        >
          <div
            className="rounded-2xl p-5 w-full max-w-lg max-h-[90vh] overflow-y-auto"
            style={{ background: "#11223d" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-1">
              <div className="text-white font-bold flex items-center gap-2">
                <FlaskConical size={16} /> اجرای آزمایشی
              </div>
              <button
                onClick={() => setTestTarget(null)}
                className="text-white/40 hover:text-white"
                aria-label="بستن"
                data-testid="crm-rule-test-close"
              >
                <X size={18} />
              </button>
            </div>
            <div className="text-white/40 text-xs mb-3">{testTarget.name}</div>

            <label className="block text-white/60 text-xs mb-1">
              نمونه داده (JSON) — فقط شرایط ارزیابی می‌شود، هیچ اقدامی اجرا نمی‌شود
            </label>
            <textarea
              value={testSample}
              onChange={(e) => setTestSample(e.target.value)}
              rows={6}
              dir="ltr"
              placeholder='{"customerId":"...","phone":"0912...","segment":"vip"}'
              className="w-full rounded-lg px-3 py-2 text-xs bg-[#0b1a2e] text-white border border-white/10 outline-none font-mono"
              data-testid="crm-test-sample"
            />

            {testError && <div className="text-[#ff7a7a] text-xs mt-3">{testError}</div>}

            {testResult && (
              <div
                className="rounded-xl p-3 mt-3"
                style={{ background: "rgba(10,22,40,0.6)", border: "1px solid rgba(81,187,254,0.15)" }}
                data-testid="crm-test-result"
              >
                <div className="flex items-center gap-2">
                  <span className="text-white/50 text-xs">نتیجه شرط‌ها:</span>
                  <CrmBadge
                    label={testResult.conditionsMatched ? "مطابقت دارد" : "مطابقت ندارد"}
                    tone={testResult.conditionsMatched ? "active" : "inactive"}
                  />
                </div>
                <div className="text-white/50 text-xs mt-2">
                  اقدام‌هایی که اجرا می‌شدند:{" "}
                  <span className="text-white/80">
                    {testResult.wouldRunActions.length > 0
                      ? testResult.wouldRunActions.map(actionLabel).join("، ")
                      : "—"}
                  </span>
                </div>
                {testResult.error && (
                  <div className="text-[#ff7a7a] text-xs mt-2">{testResult.error}</div>
                )}
              </div>
            )}

            <div className="flex gap-2 mt-5">
              <CrmButton onClick={submitTest} disabled={testing} className="flex-1">
                {testing ? "در حال اجرا…" : "اجرای آزمایشی"}
              </CrmButton>
              <CrmButton variant="ghost" onClick={() => setTestTarget(null)}>
                بستن
              </CrmButton>
            </div>
          </div>
        </div>
      )}

      {/* Create / edit rule */}
      {showForm && (
        <RuleFormModal
          rule={editingRule as RuleDraft | null}
          onClose={() => {
            setShowForm(false);
            setEditingRule(null);
          }}
          onSaved={() => {
            setShowForm(false);
            setEditingRule(null);
            showMsg("قانون ذخیره شد ✓");
            load();
          }}
        />
      )}



    </div>
  );
}

