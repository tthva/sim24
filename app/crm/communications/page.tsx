"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import useSWR from "swr";

type Comm = {
  id: string;
  customerId: string;
  channel: "sms" | "call" | "note" | "chat";
  direction: "inbound" | "outbound";
  content: string;
  status: string;
  durationSec: number | null;
  createdAt: string;
  customer: { id: string; fullName: string | null; primaryPhone: string; customerCode: string };
  operator: { id: string; fullName: string | null; username: string } | null;
};

const get = (url: string) =>
  fetch(url, { credentials: "include" }).then((r) => r.json());

function bubbleBg(c: Comm): string {
  if (c.channel === "call") return "#51BBFE";
  if (c.channel === "note") return "#ffd166";
  if (c.direction === "inbound") return "#3d4f66";
  return "#51BB70";
}

export default function CommunicationsPage() {
  const { data: listData, mutate: refresh } = useSWR(
    "/api/crm/communications?limit=200",
    get,
    { refreshInterval: 30_000, revalidateOnFocus: false }
  );
  const comms: Comm[] = Array.isArray(listData?.data) ? listData.data : [];

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Comm[]>([]);
  const [tab, setTab] = useState<"sms" | "note" | "call">("sms");
  const [text, setText] = useState("");
  const [duration, setDuration] = useState("");
  const [templates, setTemplates] = useState<{ id: string; name: string; content: string }[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [sending, setSending] = useState(false);
  const [flash, setFlash] = useState("");

  useEffect(() => {
    get("/api/crm/templates?channel=sms").then((d) => {
      if (d?.success) setTemplates(d.data);
    }).catch(() => {});
  }, []);

  // group by customer
  const groups = (() => {
    const map = new Map<string, { customer: Comm["customer"]; items: Comm[]; lastAt: string }>();
    for (const c of comms) {
      const g = map.get(c.customerId) ?? { customer: c.customer, items: [], lastAt: c.createdAt };
      g.items.push(c);
      if (new Date(c.createdAt) > new Date(g.lastAt)) g.lastAt = c.createdAt;
      map.set(c.customerId, g);
    }
    return [...map.values()].sort((a, b) => +new Date(b.lastAt) - +new Date(a.lastAt));
  })();

  const selected = groups.find((g) => g.customer.id === selectedId);

  const openConversation = async (id: string) => {
    setSelectedId(id);
    setDetail([]);
    try {
      const d = await get(`/api/crm/customers/${id}/communications`);
      if (d.success) setDetail(d.data);
    } catch {}
  };

  const applyTemplate = (id: string) => {
    setTemplateId(id);
    const tpl = templates.find((t) => t.id === id);
    if (tpl) setText(tpl.content);
  };

  const send = async () => {
    if (!selectedId || !text.trim()) return;
    setSending(true);
    try {
      const res = await fetch("/api/crm/communications", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: selectedId,
          channel: tab,
          direction: "outbound",
          content: tab === "call" ? `تماس — ${duration || 0} ثانیه — ${text}` : text,
          durationSec: tab === "call" ? Number(duration) || 0 : undefined,
          templateId: tab === "sms" ? templateId || undefined : undefined,
          sendNow: tab === "sms",
        }),
      });
      const json = await res.json();
      setFlash(res.ok && json.success ? "ثبت شد ✓" : `خطا: ${json?.error?.message ?? res.status}`);
      if (res.ok && json.success) { setText(""); setDuration(""); await openConversation(selectedId); refresh(); }
    } catch { setFlash("خطای شبکه"); }
    finally { setSending(false); setTimeout(() => setFlash(""), 3000); }
  };


  const TABS: { key: typeof tab; label: string }[] = [
    { key: "sms", label: "پیامک" },
    { key: "note", label: "یادداشت" },
    { key: "call", label: "تماس" },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-white text-2xl font-black mb-6">صندوق ارتباطات</h1>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Conversations list */}
        <div className="rounded-2xl p-4 max-h-[70vh] overflow-y-auto" style={{ background: "#11223d" }}>
          <div className="text-white/70 text-sm font-bold mb-3">گفتگوها ({groups.length})</div>
          {groups.length === 0 && (
            <div className="text-white/40 text-sm py-8 text-center">هنوز گفتگویی ثبت نشده</div>
          )}
          {groups.map((g) => (
            <button
              key={g.customer.id}
              onClick={() => openConversation(g.customer.id)}
              data-testid={`conv-${g.customer.customerCode}`}
              className={`w-full text-right px-3 py-2.5 rounded-xl mb-1.5 transition-colors ${
                selectedId === g.customer.id ? "bg-[#51BB70]" : "hover:bg-white/5"
              }`}
            >
              <div className={`text-sm font-bold ${selectedId === g.customer.id ? "text-[#011B2C]" : "text-white"}`}>
                {g.customer.fullName ?? g.customer.customerCode}
              </div>
              <div className={`text-xs ${selectedId === g.customer.id ? "text-[#011B2C]/70" : "text-white/40"}`}>
                {g.customer.primaryPhone} · {g.items.length} پیام
              </div>
            </button>
          ))}
        </div>

        {/* Conversation view + composer */}
        <div className="rounded-2xl p-4 flex flex-col max-h-[70vh]" style={{ background: "#11223d" }} data-testid="conversation-view">
          <div className="flex-1 overflow-y-auto mb-4 space-y-2 pr-1">
            {detail.length === 0 && (
              <div className="text-white/40 text-sm py-10 text-center">
                {selectedId ? "پیامی ثبت نشده" : "یک گفتگو انتخاب کنید"}
              </div>
            )}
            {detail.map((m) => (
              <div key={m.id} className="rounded-xl px-4 py-2.5 max-w-[85%]"
                style={{ background: bubbleBg(m), marginRight: m.direction === "inbound" ? "auto" : 0 }}>
                <div className="text-[11px] text-black/60 mb-0.5">
                  {m.channel.toUpperCase()} · {m.operator?.fullName ?? "—"} · {STATUS[m.status] ?? m.status}
                </div>
                <div className="text-sm text-[#011B2C] whitespace-pre-wrap">{m.content}</div>
                <div className="text-[10px] text-black/50 mt-1" dir="ltr">
                  {new Date(m.createdAt).toLocaleString("fa-IR")}
                </div>
              </div>
            ))}
          </div>

          {selectedId && (
            <div className="border-t border-white/10 pt-3">
              <div className="flex gap-2 mb-2">
                {TABS.map((t) => (
                  <button key={t.key} onClick={() => setTab(t.key)}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold"
                    style={{ background: tab === t.key ? "#51BB70" : "rgba(255,255,255,0.08)", color: tab === t.key ? "#011B2C" : "#fff" }}
                    data-testid={`composer-tab-${t.key}`}>
                    {t.label}
                  </button>
                ))}
                {tab === "call" && (
                  <input type="number" min={0} placeholder="مدت (ثانیه)" value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    className="w-28 rounded-lg px-2 py-1 text-xs bg-[#0b1a2e] text-white border border-white/10 outline-none" />
                )}
                {tab === "sms" && templates.length > 0 && (
                  <select value={templateId} onChange={(e) => applyTemplate(e.target.value)}
                    className="rounded-lg px-2 py-1 text-xs bg-[#0b1a2e] text-white border border-white/10 outline-none">
                    <option value="">بدون قالب</option>
                    {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                )}
              </div>
              <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)}
                placeholder={tab === "note" ? "یادداشت…" : tab === "call" ? "خلاصه تماس…" : "متن پیامک…"}
                data-testid="composer-text"
                className="w-full rounded-xl p-3 text-sm text-white bg-[#0b1a2e] border border-white/10 focus:border-[#51BB70] outline-none resize-none" />
              <div className="flex items-center gap-3 mt-2">
                <button onClick={send} disabled={sending || !text.trim()}
                  data-testid="send-message"
                  className="px-4 py-2 rounded-xl text-sm font-bold text-[#011B2C] disabled:opacity-40"
                  style={{ background: "#51BB70" }}>
                  {sending ? "…" : "ثبت و ارسال"}
                </button>
                {flash && <span className="text-xs text-white/60" data-testid="composer-flash">{flash}</span>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const STATUS: Record<string, string> = {
  pending: "در انتظار", sent: "ارسال شد", delivered: "تحویل شد", failed: "ناموفق", read: "خوانده شد",
};

