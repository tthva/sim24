"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import useSWR from "swr";

type Reason = {
  id: string;
  code: string;
  name: string;
  category: string | null;
  description: string | null;
  isActive: boolean;
  isSystem: boolean;
  order: number;
};

const get = (url: string) => fetch(url, { credentials: "include" }).then((r) => r.json());

const CATEGORY_FA: Record<string, string> = {
  pricing: "قیمت", quality: "کیفیت", customer: "مشتری", other: "سایر",
};

const emptyForm = { code: "", name: "", category: "other", description: "" };

export default function RejectionReasonsPage() {
  const { data, mutate } = useSWR("/api/crm/rejection-reasons?all=true", get, { revalidateOnFocus: false });
  const reasons: Reason[] = Array.isArray(data?.data) ? data.data : [];

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Reason | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [flash, setFlash] = useState("");

  const showMsg = (m: string) => { setFlash(m); setTimeout(() => setFlash(""), 3000); };

  const openCreate = () => { setEditing(null); setForm(emptyForm); setShowModal(true); };

  const openEdit = (r: Reason) => {
    setEditing(r);
    setForm({ code: r.code, name: r.name, category: r.category ?? "other", description: r.description ?? "" });
    setShowModal(true);
  };

  const save = async () => {
    try {
      const res = await fetch(editing ? `/api/crm/rejection-reasons/${editing.id}` : "/api/crm/rejection-reasons", {
        method: editing ? "PATCH" : "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing ? { name: form.name, category: form.category, description: form.description || undefined } : form),
      });
      const json = await res.json();
      if (res.ok && json.success) { setShowModal(false); mutate(); showMsg("ذخیره شد ✓"); }
      else showMsg(`خطا: ${json?.error?.message ?? res.status}`);
    } catch { showMsg("خطای شبکه"); }
  };

  const toggleActive = async (r: Reason) => {
    try {
      const res = await fetch(`/api/crm/rejection-reasons/${r.id}`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !r.isActive }),
      });
      const json = await res.json();
      if (res.ok && json.success) mutate();
      else showMsg(`خطا: ${json?.error?.message ?? res.status}`);
    } catch { showMsg("خطای شبکه"); }
  };

  const move = async (r: Reason, delta: number) => {
    const target = reasons.find((x) => x.order === r.order + delta);
    if (!target) return;
    try {
      await Promise.all([
        fetch(`/api/crm/rejection-reasons/${r.id}`, {
          method: "PATCH", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ order: r.order + delta }),
        }),
        fetch(`/api/crm/rejection-reasons/${target.id}`, {
          method: "PATCH", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ order: r.order }),
        }),
      ]);
      mutate();
    } catch { showMsg("خطای شبکه"); }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-white text-2xl font-black">دلایل ریجکت</h1>
        <button onClick={openCreate} data-testid="reason-create"
          className="px-4 py-2 rounded-xl text-sm font-bold text-[#011B2C]" style={{ background: "#51BB70" }}>
          + دلیل جدید
        </button>
      </div>

      {flash && <div className="text-xs text-white/60 mb-3" data-testid="reasons-flash">{flash}</div>}

      <div className="space-y-2">
        {reasons.map((r, idx) => (
          <div key={r.id} data-testid={`reason-${r.code}`}
            className="flex items-center gap-3 rounded-xl px-4 py-3"
            style={{ background: "#11223d", opacity: r.isActive ? 1 : 0.45 }}>
            <div className="flex flex-col gap-0.5">
              <button onClick={() => move(r, -1)} disabled={idx === 0}
                className="text-white/40 hover:text-white text-[10px] disabled:opacity-20">▲</button>
              <button onClick={() => move(r, 1)} disabled={idx === reasons.length - 1}
                className="text-white/40 hover:text-white text-[10px] disabled:opacity-20">▼</button>
            </div>
            <div className="flex-1">
              <div className="text-white text-sm font-bold">
                {r.name}
                {r.isSystem && <span className="text-[10px] mr-2 px-1.5 py-0.5 rounded bg-white/10 text-white/50">سیستمی</span>}
              </div>
              <div className="text-white/40 text-[11px]" dir="ltr">{r.code} · {CATEGORY_FA[r.category ?? "other"] ?? r.category}</div>
            </div>
            <button onClick={() => toggleActive(r)}
              className="px-2 py-1 rounded-lg text-[10px] font-bold"
              style={{ background: r.isActive ? "#51BB70" : "rgba(255,255,255,0.1)", color: r.isActive ? "#011B2C" : "#fff" }}
              data-testid={`reason-toggle-${r.code}`}>
              {r.isActive ? "فعال" : "غیرفعال"}
            </button>
            {!r.isSystem && (
              <button onClick={() => openEdit(r)} className="px-3 py-1.5 rounded-lg text-xs bg-white/10 text-white hover:bg-white/20">ویرایش</button>
            )}
          </div>
        ))}
        {reasons.length === 0 && <div className="text-white/40 text-sm py-10 text-center">دلیلی یافت نشد</div>}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowModal(false)}>
          <div className="rounded-2xl p-5 w-full max-w-md" style={{ background: "#11223d" }}
            onClick={(e) => e.stopPropagation()} data-testid="reason-modal">
            <div className="text-white font-bold mb-4">{editing ? "ویرایش دلیل" : "دلیل جدید"}</div>
            {!editing && (
              <>
                <label className="block text-white/60 text-xs mb-1">کد (لاتین)</label>
                <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })}
                  data-testid="reason-code-input"
                  className="w-full rounded-lg px-3 py-2 text-sm bg-[#0b1a2e] text-white border border-white/10 outline-none mb-3" dir="ltr" />
              </>
            )}
            <label className="block text-white/60 text-xs mb-1">نام</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              data-testid="reason-name-input"
              className="w-full rounded-lg px-3 py-2 text-sm bg-[#0b1a2e] text-white border border-white/10 outline-none mb-3" />
            <label className="block text-white/60 text-xs mb-1">دسته</label>
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="w-full rounded-lg px-3 py-2 text-sm bg-[#0b1a2e] text-white border border-white/10 outline-none mb-3">
              {Object.entries(CATEGORY_FA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <label className="block text-white/60 text-xs mb-1">توضیحات</label>
            <textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full rounded-lg px-3 py-2 text-sm bg-[#0b1a2e] text-white border border-white/10 outline-none mb-4 resize-none" />
            <div className="flex gap-2">
              <button onClick={save} disabled={!editing && (!form.code || !form.name)} data-testid="reason-save"
                className="flex-1 py-2 rounded-xl text-sm font-bold text-[#011B2C] disabled:opacity-40" style={{ background: "#51BB70" }}>
                ذخیره
              </button>
              <button onClick={() => setShowModal(false)} className="px-4 py-2 rounded-xl text-sm bg-white/10 text-white">انصراف</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


