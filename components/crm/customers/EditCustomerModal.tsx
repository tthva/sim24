"use client";

import { useState } from "react";
import { X } from "lucide-react";
import CrmButton from "@/components/crm/common/CrmButton";
import { crmFetch } from "@/lib/crm/client";

const SEGMENT_FA: Record<string, string> = {
  vip: "VIP", hot: "داغ", regular: "معمولی", cold: "سرد",
};

export default function EditCustomerModal({
  customerId,
  initial,
  onClose,
  onSaved,
}: {
  customerId: string;
  initial: { fullName: string; secondaryPhone: string; nationalId: string; segment: string };
  onClose: () => void;
  onSaved: () => void;
}) {
  const [fullName, setFullName] = useState(initial.fullName);
  const [secondaryPhone, setSecondaryPhone] = useState(initial.secondaryPhone);
  const [nationalId, setNationalId] = useState(initial.nationalId);
  const [segment, setSegment] = useState(initial.segment);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const save = async () => {
    setErr(""); setSaving(true);
    const res = await crmFetch(`/api/crm/customers/${customerId}`, {
      method: "PATCH",
      body: { fullName, secondaryPhone, nationalId, segment },
    });
    setSaving(false);
    if (!res.ok) { setErr(res.data?.error?.message || "خطا در ذخیره"); return; }
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl p-6 mx-4"
        style={{ background: "#11223d", border: "1px solid rgba(81,187,254,0.3)" }}
        onClick={(e) => e.stopPropagation()}
        data-testid="crm-edit-modal"
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-white font-bold">ویرایش مشتری</h2>
          <button onClick={onClose} className="text-white/50 hover:text-white" aria-label="بستن"><X size={18} /></button>
        </div>
        <div className="flex flex-col gap-3">
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="نام و نام خانوادگی" className="text-white text-sm py-2 px-3 rounded-xl outline-none placeholder:text-white/30" style={{ background: "rgba(10,22,40,0.6)", border: "1px solid rgba(81,187,254,0.2)" }} data-testid="crm-edit-name" />
          <input value={secondaryPhone} onChange={(e) => setSecondaryPhone(e.target.value)} placeholder="موبایل دوم" dir="ltr" className="text-white text-sm py-2 px-3 rounded-xl outline-none placeholder:text-white/30" style={{ background: "rgba(10,22,40,0.6)", border: "1px solid rgba(81,187,254,0.2)" }} />
          <input value={nationalId} onChange={(e) => setNationalId(e.target.value)} placeholder="کد ملی" dir="ltr" className="text-white text-sm py-2 px-3 rounded-xl outline-none placeholder:text-white/30" style={{ background: "rgba(10,22,40,0.6)", border: "1px solid rgba(81,187,254,0.2)" }} />
          <select value={segment} onChange={(e) => setSegment(e.target.value)} className="text-white text-sm py-2 px-3 rounded-xl outline-none" style={{ background: "#11223d", border: "1px solid rgba(81,187,254,0.2)" }} data-testid="crm-edit-segment">
            {Object.entries(SEGMENT_FA).map(([k, v]) => <option key={k} value={k}>سگمنت: {v}</option>)}
          </select>
          {err && <div className="text-[#ff7a7a] text-xs">{err}</div>}
          <div className="flex justify-end gap-2 mt-2">
            <CrmButton variant="ghost" onClick={onClose}>انصراف</CrmButton>
            <CrmButton onClick={save} disabled={saving} data-testid="crm-edit-save">
              {saving ? "در حال ذخیره…" : "ذخیره"}
            </CrmButton>
          </div>
        </div>
      </div>
    </div>
  );
}
