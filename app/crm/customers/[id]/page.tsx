"use client";

export const dynamic = "force-dynamic";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Activity, FileText, MessageSquare, Paperclip, Tag as TagIcon, StickyNote } from "lucide-react";
import CrmCard from "@/components/crm/common/CrmCard";
import CrmBadge from "@/components/crm/common/CrmBadge";
import CrmButton from "@/components/crm/common/CrmButton";
import EditCustomerModal from "@/components/crm/customers/EditCustomerModal";
import { NotesTab } from "@/components/crm/customers/NotesTab";
import { TagsTab } from "@/components/crm/customers/TagsTab";
import { TimelineTab } from "@/components/crm/customers/TimelineTab";
import { crmFetch } from "@/lib/crm/client";

const SEGMENT_FA: Record<string, string> = {
  vip: "VIP", hot: "داغ", regular: "معمولی", cold: "سرد",
};

const INTERACTION_FA: Record<string, string> = {
  form_submission: "ثبت فرم",
  call: "تماس",
  note: "یادداشت",
  meeting: "جلسه",
  sms: "پیامک",
  email: "ایمیل",
};

type Customer = {
  id: string;
  customerCode: string;
  fullName: string | null;
  primaryPhone: string;
  secondaryPhone: string | null;
  nationalId: string | null;
  segment: string;
  status: string;
  score: number;
  source: string | null;
  createdAt: string;
  lastInteractionAt: string | null;
  tags: { id: string; tag: string; color: string | null }[];
  notes: { id: string; content: string; createdAt: string; author: { username: string; fullName: string | null } | null }[];
  interactions: { id: string; interactionType: string; title: string; description: string | null; createdAt: string }[];
  documents: { id: string; title: string | null; fileKey: string; createdAt: string }[];
};

const faDateTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("fa-IR", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

const TABS = [
  { key: "timeline", label: "تایم‌لاین", icon: <Activity size={15} /> },
  { key: "interactions", label: "تعاملات", icon: <FileText size={15} /> },
  { key: "communications", label: "ارتباطات", icon: <MessageSquare size={15} /> },
  { key: "files", label: "فایل‌ها", icon: <Paperclip size={15} /> },
  { key: "notes", label: "یادداشت‌ها", icon: <StickyNote size={15} /> },
  { key: "tags", label: "تگ‌ها", icon: <TagIcon size={15} /> },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default function Customer360Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [tab, setTab] = useState<TabKey>("interactions");
  const [editOpen, setEditOpen] = useState(false);

  const load = useCallback(async () => {
    const res = await crmFetch(`/api/crm/customers/${id}`);
    if (res.status === 404) { setNotFound(true); return; }
    if (res.ok) setCustomer(res.data.data);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (notFound) {
    return (
      <div className="text-center py-20">
        <p className="text-white/60 mb-4">مشتری یافت نشد</p>
        <Link href="/crm/customers" className="text-[#51BB70] text-sm font-bold hover:underline">بازگشت به لیست</Link>
      </div>
    );
  }

  if (!customer) {
    return <div className="text-white/40 text-sm text-center py-20">در حال بارگذاری…</div>;
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link href="/crm/customers" className="text-white/50 hover:text-white p-1" aria-label="بازگشت"><ArrowRight size={20} /></Link>
          <div>
            <h1 className="text-white text-xl font-black" data-testid="crm-360-name">
              {customer.fullName || "بدون نام"}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-white/40 text-xs" dir="ltr" data-testid="crm-360-code">{customer.customerCode}</span>
              <CrmBadge label={SEGMENT_FA[customer.segment] || customer.segment} tone={customer.segment} />
              <CrmBadge label={customer.status === "active" ? "فعال" : "غیرفعال"} tone={customer.status} />
            </div>
          </div>
        </div>
        <CrmButton variant="ghost" onClick={() => setEditOpen(true)} data-testid="crm-edit-open">ویرایش</CrmButton>
      </div>

      <div className="grid lg:grid-cols-[340px_1fr] gap-5">
        {/* Left column */}
        <div className="flex flex-col gap-4">
          <CrmCard title="اطلاعات مشتری">
            <dl className="flex flex-col gap-2.5 text-sm">
              {[
                ["موبایل", <span key="p" dir="ltr" className="text-white/80">{customer.primaryPhone}</span>],
                ["موبایل دوم", customer.secondaryPhone ? <span key="p2" dir="ltr" className="text-white/80">{customer.secondaryPhone}</span> : <span key="p2d">—</span>],
                ["کد ملی", customer.nationalId || "—"],
                ["منشأ", customer.source || "—"],
                ["تاریخ ثبت", faDateTime(customer.createdAt)],
              ].map((row, i) => (
                <div key={i} className="flex justify-between border-b border-white/5 pb-2">
                  <dt className="text-white/40 text-xs">{row[0] as string}</dt>
                  <dd className="text-white/80 text-xs">{row[1] as any}</dd>
                </div>
              ))}
            </dl>
          </CrmCard>

          <CrmCard title="آمار">
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="rounded-xl p-3" style={{ background: "rgba(10,22,40,0.5)" }}>
                <div className="text-white text-2xl font-black" data-testid="crm-360-score">{customer.score}</div>
                <div className="text-white/40 text-[11px] mt-1">امتیاز</div>
              </div>
              <div className="rounded-xl p-3" style={{ background: "rgba(10,22,40,0.5)" }}>
                <div className="text-white text-2xl font-black">{customer.interactions.length}</div>
                <div className="text-white/40 text-[11px] mt-1">تعاملات</div>
              </div>
              <div className="rounded-xl p-3" style={{ background: "rgba(10,22,40,0.5)" }}>
                <div className="text-white text-2xl font-black">{customer.notes.length}</div>
                <div className="text-white/40 text-[11px] mt-1">یادداشت‌ها</div>
              </div>
              <div className="rounded-xl p-3" style={{ background: "rgba(10,22,40,0.5)" }}>
                <div className="text-white text-2xl font-black">{customer.tags.length}</div>
                <div className="text-white/40 text-[11px] mt-1">تگ‌ها</div>
              </div>
            </div>
            <div className="text-white/40 text-[11px] mt-3 text-center">
              آخرین تعامل: {faDateTime(customer.lastInteractionAt)}
            </div>
          </CrmCard>
        </div>

        {/* Right column — tabs */}
        <div className="flex flex-col gap-4">
          <div className="flex gap-1 flex-wrap">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
                  tab === t.key ? "bg-[#51BB70] text-[#011B2C]" : "text-white/60 hover:text-white hover:bg-white/5"
                }`}
                style={tab !== t.key ? { background: "rgba(28,57,104,0.3)" } : undefined}
                data-testid={`crm-tab-${t.key}`}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>

          {tab === "timeline" && <TimelineTab customerId={customer.id} />}

          {tab === "interactions" && (
            <CrmCard title="تاریخچه تعاملات">
              <div className="flex flex-col gap-0" data-testid="crm-interactions-timeline">
                {customer.interactions.map((it, i) => (
                  <div key={it.id} className="flex gap-3 pb-4 last:pb-0">
                    <div className="flex flex-col items-center">
                      <div className="w-2.5 h-2.5 rounded-full mt-1.5 shrink-0" style={{ background: "#51BB70" }} />
                      {i < customer.interactions.length - 1 && <div className="w-px flex-1 bg-white/10 my-1" />}
                    </div>
                    <div className="flex-1 pb-1">
                      <div className="flex justify-between flex-wrap gap-1">
                        <span className="text-white text-sm font-bold">{it.title}</span>
                        <CrmBadge label={INTERACTION_FA[it.interactionType] || it.interactionType} />
                      </div>
                      {it.description && <div className="text-white/50 text-xs mt-1">{it.description}</div>}
                      <div className="text-white/30 text-[11px] mt-1">{faDateTime(it.createdAt)}</div>
                    </div>
                  </div>
                ))}
                {customer.interactions.length === 0 && (
                  <div className="text-white/40 text-sm text-center py-8">هنوز تعاملی ثبت نشده است</div>
                )}
              </div>
            </CrmCard>
          )}

          {tab === "communications" && (
            <CrmCard title="ارتباطات">
              <div className="text-white/40 text-sm text-center py-12">
                این بخش در فاز ۲ فعال می‌شود (تماس، پیامک، ایمیل)
              </div>
            </CrmCard>
          )}

          {tab === "files" && (
            <CrmCard title="فایل‌ها">
              {customer.documents.length === 0 ? (
                <div className="text-white/40 text-sm text-center py-12">فایلی بارگذاری نشده است</div>
              ) : (
                <div className="flex flex-col gap-2">
                  {customer.documents.map((d) => (
                    <div key={d.id} className="flex justify-between items-center px-3 py-2 rounded-xl" style={{ background: "rgba(10,22,40,0.5)" }}>
                      <span className="text-white/80 text-sm">{d.title || d.fileKey}</span>
                      <span className="text-white/30 text-[11px]">{faDateTime(d.createdAt)}</span>
                    </div>
                  ))}
                </div>
              )}
            </CrmCard>
          )}

          {tab === "notes" && <NotesTab customerId={customer.id} notes={customer.notes} onReload={load} />}
          {tab === "tags" && <TagsTab customerId={customer.id} tags={customer.tags} onReload={load} />}
        </div>
      </div>

      {editOpen && (
        <EditCustomerModal
          customerId={customer.id}
          initial={{
            fullName: customer.fullName || "",
            secondaryPhone: customer.secondaryPhone || "",
            nationalId: customer.nationalId || "",
            segment: customer.segment,
          }}
          onClose={() => setEditOpen(false)}
          onSaved={() => { setEditOpen(false); load(); }}
        />
      )}
    </div>
  );
}
