"use client";

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Plus, LayoutGrid, List } from "lucide-react";
import CrmCard from "@/components/crm/common/CrmCard";
import CrmBadge from "@/components/crm/common/CrmBadge";
import CrmButton from "@/components/crm/common/CrmButton";
import CrmTable, { Td, Th } from "@/components/crm/common/CrmTable";
import NewCustomerModal from "@/components/crm/NewCustomerModal";
import { crmFetch } from "@/lib/crm/client";

const SEGMENT_FA: Record<string, string> = {
  vip: "VIP", hot: "داغ", regular: "معمولی", cold: "سرد",
};

type CustomerRow = {
  id: string;
  customerCode: string;
  fullName: string | null;
  primaryPhone: string;
  score: number;
  segment: string;
  status: string;
  tags: { tag: string; color: string | null }[];
  lastInteractionAt: string | null;
  interactions: { createdAt: string }[];
};

const faDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("fa-IR", { year: "numeric", month: "short", day: "numeric" }) : "—";

export default function CustomerListPage() {
  const router = useRouter();
  const [data, setData] = useState<{ total: number; page: number; pages: number; customers: CustomerRow[] } | null>(null);
  const [search, setSearch] = useState("");
  const [segment, setSegment] = useState("");
  const [status, setStatus] = useState("");
  const [tag, setTag] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [view, setView] = useState<"table" | "card">("table");
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (segment) params.set("segment", segment);
    if (status) params.set("status", status);
    if (tag) params.set("tag", tag);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    params.set("page", String(page));
    const res = await crmFetch(`/api/crm/customers?${params.toString()}`);
    if (res.ok) setData(res.data.data);
    setLoading(false);
  }, [search, segment, status, tag, from, to, page]);

  useEffect(() => {
    const t = setTimeout(load, 300); // debounce search
    return () => clearTimeout(t);
  }, [load]);

  const rows = data?.customers ?? [];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h1 className="text-white text-xl font-black" data-testid="crm-customers-title">
          مشتریان
        </h1>
        <CrmButton onClick={() => setShowNew(true)}>
          <span className="flex items-center gap-1"><Plus size={16} /> مشتری جدید</span>
        </CrmButton>
      </div>

      {/* Filters */}
      <CrmCard>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="جستجو: نام، موبایل، کد مشتری…"
              className="w-full text-white text-sm py-2 pr-9 pl-3 rounded-xl outline-none placeholder:text-white/30"
              style={{ background: "rgba(10,22,40,0.6)", border: "1px solid rgba(81,187,254,0.2)" }}
              data-testid="crm-search"
            />
          </div>
          <select value={segment} onChange={(e) => { setSegment(e.target.value); setPage(1); }} className="text-white text-xs py-2 px-3 rounded-xl outline-none" style={{ background: "#11223d", border: "1px solid rgba(81,187,254,0.2)" }} data-testid="crm-filter-segment">
            <option value="">همه Segmentها</option>
            {Object.entries(SEGMENT_FA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="text-white text-xs py-2 px-3 rounded-xl outline-none" style={{ background: "#11223d", border: "1px solid rgba(81,187,254,0.2)" }} data-testid="crm-filter-status">
            <option value="">همه وضعیت‌ها</option>
            <option value="active">فعال</option>
            <option value="inactive">غیرفعال</option>
          </select>
          <input type="text" value={tag} onChange={(e) => { setTag(e.target.value); setPage(1); }} placeholder="تگ" className="text-white text-xs py-2 px-3 rounded-xl outline-none w-24 placeholder:text-white/30" style={{ background: "rgba(10,22,40,0.6)", border: "1px solid rgba(81,187,254,0.2)" }} />
          <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} className="text-white text-xs py-2 px-3 rounded-xl outline-none" style={{ background: "#11223d", border: "1px solid rgba(81,187,254,0.2)" }} />
          <input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} className="text-white text-xs py-2 px-3 rounded-xl outline-none" style={{ background: "#11223d", border: "1px solid rgba(81,187,254,0.2)" }} />
          <div className="flex rounded-xl overflow-hidden" style={{ border: "1px solid rgba(81,187,254,0.2)" }}>
            <button onClick={() => setView("table")} className={`p-2 ${view === "table" ? "bg-[#51BB70] text-[#011B2C]" : "text-white/50"}`} aria-label="نمای جدول"><List size={16} /></button>
            <button onClick={() => setView("card")} className={`p-2 ${view === "card" ? "bg-[#51BB70] text-[#011B2C]" : "text-white/50"}`} aria-label="نمای کارت"><LayoutGrid size={16} /></button>
          </div>
        </div>
      </CrmCard>

      {/* List */}
      <CrmCard>
        {loading && !data ? (
          <div className="text-white/40 text-sm text-center py-10">در حال بارگذاری…</div>
        ) : view === "table" ? (
          <CrmTable
            head={<><Th>☐</Th><Th>کد</Th><Th>نام</Th><Th>موبایل</Th><Th>امتیاز</Th><Th>تگ‌ها</Th><Th>آخرین تعامل</Th><Th>عملیات</Th></>}
            empty="مشتری‌ای یافت نشد"
          >
            {rows.map((c) => (
              <tr
                key={c.id}
                className="hover:bg-white/5 cursor-pointer"
                onClick={() => router.push(`/crm/customers/${c.id}`)}
                data-testid={`crm-row-${c.customerCode}`}
              >
                <Td><input type="checkbox" onClick={(e) => e.stopPropagation()} className="accent-[#51BB70]" /></Td>
                <Td><span className="text-white/60 text-xs" dir="ltr">{c.customerCode}</span></Td>
                <Td><span className="text-white font-bold">{c.fullName || "بدون نام"}</span></Td>
                <Td><span dir="ltr" className="text-white/70 text-xs">{c.primaryPhone}</span></Td>
                <Td><CrmBadge label={`${c.score}`} tone={c.score >= 50 ? "vip" : "regular"} /></Td>
                <Td>
                  <div className="flex gap-1 flex-wrap">
                    {c.tags.map((t) => <CrmBadge key={t.tag} label={t.tag} />)}
                  </div>
                </Td>
                <Td><span className="text-white/50 text-xs">{faDate(c.interactions?.[0]?.createdAt ?? null)}</span></Td>
                <Td>
                  <Link href={`/crm/customers/${c.id}`} onClick={(e) => e.stopPropagation()} className="text-[#51BB70] text-xs font-bold hover:underline" data-testid={`crm-open-${c.customerCode}`}>
                    مشاهده
                  </Link>
                </Td>
              </tr>
            ))}
          </CrmTable>
        ) : (
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {rows.map((c) => (
              <Link
                key={c.id}
                href={`/crm/customers/${c.id}`}
                className="rounded-xl p-4 hover:bg-white/5 transition-colors"
                style={{ background: "rgba(10,22,40,0.5)", border: "1px solid rgba(81,187,254,0.15)" }}
              >
                <div className="flex justify-between items-center">
                  <span className="text-white font-bold text-sm">{c.fullName || "بدون نام"}</span>
                  <CrmBadge label={SEGMENT_FA[c.segment] || c.segment} tone={c.segment} />
                </div>
                <div className="text-white/40 text-xs mt-1" dir="ltr">{c.primaryPhone} • {c.customerCode}</div>
                <div className="flex gap-1 mt-2 flex-wrap">
                  {c.tags.map((t) => <CrmBadge key={t.tag} label={t.tag} />)}
                </div>
              </Link>
            ))}
            {rows.length === 0 && <div className="text-white/40 text-sm text-center py-10 col-span-full">مشتری‌ای یافت نشد</div>}
          </div>
        )}

        {/* Pagination */}
        {data && data.pages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-4" data-testid="crm-pagination">
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1.5 rounded-lg text-xs text-white/70 disabled:opacity-30" style={{ background: "rgba(10,22,40,0.6)", border: "1px solid rgba(81,187,254,0.2)" }}>
              قبلی
            </button>
            <span className="text-white/50 text-xs">صفحه {page} از {data.pages}</span>
            <button disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 rounded-lg text-xs text-white/70 disabled:opacity-30" style={{ background: "rgba(10,22,40,0.6)", border: "1px solid rgba(81,187,254,0.2)" }}>
              بعدی
            </button>
          </div>
        )}
      </CrmCard>

      {showNew && <NewCustomerModal onClose={() => setShowNew(false)} onCreated={() => { setShowNew(false); load(); }} />}
    </div>
  );
}


