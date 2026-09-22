"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import useSWR from "swr";

type Template = {
  id: string;
  name: string;
  channel: "sms" | "email";
  subject: string | null;
  content: string;
  variables: string[];
  category: string | null;
  isActive: boolean;
  createdBy: { id: string; fullName: string | null; username: string } | null;
};

const get = (url: string) => fetch(url, { credentials: "include" }).then((r) => r.json());

const CATEGORY_FA: Record<string, string> = {
  welcome: "خوش‌آمد", followup: "پیگیری", rejection: "رد درخواست",
  payment: "پرداخت", custom: "سفارشی",
};

const SAMPLE_VALUES: Record<string, string> = {
  name: "علی رضایی", code: "C-100241",
  date: "۱۴۰۴/۰۷/۰۱", amount: "۱۲۰٬۰۰۰٬۰۰۰ تومان",
};

function renderPreview(content: string): string {
  return content.replace(/\{(\w+)\}/g, (_, k: string) => SAMPLE_VALUES[k] ?? `{${k}}`);
}

const emptyForm = { name: "", channel: "sms", subject: "", content: "", category: "custom" };

export default function TemplatesPage() {
  const { data, mutate } = useSWR("/api/crm/templates", get, { revalidateOnFocus: false });
  const templates: Template[] = Array.isArray(data?.data) ? data.data : [];

  const [channelFilter, setChannelFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Template | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [flash, setFlash] = useState("");

  const filtered = templates.filter(
    (t) => (!channelFilter || t.channel === channelFilter) &&
           (!categoryFilter || t.category === categoryFilter)
  );

  const extractVariables = (text: string): string[] =>
    [...new Set([...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]))];

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEdit = (t: Template) => {
    setEditing(t);
    setForm({ name: t.name, channel: t.channel, subject: t.subject ?? "", content: t.content, category: t.category ?? "custom" });
    setShowModal(true);
  };

  const save = async () => {
    const payload = {
      ...form,
      subject: form.subject || undefined,
      variables: extractVariables(form.content),
    };
    try {
      const res = await fetch(editing ? `/api/crm/templates/${editing.id}` : "/api/crm/templates", {
        method: editing ? "PATCH" : "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      setFlash(res.ok && json.success ? "ذخیره شد ✓" : `خطا: ${json?.error?.message ?? res.status}`);
      if (res.ok && json.success) { setShowModal(false); mutate(); }
    } catch { setFlash("خطای شبکه"); }
    setTimeout(() => setFlash(""), 3000);
  };

  const toggleActive = async (t: Template) => {
    try {
      await fetch(`/api/crm/templates/${t.id}`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !t.isActive }),
      });
      mutate();
    } catch {}
  };

  const remove = async (t: Template) => {
    if (!confirm(`غیرفعال‌سازی قالب «${t.name}»؟`)) return;
    try {
      await fetch(`/api/crm/templates/${t.id}`, { method: "DELETE", credentials: "include" });
      mutate();
    } catch {}
  };

  const VARIABLE_PICKER = ["name", "code", "date", "amount"];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-white text-2xl font-black">قالب‌های پیام</h1>
        <button onClick={openCreate} data-testid="template-create"
          className="px-4 py-2 rounded-xl text-sm font-bold text-[#011B2C]" style={{ background: "#51BB70" }}>
          + قالب جدید
        </button>
      </div>

      <div className="flex gap-2 mb-4">
        <select value={channelFilter} onChange={(e) => setChannelFilter(e.target.value)}
          className="rounded-lg px-3 py-2 text-xs bg-[#11223d] text-white border border-white/10 outline-none">
          <option value="">همه کانال‌ها</option>
          <option value="sms">پیامک</option>
          <option value="email">ایمیل</option>
        </select>
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-lg px-3 py-2 text-xs bg-[#11223d] text-white border border-white/10 outline-none">
          <option value="">همه دسته‌ها</option>
          {Object.entries(CATEGORY_FA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        {flash && <span className="text-xs text-white/60 self-center" data-testid="templates-flash">{flash}</span>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {filtered.length === 0 && (
          <div className="text-white/40 text-sm py-10 text-center col-span-full">قالبی یافت نشد</div>
        )}
        {filtered.map((t) => (
          <div key={t.id} data-testid={`template-card-${t.name}`}
            className="rounded-2xl p-4 flex flex-col gap-2"
            style={{ background: "#11223d", opacity: t.isActive ? 1 : 0.45 }}>
            <div className="flex items-start justify-between">
              <div>
                <div className="text-white font-bold text-sm">{t.name}</div>
                <div className="text-white/40 text-[11px]">
                  {t.channel === "sms" ? "پیامک" : "ایمیل"}
                  {t.category ? ` · ${CATEGORY_FA[t.category] ?? t.category}` : ""}
                </div>
              </div>
              <button onClick={() => toggleActive(t)}
                className="px-2 py-1 rounded-lg text-[10px] font-bold"
                style={{ background: t.isActive ? "#51BB70" : "rgba(255,255,255,0.1)", color: t.isActive ? "#011B2C" : "#fff" }}>
                {t.isActive ? "فعال" : "غیرفعال"}
              </button>
            </div>
            <div className="text-white/60 text-xs leading-relaxed">{renderPreview(t.content).slice(0, 120)}</div>
            {t.variables.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {t.variables.map((v) => (
                  <span key={v} className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/70">{`{${v}}`}</span>
                ))}
              </div>
            )}
            <div className="flex gap-2 mt-auto pt-2">
              <button onClick={() => openEdit(t)} data-testid={`template-edit-${t.name}`}
                className="flex-1 py-1.5 rounded-lg text-xs bg-white/10 text-white hover:bg-white/20">ویرایش</button>
              <button onClick={() => remove(t)}
                className="px-3 py-1.5 rounded-lg text-xs bg-red-500/20 text-red-300 hover:bg-red-500/30">حذف</button>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowModal(false)}>
          <div className="rounded-2xl p-5 w-full max-w-lg max-h-[85vh] overflow-y-auto"
            style={{ background: "#11223d" }} onClick={(e) => e.stopPropagation()} data-testid="template-modal">
            <div className="text-white font-bold mb-4">{editing ? "ویرایش قالب" : "قالب جدید"}</div>

            <label className="block text-white/60 text-xs mb-1">نام</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              data-testid="template-name-input"
              className="w-full rounded-lg px-3 py-2 text-sm bg-[#0b1a2e] text-white border border-white/10 outline-none mb-3" />

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-white/60 text-xs mb-1">کانال</label>
                <select value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })}
                  className="w-full rounded-lg px-3 py-2 text-sm bg-[#0b1a2e] text-white border border-white/10 outline-none">
                  <option value="sms">پیامک</option>
                  <option value="email">ایمیل</option>
                </select>
              </div>
              <div>
                <label className="block text-white/60 text-xs mb-1">دسته</label>
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full rounded-lg px-3 py-2 text-sm bg-[#0b1a2e] text-white border border-white/10 outline-none">
                  {Object.entries(CATEGORY_FA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
            </div>

            <label className="block text-white/60 text-xs mb-1">موضوع (اختیاری)</label>
            <input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })}
              className="w-full rounded-lg px-3 py-2 text-sm bg-[#0b1a2e] text-white border border-white/10 outline-none mb-3" />

            <label className="block text-white/60 text-xs mb-1">متن قالب</label>
            <textarea rows={4} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })}
              data-testid="template-content-input"
              className="w-full rounded-lg px-3 py-2 text-sm bg-[#0b1a2e] text-white border border-white/10 outline-none mb-2 resize-none" />

            <div className="flex flex-wrap gap-1 mb-3">
              {VARIABLE_PICKER.map((v) => (
                <button key={v} type="button"
                  onClick={() => setForm((f) => ({ ...f, content: `${f.content}{${v}}` }))}
                  className="text-[10px] px-2 py-1 rounded bg-white/10 text-white/70 hover:bg-white/20">{`{${v}}`}</button>
              ))}
            </div>

            {form.content && (
              <div className="rounded-xl p-3 mb-4" style={{ background: "rgba(81,187,112,0.08)" }}>
                <div className="text-[10px] text-white/40 mb-1">پیش‌نمایش (با داده نمونه):</div>
                <div className="text-xs text-white/80 leading-relaxed" data-testid="template-preview">{renderPreview(form.content)}</div>
              </div>
            )}

            <div className="flex gap-2">
              <button onClick={save} disabled={!form.name || !form.content} data-testid="template-save"
                className="flex-1 py-2 rounded-xl text-sm font-bold text-[#011B2C] disabled:opacity-40" style={{ background: "#51BB70" }}>
                ذخیره
              </button>
              <button onClick={() => setShowModal(false)}
                className="px-4 py-2 rounded-xl text-sm bg-white/10 text-white">انصراف</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
