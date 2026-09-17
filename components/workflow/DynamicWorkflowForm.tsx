"use client";

import { useEffect, useMemo, useState } from "react";
import InputField from "@/components/InputField";

type FormFieldType =
  | "text"
  | "number"
  | "textarea"
  | "select"
  | "checkbox";

export type WorkflowFormField = {
  name: string;
  label: string;
  type: FormFieldType;
  required?: boolean;
  placeholder?: string;
  options?: string[];
};

export type WorkflowStepDetail = {
  stepInstanceId: string;
  status: string;
  step: {
    allowedActions: string[];
    formSchema: {
      fields?: WorkflowFormField[];
    };
    // other fields exist but not required here
  };
};

function coerceInitialValues(fields: WorkflowFormField[]): Record<string, any> {
  const initial: Record<string, any> = {};
  for (const f of fields) {
    if (f.type === "checkbox") initial[f.name] = false;
    else initial[f.name] = "";
  }
  return initial;
}

export default function DynamicWorkflowForm({
  stepDetail,
  onComplete,
  submitting,
}: {
  stepDetail: WorkflowStepDetail;
  submitting: boolean;
  onComplete: (action: string, formData: Record<string, unknown>) => void;
}) {
  const schema = stepDetail?.step?.formSchema;
  const fields: WorkflowFormField[] = schema?.fields ?? [];

  const initialValues = useMemo(() => coerceInitialValues(fields), [fields]);
  const [values, setValues] = useState<Record<string, unknown>>(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setValues(initialValues);
  }, [initialValues]);

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    for (const f of fields) {
      if (!f.required) continue;
      const v = values[f.name];
      if (f.type === "checkbox") {
        if (!v) next[f.name] = "این فیلد اجباری است";
      } else {
        if (v === "" || v === null || v === undefined) next[f.name] = "این فیلد اجباری است";
      }
    }

    // basic required validation only (backend is contract-based)
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = (action: string) => {
    if (!validate()) return;
    onComplete(action, values);
  };

  const renderField = (field: WorkflowFormField) => {
    const value = values[field.name];
    const err = errors[field.name];

    const baseInputClass =
      "w-full bg-white/10 text-white rounded-xl p-3 border border-white/10 outline-none focus:border-blue-400/50 transition";

    switch (field.type) {
      case "textarea":
        return (
          <div key={field.name} className="mb-5">
            <label className="block text-sm font-medium mb-2 text-white/70">
              {field.label}
              {field.required && <span className="text-red-400 mr-1">*</span>}
            </label>
            <textarea
              value={(value as string) || ""}
              onChange={(e) =>
                setValues((prev) => ({ ...prev, [field.name]: e.target.value }))
              }
              placeholder={field.placeholder}
              className={
                baseInputClass + " min-h-[120px] resize-y" + (err ? " border-red-500/60" : "")
              }
              dir="rtl"
            />
            {err && <p className="text-red-400 text-xs mt-2">{err}</p>}
          </div>
        );

      case "number":
        return (
          <div key={field.name} className="mb-5">
            <label className="block text-sm font-medium mb-2 text-white/70">
              {field.label}
              {field.required && <span className="text-red-400 mr-1">*</span>}
            </label>
            <InputField
              label={""}
              type={"text"}
              ph={field.placeholder}
              val={value === null || value === undefined ? "" : String(value)}
              numeric={true}
              forceError={!!err}
              onChange={(val) => {
                // InputField returns string; pass-through to backend as number-like string
                setValues((prev) => ({ ...prev, [field.name]: val }));
              }}
            />
            {err && <p className="text-red-400 text-xs mt-2">{err}</p>}
          </div>
        );

      case "select":
        return (
          <div key={field.name} className="mb-5">
            <label className="block text-sm font-medium mb-2 text-white/70">
              {field.label}
              {field.required && <span className="text-red-400 mr-1">*</span>}
            </label>
            <select
              value={(value as string) || ""}
              onChange={(e) =>
                setValues((prev) => ({ ...prev, [field.name]: e.target.value }))
              }
              className={baseInputClass + (err ? " border-red-500/60" : "")}
              dir="rtl"
            >
              <option value="">انتخاب کنید...</option>
              {(field.options ?? []).map((opt) => (
                <option key={opt} value={opt} className="bg-[#1c3968]">
                  {opt}
                </option>
              ))}
            </select>
            {err && <p className="text-red-400 text-xs mt-2">{err}</p>}
          </div>
        );

      case "checkbox":
        return (
          <div key={field.name} className="mb-5">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={!!value}
                onChange={(e) =>
                  setValues((prev) => ({
                    ...prev,
                    [field.name]: e.target.checked,
                  }))
                }
                className="w-5 h-5 rounded border-white/20 bg-white/10 accent-[#51BB70]"
              />
              <span className="text-sm text-white/70">{field.label}</span>
              {field.required && <span className="text-red-400 mr-auto">*</span>}
            </label>
            {err && <p className="text-red-400 text-xs mt-2">{err}</p>}
          </div>
        );

      case "text":
      default:
        return (
          <div key={field.name} className="mb-5">
            <label className="block text-sm font-medium mb-2 text-white/70">
              {field.label}
              {field.required && <span className="text-red-400 mr-1">*</span>}
            </label>
            <InputField
              label={""}
              type={"text"}
              ph={field.placeholder}
              val={value === null || value === undefined ? "" : String(value)}
              numeric={false}
              forceError={!!err}
              onChange={(val) => {
                setValues((prev) => ({ ...prev, [field.name]: val }));
              }}
            />
            {err && <p className="text-red-400 text-xs mt-2">{err}</p>}
          </div>
        );
    }
  };

  return (
    <div className="space-y-4">
      {fields.length > 0 ? (
        <>
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 md:p-6">
            <h2 className="font-bold mb-4">📝 فرم اقدام</h2>
            <div className="space-y-4">
              {fields.map((f) => renderField(f))}
            </div>
          </div>

          {stepDetail.step.allowedActions?.length ? (
            <div className="flex flex-wrap gap-3 justify-center">
              {stepDetail.step.allowedActions.map((action) => {
                const isPrimary =
                  action === "approve" || action === "COMPLETE";
                const isDanger = action === "reject" || action === "REJECT";

                return (
                  <button
                    key={action}
                    type="button"
                    onClick={() => handleSubmit(action)}
                    disabled={submitting}
                    className={`
                      px-8 py-3 rounded-xl font-bold text-sm transition-all duration-200
                      ${
                        isPrimary
                          ? "bg-[#51BB70] text-[#011B2C] hover:bg-[#45a762] shadow-[0_0_20px_rgba(81,187,112,0.3)]"
                          : isDanger
                          ? "bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30"
                          : "bg-white/10 text-white border border-white/20 hover:bg-white/20"
                      }
                      ${submitting ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
                    `}
                  >
                    {submitting
                      ? "در حال ثبت..."
                      : isPrimary
                      ? "✅ تایید و تکمیل"
                      : isDanger
                      ? "❌ رد کردن"
                      : action === "SKIP"
                      ? "⏭ رد شدن"
                      : `🔘 ${action}`}
                  </button>
                );
              })}
            </div>
          ) : null}
        </>
      ) : (
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 md:p-6 text-center">
          <p className="text-white/70">این مرحله فرم ندارد.</p>
        </div>
      )}
    </div>
  );
}

