"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import CrmCard from "@/components/crm/common/CrmCard";
import CrmButton from "@/components/crm/common/CrmButton";
import { crmFetch } from "@/lib/crm/client";

export type CrmNote = {
  id: string;
  content: string;
  createdAt: string;
  author: { username: string; fullName: string | null } | null;
};

const faDateTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("fa-IR", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

export function NotesTab({
  customerId,
  notes,
  onReload,
}: {
  customerId: string;
  notes: CrmNote[];
  onReload: () => void;
}) {
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const add = async () => {
    if (!content.trim()) return;
    setErr(""); setSaving(true);
    const res = await crmFetch(`/api/crm/customers/${customerId}/notes`, {
      method: "POST",
      body: { content },
    });
    setSaving(false);
    if (!res.ok) { setErr(res.data?.error?.message || "خطا در ثبت یادداشت"); return; }
    setContent("");
    onReload();
  };

  return (
    <CrmCard title="یادداشت‌ها">
      <div className="flex gap-2 mb-4">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="یادداشت جدید…"
          rows={2}
          className="flex-1 text-white text-sm p-3 rounded-xl outline-none resize-none placeholder:text-white/30"
          style={{ background: "rgba(10,22,40,0.6)", border: "1px solid rgba(81,187,254,0.2)" }}
          data-testid="crm-note-input"
        />
        <CrmButton onClick={add} disabled={saving || !content.trim()} data-testid="crm-note-add">
          <Plus size={16} />
        </CrmButton>
      </div>
      {err && <div className="text-[#ff7a7a] text-xs mb-2">{err}</div>}
      <div className="flex flex-col gap-2" data-testid="crm-notes-list">
        {notes.map((n) => (
          <div key={n.id} className="px-3 py-2.5 rounded-xl" style={{ background: "rgba(10,22,40,0.5)" }}>
            <div className="text-white/80 text-sm whitespace-pre-wrap">{n.content}</div>
            <div className="text-white/30 text-[11px] mt-1.5">
              {n.author?.username || "سیستم"} • {faDateTime(n.createdAt)}
            </div>
          </div>
        ))}
        {notes.length === 0 && (
          <div className="text-white/40 text-sm text-center py-6">یادداشتی ثبت نشده است</div>
        )}
      </div>
    </CrmCard>
  );
}
