"use client";

import { useEffect, useState } from "react";

type RejectionReason = {
  id: string;
  code: string;
  name: string;
  category: string | null;
};

export type RejectionResult = {
  reasonName: string;
  notes: string;
};

/**
 * CRM Phase 3 — mandatory rejection modal for task rejection.
 * Calls onConfirm(result) — the parent decides whether to proceed.
 */
export default function RejectionModal({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (result: { reasonId: string; reasonName: string; notes: string }) => void;
}) {
  const [reasons, setReasons] = useState<RejectionReason[]>([]);
  const [reasonId, setReasonId] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setReasonId("");
    setNotes("");
    setError("");
    fetch("/api/crm/rejection-reasons", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        if (d?.success) setReasons(d.data);
      })
      .catch(() => setError("خطا در بارگذاری دلایل"));
  }, [open]);

  if (!open) return null;

  const selected = reasons.find((r) => r.id === reasonId);
  const notesRequired = selected?.code === "other";
  const canConfirm = reasonId && (!notesRequired || notes.trim());

  const confirm = () => {
    if (!canConfirm) return;
    setLoading(true);
    try {
      onConfirm({ reasonId, reasonName: selected?.name ?? "", notes: notes.trim() });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="rounded-2xl p-5 w-full max-w-md"
        style={{ background: "#11223d" }}
        onClick={(e) => e.stopPropagation()}
        data-testid="rejection-modal"
      >
        <div className="text-white font-bold text-base mb-4">دلیل ریجکت این درخواست چیست؟</div>

        <label className="block text-white/60 text-xs mb-1">دلیل</label>
        <select
          value={reasonId}
          onChange={(e) => { setReasonId(e.target.value); setError(""); }}
          data-testid="rejection-reason-select"
          className="w-full rounded-lg px-3 py-2 text-sm bg-[#0b1a2e] text-white border border-white/10 outline-none mb-3"
        >
          <option value="">انتخاب کنید…</option>
          {reasons.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>

        <label className="block text-white/60 text-xs mb-1">
          توضیحات {notesRequired && <span className="text-red-400">(الزامی)</span>}
        </label>
        <textarea
          rows={3}
          value={notes}
          onChange={(e) => { setNotes(e.target.value); setError(""); }}
          data-testid="rejection-notes-input"
          className="w-full rounded-lg px-3 py-2 text-sm bg-[#0b1a2e] text-white border border-white/10 outline-none mb-3 resize-none"
        />

        {error && <div className="text-red-400 text-xs mb-3" data-testid="rejection-error">{error}</div>}

        <div className="flex gap-2">
          <button
            onClick={confirm}
            disabled={!canConfirm || loading}
            data-testid="rejection-confirm"
            className="flex-1 py-2 rounded-xl text-sm font-bold text-[#011B2C] disabled:opacity-40"
            style={{ background: "#ef4444", color: "#fff" }}
          >
            {loading ? "…" : "تأیید ریجکت"}
          </button>
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm bg-white/10 text-white">
            انصراف
          </button>
        </div>
      </div>
    </div>
  );
}
