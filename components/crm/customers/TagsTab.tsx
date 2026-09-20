"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import CrmCard from "@/components/crm/common/CrmCard";
import CrmButton from "@/components/crm/common/CrmButton";
import { crmFetch } from "@/lib/crm/client";

export type CrmTag = { id: string; tag: string; color: string | null };

const TAG_COLORS = ["#51BB70", "#51BBFE", "#ff8c50", "#ffd166", "#c084fc"];

export function TagsTab({
  customerId,
  tags,
  onReload,
}: {
  customerId: string;
  tags: CrmTag[];
  onReload: () => void;
}) {
  const [tag, setTag] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const add = async () => {
    if (!tag.trim()) return;
    setErr(""); setSaving(true);
    const color = TAG_COLORS[tags.length % TAG_COLORS.length];
    const res = await crmFetch(`/api/crm/customers/${customerId}/tags`, {
      method: "POST",
      body: { tag: tag.trim(), color },
    });
    setSaving(false);
    if (!res.ok) { setErr(res.data?.error?.message || "خطا در ثبت تگ"); return; }
    setTag("");
    onReload();
  };

  const remove = async (t: string) => {
    await crmFetch(`/api/crm/customers/${customerId}/tags?tag=${encodeURIComponent(t)}`, { method: "DELETE" });
    onReload();
  };

  return (
    <CrmCard title="تگ‌ها">
      <div className="flex gap-2 mb-4">
        <input
          value={tag}
          onChange={(e) => setTag(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="تگ جدید…"
          className="flex-1 text-white text-sm py-2 px-3 rounded-xl outline-none placeholder:text-white/30"
          style={{ background: "rgba(10,22,40,0.6)", border: "1px solid rgba(81,187,254,0.2)" }}
          data-testid="crm-tag-input"
        />
        <CrmButton onClick={add} disabled={saving || !tag.trim()} data-testid="crm-tag-add">
          <Plus size={16} />
        </CrmButton>
      </div>
      {err && <div className="text-[#ff7a7a] text-xs mb-2">{err}</div>}
      <div className="flex gap-2 flex-wrap" data-testid="crm-tags-list">
        {tags.map((t) => (
          <span
            key={t.id}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold"
            style={{ background: "rgba(81,187,254,0.12)", color: t.color || "#51BBFE" }}
            data-testid={`crm-tag-${t.tag}`}
          >
            {t.tag}
            <button onClick={() => remove(t.tag)} className="opacity-50 hover:opacity-100" aria-label={`حذف ${t.tag}`}>
              <X size={12} />
            </button>
          </span>
        ))}
        {tags.length === 0 && (
          <div className="text-white/40 text-sm w-full text-center py-6">تگی ثبت نشده است</div>
        )}
      </div>
    </CrmCard>
  );
}
