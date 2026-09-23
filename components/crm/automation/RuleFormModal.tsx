"use client";

import { useState } from "react";
import CrmButton from "@/components/crm/common/CrmButton";
import { crmFetch } from "@/lib/crm/client";

// ─── Allow-lists mirror app/api/crm/automation/rules (the route is the authority) ───
export const TRIGGER_OPTIONS: { value: string; label: string }[] = [
  { value: "form_submitted", label: "ارسال فرم" },
  { value: "task_completed", label: "تکمیل تسک" },
  { value: "task_rejected", label: "رد تسک" },
  { value: "communication_received", label: "دریافت ارتباط" },
  { value: "stage_changed", label: "تغییر مرحله" },
  { value: "customer_created", label: "ایجاد مشتری" },
  { value: "opportunity_won", label: "برنده شدن فرصت" },
  { value: "no_activity_days", label: "عدم فعالیت (روز)" },
];

export const OPERATOR_OPTIONS: { value: string; label: string }[] = [
  { value: "eq", label: "= (eq)" },
  { value: "ne", label: "≠ (ne)" },
  { value: "gt", label: "> (gt)" },
  { value: "lt", label: "< (lt)" },
  { value: "gte", label: "≥ (gte)" },
  { value: "lte", label: "≤ (lte)" },
  { value: "contains", label: "شامل (contains)" },
  { value: "not_contains", label: "شامل نباشد (not_contains)" },
  { value: "in", label: "در فهرست (in)" },
  { value: "not_in", label: "در فهرست نباشد (not_in)" },
  { value: "exists", label: "وجود دارد (exists)" },
  { value: "not_exists", label: "وجود ندارد (not_exists)" },
];

export const ACTION_OPTIONS: { value: string; label: string }[] = [
  { value: "send_sms", label: "ارسال پیامک" },
  { value: "send_notification", label: "ارسال اعلان" },
  { value: "create_task", label: "ایجاد تسک" },
  { value: "update_customer", label: "بروزرسانی مشتری" },
  { value: "webhook", label: "وبهوک" },
];

// Defaults follow lib/crm/automation-engine.ts executeAction(), which reads
// action.config — so the builder always writes { type, config }.
export const ACTION_CONFIG_TEMPLATES: Record<string, Record<string, unknown>> = {
  send_sms: { message: "سلام، پیام خودکار SIM24" },
  send_notification: { title: "اعلان خودکار", body: "" },
  create_task: { title: "پیگیری خودکار", priority: "normal" },
  update_customer: { segment: "hot" },
  webhook: { url: "https://example.com/hook" },
};

export type RuleDraft = {
  id?: string;
  name: string;
  description?: string | null;
  trigger: string;
  priority: number;
  isActive: boolean;
  conditions?: { field: string; op: string; value?: unknown }[] | null;
  actions?: { type: string; config?: Record<string, unknown> }[] | null;
};

type ConditionRow = { field: string; op: string; value: string };
type ActionRow = { type: string; config: string };

const INPUT_CLASS =
  "w-full rounded-lg px-3 py-2 text-sm bg-[#0b1a2e] text-white border border-white/10 outline-none";
const NUMERIC_OPS = ["gt", "lt", "gte", "lte"];

// Condition values are typed by the operator because evalCondition() compares
// with strict === (lib/crm/automation-engine.ts): a phone number must stay a
// string, while gt/lt need a number.
function serializeValue(value: unknown): string {
  if (value === undefined) return "";
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

function parseConditionValue(raw: string, op: string): unknown {
  const t = raw.trim();
  if (t === "") return undefined;
  if (t.startsWith("[") || t.startsWith("{") || t.startsWith('"')) return JSON.parse(t);
  if (t === "true") return true;
  if (t === "false") return false;
  if (t === "null") return null;
  if (NUMERIC_OPS.includes(op) && Number.isFinite(Number(t))) return Number(t);
  return t;
}

export default function RuleFormModal({
  rule,
  onClose,
  onSaved,
}: {
  rule: RuleDraft | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(rule?.name ?? "");
  const [description, setDescription] = useState(rule?.description ?? "");
  const [trigger, setTrigger] = useState(rule?.trigger ?? TRIGGER_OPTIONS[0].value);
  const [priority, setPriority] = useState(String(rule?.priority ?? 0));
  const [isActive, setIsActive] = useState(rule?.isActive ?? true);
  const [conditions, setConditions] = useState<ConditionRow[]>(
    (rule?.conditions ?? []).map((c) => ({
      field: c.field,
      op: c.op,
      value: serializeValue(c.value),
    }))
  );
  const [actions, setActions] = useState<ActionRow[]>(
    (rule?.actions ?? []).map((a) => ({
      type: a.type,
      config: JSON.stringify(a.config ?? {}, null, 2),
    }))
  );
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const setCondition = (i: number, patch: Partial<ConditionRow>) =>
    setConditions((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const setAction = (i: number, patch: Partial<ActionRow>) =>
    setActions((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const save = async () => {
    setFormError(null);

    if (name.trim().length < 2) {
      setFormError("نام قانون باید حداقل ۲ حرف باشد");
      return;
    }
    const priorityNum = Number(priority);
    if (!Number.isInteger(priorityNum) || priorityNum < 0 || priorityNum > 1000) {
      setFormError("اولویت باید عددی صحیح بین ۰ تا ۱۰۰۰ باشد");
      return;
    }
    if (actions.length === 0) {
      setFormError("حداقل یک اقدام لازم است");
      return;
    }

    let payload: Record<string, unknown>;
    try {
      payload = {
        name: name.trim(),
        description: description.trim() || undefined,
        trigger,
        priority: priorityNum,
        isActive,
        conditions: conditions
          .filter((c) => c.field.trim())
          .map((c) => ({
            field: c.field.trim(),
            op: c.op,
            value: parseConditionValue(c.value, c.op),
          })),
        actions: actions.map((a) => ({
          type: a.type,
          config: a.config.trim() ? JSON.parse(a.config) : {},
        })),
      };
    } catch {
      setFormError("JSON نامعتبر در شرایط یا پیکربندی اقدام");
      return;
    }

    setSaving(true);
    const res = await crmFetch(
      rule?.id ? `/api/crm/automation/rules/${rule.id}` : "/api/crm/automation/rules",
      { method: rule?.id ? "PATCH" : "POST", body: payload }
    );
    setSaving(false);

    if (res.ok) onSaved();
    else setFormError(res.data?.error?.message || `خطا در ذخیره (${res.status})`);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
      data-testid="crm-rule-form"
    >
      <div
        className="rounded-2xl p-5 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        style={{ background: "#11223d" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-white font-bold mb-4">{rule?.id ? "ویرایش قانون" : "قانون جدید"}</div>
        {formError && (
          <div
            className="rounded-xl px-3 py-2 mb-3 text-xs text-[#ff7a7a]"
            style={{ background: "rgba(92,50,50,0.25)", border: "1px solid rgba(255,122,122,0.3)" }}
            data-testid="crm-rule-form-error"
          >
            {formError}
          </div>
        )}

        {/* Base fields */}
        <label className="block text-white/60 text-xs mb-1">نام قانون *</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={`${INPUT_CLASS} mb-3`}
          data-testid="crm-rule-name"
        />

        <label className="block text-white/60 text-xs mb-1">توضیحات (اختیاری)</label>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className={`${INPUT_CLASS} mb-3`}
          data-testid="crm-rule-description"
        />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
          <div>
            <label className="block text-white/60 text-xs mb-1">تریگر *</label>
            <select
              value={trigger}
              onChange={(e) => setTrigger(e.target.value)}
              className={INPUT_CLASS}
              data-testid="crm-rule-trigger"
            >
              {TRIGGER_OPTIONS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-white/60 text-xs mb-1">اولویت (۰ تا ۱۰۰۰)</label>
            <input
              type="number"
              min={0}
              max={1000}
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className={INPUT_CLASS}
              data-testid="crm-rule-priority"
            />
          </div>
          <div>
            <label className="block text-white/60 text-xs mb-1">وضعیت</label>
            <button
              type="button"
              onClick={() => setIsActive((v) => !v)}
              className="w-full rounded-lg px-3 py-2 text-sm font-bold"
              style={{
                background: isActive ? "rgba(81,187,112,0.18)" : "rgba(255,255,255,0.08)",
                color: isActive ? "#51BB70" : "rgba(255,255,255,0.5)",
              }}
              data-testid="crm-rule-active-toggle"
            >
              {isActive ? "فعال" : "غیرفعال"}
            </button>
          </div>
        </div>

        {/* Conditions builder */}
        <div className="flex items-center justify-between mb-2 mt-4">
          <span className="text-white/80 text-xs font-bold">شرایط</span>
          <button
            type="button"
            onClick={() => setConditions((r) => [...r, { field: "", op: "eq", value: "" }])}
            className="text-[#51BB70] text-[11px] font-bold"
            data-testid="crm-add-condition"
          >
            + افزودن شرط
          </button>
        </div>
        <div className="flex flex-col gap-2" data-testid="crm-conditions">
          {conditions.map((c, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <input
                value={c.field}
                onChange={(e) => setCondition(i, { field: e.target.value })}
                placeholder="فیلد، مثل customer.segment"
                className={`${INPUT_CLASS} flex-1 min-w-[150px]`}
                data-testid={`crm-condition-field-${i}`}
              />
              <select
                value={c.op}
                onChange={(e) => setCondition(i, { op: e.target.value })}
                className={`${INPUT_CLASS} w-44`}
                data-testid={`crm-condition-op-${i}`}
              >
                {OPERATOR_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <input
                value={c.value}
                onChange={(e) => setCondition(i, { value: e.target.value })}
                placeholder="مقدار"
                className={`${INPUT_CLASS} flex-1 min-w-[120px]`}
                data-testid={`crm-condition-value-${i}`}
              />
              <button
                type="button"
                onClick={() => setConditions((rows) => rows.filter((_, idx) => idx !== i))}
                className="text-[#ff7a7a] text-xs px-2"
                aria-label="حذف شرط"
              >
                حذف
              </button>
            </div>
          ))}
          {conditions.length === 0 && (
            <div className="text-white/30 text-[11px]">
              بدون شرط — قانون برای همه رویدادهای تریگر اجرا می‌شود
            </div>
          )}
        </div>

        {/* Actions builder */}
        <div className="flex items-center justify-between mb-2 mt-5">
          <span className="text-white/80 text-xs font-bold">اقدام‌ها *</span>
          <button
            type="button"
            onClick={() =>
              setActions((r) => [
                ...r,
                { type: "send_notification", config: JSON.stringify(ACTION_CONFIG_TEMPLATES.send_notification, null, 2) },
              ])
            }
            className="text-[#51BB70] text-[11px] font-bold"
            data-testid="crm-add-action"
          >
            + افزودن اقدام
          </button>
        </div>
        <div className="flex flex-col gap-3" data-testid="crm-actions">
          {actions.map((a, i) => (
            <div
              key={i}
              className="rounded-xl p-3"
              style={{ background: "rgba(10,22,40,0.6)", border: "1px solid rgba(81,187,254,0.15)" }}
            >
              <div className="flex items-center gap-2 mb-2">
                <select
                  value={a.type}
                  onChange={(e) =>
                    setAction(i, {
                      type: e.target.value,
                      config: JSON.stringify(ACTION_CONFIG_TEMPLATES[e.target.value] ?? {}, null, 2),
                    })
                  }
                  className={`${INPUT_CLASS} flex-1`}
                  data-testid={`crm-action-type-${i}`}
                >
                  {ACTION_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setActions((rows) => rows.filter((_, idx) => idx !== i))}
                  className="text-[#ff7a7a] text-xs px-2"
                  aria-label="حذف اقدام"
                >
                  حذف
                </button>
              </div>
              <label className="block text-white/50 text-[11px] mb-1">
                پیکربندی (JSON) — کلید config در موتور اتوماسیون
              </label>
              <textarea
                value={a.config}
                onChange={(e) => setAction(i, { config: e.target.value })}
                rows={3}
                dir="ltr"
                className="w-full rounded-lg px-3 py-2 text-xs bg-[#0b1a2e] text-white border border-white/10 outline-none font-mono"
                data-testid={`crm-action-config-${i}`}
              />
            </div>
          ))}
          {actions.length === 0 && (
            <div className="text-white/30 text-[11px]">اقدامی تعریف نشده است</div>
          )}
        </div>

        <div className="text-white/30 text-[11px] mt-3 leading-5">
          نکته: عملگرهای in / not_in و مقادیر ساختاری باید JSON باشند (مثلاً
          <span dir="ltr" className="font-mono"> [&quot;vip&quot;,&quot;hot&quot;]</span>). برای مقایسه عددی از
          عملگرهای &gt; و &lt; استفاده کنید تا مقدار به عدد تبدیل شود.
        </div>

        <div className="flex gap-2 mt-5">
          <CrmButton onClick={save} disabled={saving} className="flex-1">
            {saving ? "در حال ذخیره…" : "ذخیره"}
          </CrmButton>
          <CrmButton variant="ghost" onClick={onClose}>
            انصراف
          </CrmButton>
        </div>

      </div>
    </div>
  );
}

