"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";

type Stage = {
  id: string;
  code: string;
  name: string;
  color: string | null;
  isWon: boolean;
  isLost: boolean;
};
type Pipeline = { id: string; name: string; stages: Stage[] };
type Opportunity = {
  id: string;
  title: string;
  estimatedValue: number | string | null;
  stageId: string;
  customer: { fullName: string | null; customerCode: string; score: number } | null;
  assignedTo: { id: string; fullName: string | null; username: string } | null;
};

const get = (url: string) => fetch(url, { credentials: "include" }).then((r) => r.json());

const fmtValue = (v: number | string | null) => {
  const n = Number(v ?? 0);
  return n >= 1_000_000_000 ? `${(n / 1_000_000_000).toFixed(1)} میلیارد` : n >= 1_000_000 ? `${(n / 1_000_000).toFixed(0)} م` : String(n);
};

const emptyDealForm = { customerId: "", title: "", estimatedValue: "", probability: "20" };

export default function PipelinePage() {
  const { data: pipeData } = useSWR("/api/crm/pipeline", get, { revalidateOnFocus: false });
  const pipelines: Pipeline[] = Array.isArray(pipeData?.data) ? pipeData.data : [];
  const [pipelineId, setPipelineId] = useState("");
  const [assignedFilter, setAssignedFilter] = useState("");

  const pipeline = pipelines.find((p) => p.id === pipelineId) ?? pipelines[0];

  const { data: oppData, mutate: refreshOpps } = useSWR(
    pipeline ? `/api/crm/opportunities?pipeline=${pipeline.id}&limit=300` : null,
    get,
    { refreshInterval: 30_000, revalidateOnFocus: false }
  );
  const opportunities: Opportunity[] = Array.isArray(oppData?.data) ? oppData.data : [];

  const [showModal, setShowModal] = useState(false);
  const [customers, setCustomers] = useState<{ id: string; fullName: string | null; customerCode: string }[]>([]);
  const [flash, setFlash] = useState("");
  const [form, setForm] = useState(emptyDealForm);

  useEffect(() => {
    get("/api/crm/customers").then((d) => {
      if (d?.success) setCustomers(d.data?.customers ?? d.data ?? []);
    }).catch(() => {});
  }, []);

  const byStage = useMemo(() => {
    const map = new Map<string, Opportunity[]>();
    for (const s of pipeline?.stages ?? []) map.set(s.id, []);
    for (const o of opportunities) {
      if (assignedFilter && o.assignedTo?.id !== assignedFilter) continue;
      map.get(o.stageId)?.push(o);
    }
    return map;
  }, [opportunities, pipeline, assignedFilter]);

  const showMsg = (m: string) => { setFlash(m); setTimeout(() => setFlash(""), 3000); };

  const moveStage = async (oppId: string, stageId: string) => {
    if (!stageId) return;
    try {
      const res = await fetch(`/api/crm/opportunities/${oppId}`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stageId }),
      });
      const json = await res.json();
      if (res.ok && json.success) { refreshOpps(); showMsg("انتقال انجام شد ✓"); }
      else showMsg(`خطا: ${json?.error?.message ?? res.status}`);
    } catch { showMsg("خطای شبکه"); }
  };

  const createDeal = async () => {
    if (!pipeline || !form.customerId || !form.title.trim()) return;
    const leadStage = pipeline.stages[0];
    try {
      const res = await fetch("/api/crm/opportunities", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: form.customerId,
          pipelineId: pipeline.id,
          stageId: leadStage.id,
          title: form.title,
          estimatedValue: form.estimatedValue ? Number(form.estimatedValue) : undefined,
          probability: Number(form.probability) || undefined,
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) { setShowModal(false); setForm(emptyDealForm); refreshOpps(); showMsg("فرصت ایجاد شد ✓"); }
      else showMsg(`خطا: ${json?.error?.message ?? res.status}`);
    } catch { showMsg("خطای شبکه"); }
  };

  if (!pipeline) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <h1 className="text-white text-2xl font-black mb-6">پایپ‌لاین فروش</h1>
        <div className="text-white/40 text-sm py-10 text-center">پایپ‌لاینی یافت نشد — seed را اجرا کنید</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-full">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-white text-2xl font-black">پایپ‌لاین فروش</h1>
        <div className="flex gap-2 items-center">
          <select value={pipelineId || pipeline.id} onChange={(e) => setPipelineId(e.target.value)}
            className="rounded-lg px-3 py-2 text-xs bg-[#11223d] text-white border border-white/10 outline-none">
            {pipelines.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select value={assignedFilter} onChange={(e) => setAssignedFilter(e.target.value)}
            className="rounded-lg px-3 py-2 text-xs bg-[#11223d] text-white border border-white/10 outline-none">
            <option value="">همه اپراتورها</option>
            {[...new Map(opportunities.map((o) => [o.assignedTo?.id, o.assignedTo])).values()]
              .filter(Boolean).map((a) => (
                <option key={a!.id} value={a!.id}>{a!.fullName ?? a!.username}</option>
              ))}
          </select>
          <button onClick={() => setShowModal(true)} data-testid="deal-create"
            className="px-4 py-2 rounded-xl text-sm font-bold text-[#011B2C]" style={{ background: "#51BB70" }}>
            + فرصت جدید
          </button>
          {flash && <span className="text-xs text-white/60" data-testid="pipeline-flash">{flash}</span>}
        </div>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-4" data-testid="kanban-board">
        {pipeline.stages.map((stage) => {
          const items = byStage.get(stage.id) ?? [];
          const total = items.reduce((s, o) => s + Number(o.estimatedValue ?? 0), 0);
          return (
            <div key={stage.id} data-testid={`kanban-col-${stage.code}`}
              className="min-w-[260px] w-[260px] flex-shrink-0 rounded-2xl p-3"
              style={{ background: "#11223d", borderTop: `3px solid ${stage.color ?? "#51BB70"}` }}>
              <div className="flex items-center justify-between mb-3">
                <div className="text-white font-bold text-sm">{stage.name}</div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white/70">{items.length}</span>
              </div>
              <div className="text-white/40 text-[11px] mb-3" dir="ltr">{fmtValue(total)}</div>
              <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                {items.map((o) => (
                  <div key={o.id} data-testid={`deal-${o.title}`}
                    className="rounded-xl p-3" style={{ background: "#0b1a2e" }}>
                    <div className="text-white text-xs font-bold mb-1">{o.title}</div>
                    <div className="text-white/50 text-[11px]">{o.customer?.fullName ?? o.customer?.customerCode}</div>
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex gap-1 items-center flex-wrap">
                        {o.estimatedValue != null && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#51BB70]/20 text-[#51BB70]">{fmtValue(o.estimatedValue)}</span>
                        )}
                        {o.customer?.score != null && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/60">امتیاز {o.customer.score}</span>
                        )}
                      </div>
                      <select value={o.stageId} onChange={(e) => moveStage(o.id, e.target.value)}
                        data-testid={`move-${o.title}`}
                        className="rounded px-1 py-0.5 text-[10px] bg-white/10 text-white border border-white/10 outline-none">
                        {pipeline.stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                    {o.assignedTo && (
                      <div className="text-white/30 text-[10px] mt-1.5">{o.assignedTo.fullName ?? o.assignedTo.username}</div>
                    )}
                  </div>
                ))}
                {items.length === 0 && <div className="text-white/20 text-[11px] text-center py-4">—</div>}
              </div>
            </div>
          );
        })}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowModal(false)}>
          <div className="rounded-2xl p-5 w-full max-w-md" style={{ background: "#11223d" }}
            onClick={(e) => e.stopPropagation()} data-testid="deal-modal">
            <div className="text-white font-bold mb-4">فرصت جدید</div>
            <label className="block text-white/60 text-xs mb-1">مشتری</label>
            <select value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })}
              data-testid="deal-customer-select"
              className="w-full rounded-lg px-3 py-2 text-sm bg-[#0b1a2e] text-white border border-white/10 outline-none mb-3">
              <option value="">انتخاب کنید…</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.fullName ?? c.customerCode}</option>)}
            </select>
            <label className="block text-white/60 text-xs mb-1">عنوان</label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
              data-testid="deal-title-input"
              className="w-full rounded-lg px-3 py-2 text-sm bg-[#0b1a2e] text-white border border-white/10 outline-none mb-3" />
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-white/60 text-xs mb-1">ارزش (تومان)</label>
                <input type="number" value={form.estimatedValue} onChange={(e) => setForm({ ...form, estimatedValue: e.target.value })}
                  className="w-full rounded-lg px-3 py-2 text-sm bg-[#0b1a2e] text-white border border-white/10 outline-none" />
              </div>
              <div>
                <label className="block text-white/60 text-xs mb-1">احتمال (%)</label>
                <input type="number" min={0} max={100} value={form.probability} onChange={(e) => setForm({ ...form, probability: e.target.value })}
                  className="w-full rounded-lg px-3 py-2 text-sm bg-[#0b1a2e] text-white border border-white/10 outline-none" />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={createDeal} disabled={!form.customerId || !form.title} data-testid="deal-save"
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




