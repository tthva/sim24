"use client";

import { useState } from "react";
import { X } from "lucide-react";
import CrmButton from "@/components/crm/common/CrmButton";
import { crmFetch } from "@/lib/crm/client";

const SEGMENT_FA: Record<string, string> = {
  vip: "VIP", hot: "داغ", regular: "معمولی", cold: "سرد",
};

export default function NewCustomerModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [fullName, setFullName] = useState("");
  const [primaryPhone, setPrimaryPhone] = useState("");
  const [segment, setSegment] = useState("regular");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setErr("");
    setSaving(true);
    const res = await crmFetch("/api/crm/customers", {
      method: "POST",
      body: { fullName, primaryPhone, segment, source: "manual" },
    });
    setSaving(false);
    if (!res.ok) {
      setErr(res.data?.error?.message || "خطا در ثبت مشتری");
      return;
    }
    onCreated();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl p-6 mx-4"
        style={{ background: "#11223d", border: "1px solid rgba(81,187,254,0.3)" }}
        onClick={(e) => e.stopPropagation()}
        data-testid="crm-new-customer-modal"
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-white font-bold">مشتری جدید</h2>
          <button onClick={onClose} className="text-white/50 hover:text-white" aria-label="بستن"><X size={18} /></button>
        </div>
        <div className="flex flex-col gap-3">
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="نام و نام خانوادگی" className="text-white text-sm py-2 px-3 rounded-xl outline-none placeholder:text-white/30" style={{ background: "rgba(10,22,40,0.6)", border: "1px solid rgba(81,187,254,0.2)" }} data-testid="crm-new-name" />
          <input value={primaryPhone} onChange={(e) => setPrimaryPhone(e.target.value)} placeholder="موبایل (09xxxxxxxxx)" dir="ltr" className="text-white text-sm py-2 px-3 rounded-xl outline-none placeholder:text-white/30" style={{ background: "rgba(10,22,40,0.6)", border: "1px solid rgba(81,187,254,0.2)" }} data-testid="crm-new-phone" />
          <select value={segment} onChange={(e) => setSegment(e.target.value)} className="text-white text-sm py-2 px-3 rounded-xl outline-none" style={{ background: "#11223d", border: "1px solid rgba(81,187,254,0.2)" }} data-testid="crm-new-segment">
            {Object.entries(SEGMENT_FA).map(([k, v]) => <option key={k} value={k}>سگمنت: {v}</option>)}
          </select>
          {err && <div className="text-[#ff7a7a] text-xs">{err}</div>}
          <div className="flex justify-end gap-2 mt-2">
            <CrmButton variant="ghost" onClick={onClose}>انصراف</CrmButton>
            <CrmButton onClick={submit} disabled={saving || !primaryPhone}>
              {saving ? "در حال ثبت…" : "ثبت مشتری"}
            </CrmButton>
          </div>
        </div>
      </div>
    </div>
  );
}
