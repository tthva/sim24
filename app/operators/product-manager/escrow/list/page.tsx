"use client";

import React, { useCallback, useEffect, useState } from "react";
import AgentDashboard, {
  WorkItem,
} from "@/components/AgentDashboard";
import { formatFaDate } from "@/lib/date-fa";

export const dynamic = "force-dynamic";

const statusMap: Record<string, string> = {
  available: "موجود",
  reserved: "کنسل",
  sold: "فروش رفته",
};

const emptyForm = { simNumber: "", ownerName: "", phone: "", price: "", notes: "" };

export default function ProductManagerPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [works, setWorks] = useState<WorkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  // ---------- منطق دسته‌بندی هوشمند بر اساس مدت امانت و انقضا ----------
  const MS_PER_DAY = 24 * 60 * 60 * 1000;

  const daysLeft = (item: any): number | null => {
    if (!item.duration && item.duration !== 0) return null;
    const created = new Date(item.createdAt).getTime();
    const expiry = created + Number(item.duration) * MS_PER_DAY;
    return Math.floor((expiry - Date.now()) / MS_PER_DAY);
  };

  const expiryStatus = (d: number | null): string => {
    if (d === null) return "نامشخص";
    if (d < 0) return "منقضی شده";
    if (d < 3) return "در آستانه انقضا";
    return "فعال";
  };

  const durationGroup = (item: any): string => {
    if (item.duration === 10) return "۱۰ روزه";
    if (item.duration === 20) return "۲۰ روزه";
    if (item.duration === 30) return "۳۰ روزه";
    return "نامشخص";
  };

  const groupOrder: Record<string, number> = { "۱۰ روزه": 1, "۲۰ روزه": 2, "۳۰ روزه": 3, "نامشخص": 4 };

  const loadItems = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch("/api/consignments", { credentials: "include" });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "خطا در دریافت لیست");
      }
      const items: any[] = json.data || [];

      const enriched = items.map((item) => ({ _item: item, _days: daysLeft(item) }));

      // مرتب‌سازی: ابتدا گروه مدت، سپس در هر گروه نزدیک‌ترین انقضا اول
      enriched.sort((a, b) => {
        const ga = groupOrder[durationGroup(a._item)];
        const gb = groupOrder[durationGroup(b._item)];
        if (ga !== gb) return ga - gb;
        if (a._days === null) return 1;
        if (b._days === null) return -1;
        return a._days - b._days;
      });

      setWorks(
        enriched.map(({ _item, _days }) => ({
          id: _item.id,
          title: `خط ${_item.simNumber}`,
          section: durationGroup(_item),
          status: expiryStatus(_days),
          phone: _item.phone || "—",
          owner: _item.ownerName || "—",
          duration: _item.duration ?? null,
          daysLeft: _days,
          date: _item.createdAt ? formatFaDate(_item.createdAt) : "—",
          href: `/operators/product-manager/escrow/${_item.id}`,
        }))
      );
    } catch (err) {
      console.error("Failed to load consignment:", err);
      setError("خطا در بارگذاری لیست امانی");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const handleSubmit = async () => {
    if (!form.simNumber.trim() || !form.ownerName.trim() || !form.phone.trim()) {
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/consignments", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "خطا در افزودن");
      }
      setShowModal(false);
      setForm(emptyForm);
      await loadItems();
    } catch (err) {
      console.error("Failed to add consignment:", err);
      setError("خطا در افزودن آیتم امانی");
    } finally {
      setSubmitting(false);
    }
  };

  // فیلتر کردن آیتم‌ها بر اساس جستجو
  const filteredWorks = works.filter((work) => {
    const query = searchQuery.toLowerCase();
    return (
      work.title.toLowerCase().includes(query) ||
      work.section.toLowerCase().includes(query) ||
      work.status.toLowerCase().includes(query) ||
      work.phone.includes(query) ||
      work.id.includes(query)
    );
  });

  // محاسبه دسته‌بندی‌ها (گروه‌های مدت امانت) با تعداد
  const categories = (() => {
    const counts: Record<string, number> = {};
    for (const w of works) counts[w.section] = (counts[w.section] || 0) + 1;
    return Object.keys(groupOrder)
      .filter((g) => counts[g])
      .map((g) => ({ title: g, count: counts[g], href: "#" }));
  })();

  return (
    <AgentDashboard
      title="لیست شماره های امانی"
      categories={categories}
      works={filteredWorks}
      loading={loading}
      error={error}
      hideWorkStats={true}
    >
      {/* Add Button */}
      <div className="mb-4 flex justify-start">
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 h-12 px-6 rounded-2xl bg-green-500 text-white font-bold hover:bg-green-400 transition-colors shadow-lg shadow-green-500/20"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 4v16m8-8H4"
            />
          </svg>
          افزودن امانی
        </button>
      </div>

      {/* Search Input */}
      <div className="mb-4">
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="جستجو بر اساس عنوان، بخش، وضعیت، شماره تماس یا کد..."
            className="w-full h-12 pr-12 pl-4 rounded-2xl bg-white/10 border border-white/20 text-white placeholder-white/40 backdrop-blur-md focus:outline-none focus:border-green-400 focus:ring-1 focus:ring-green-400/30 transition-all"
          />
          <svg
            className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z"
            />
          </svg>
        </div>
      </div>

      {/* Add Consignment Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => !submitting && setShowModal(false)}
        >
          <div
            className="w-full max-w-md rounded-3xl bg-[#1a2b47] border border-white/10 p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold mb-5">افزودن شماره امانی</h2>

            <div className="space-y-4">
              {(
                [
                  { key: "simNumber", label: "شماره سیم‌کارت *", type: "text" },
                  { key: "ownerName", label: "نام مالک *", type: "text" },
                  { key: "phone", label: "شماره تماس *", type: "tel" },
                  { key: "price", label: "قیمت", type: "text" },
                ] as const
              ).map((f) => (
                <div key={f.key}>
                  <label className="block text-white/60 text-xs mb-1">
                    {f.label}
                  </label>
                  <input
                    type={f.type}
                    value={form[f.key]}
                    onChange={(e) =>
                      setForm({ ...form, [f.key]: e.target.value })
                    }
                    className="w-full h-11 px-4 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:border-green-400 transition-all"
                  />
                </div>
              ))}

              <div>
                <label className="block text-white/60 text-xs mb-1">توضیحات</label>
                <textarea
                  value={form.notes}
                  onChange={(e) =>
                    setForm({ ...form, notes: e.target.value })
                  }
                  rows={3}
                  className="w-full px-4 py-2 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:border-green-400 transition-all resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                type="button"
                disabled={
                  submitting ||
                  !form.simNumber.trim() ||
                  !form.ownerName.trim() ||
                  !form.phone.trim()
                }
                onClick={handleSubmit}
                className="flex-1 h-12 rounded-2xl bg-green-500 text-white font-bold hover:bg-green-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? "در حال ذخیره..." : "ذخیره"}
              </button>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                disabled={submitting}
                className="flex-1 h-12 rounded-2xl bg-white/10 border border-white/20 text-white hover:bg-white/15 transition-colors disabled:opacity-50"
              >
                انصراف
              </button>
            </div>
          </div>
        </div>
      )}
    </AgentDashboard>
  );
}