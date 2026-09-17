"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { formatFaDate } from "@/lib/date-fa";

export const dynamic = "force-dynamic";

const statusMap: Record<string, string> = {
  available: "موجود",
  reserved: "کنسل",
  sold: "فروش رفته",
};

const statusStyles: Record<string, string> = {
  available: "bg-green-500/15 text-green-300 border-green-500/40",
  reserved: "bg-amber-500/15 text-amber-300 border-amber-500/40",
  sold: "bg-gray-500/15 text-gray-300 border-gray-400/40",
};

type ConsignmentItem = {
  id: string;
  simNumber: string;
  ownerName: string;
  phone: string | null;
  price: string | null;
  notes: string | null;
  duration: number | null;
  status: string;
  source: string;
  createdAt: string;
  updatedAt: string;
};

const fmt = (v: string | number | null | undefined) => {
  if (v === null || v === undefined || v === "") return "—";
  const n = Number(String(v).replace(/[^\d]/g, ""));
  return Number.isFinite(n) && n > 0 ? n.toLocaleString("en-US") : String(v);
};

export default function ConsignmentDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id;

  const [item, setItem] = useState<ConsignmentItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // ویرایش قیمت
  const [editingPrice, setEditingPrice] = useState(false);
  const [priceInput, setPriceInput] = useState("");
  // تغییرات در انتظار ثبت (یک دکمه ثبت همه)
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [selectedDuration, setSelectedDuration] = useState<number | null>(null);

  const loadItem = useCallback(async () => {
    if (!id) return;
    try {
      setError(null);
      const res = await fetch(`/api/consignments/${id}`, { credentials: "include" });
      const json = await res.json();
      if (res.status === 404) {
        // آیتم حذف شده (فروش رفته/کنسل) یا ناموجود — قابل بازکردن نیست
        setNotFound(true);
        return;
      }
      if (!res.ok || !json.success) {
        throw new Error(json.message || "خطا در دریافت آیتم");
      }
      setItem(json.data);
    } catch (err) {
      console.error("Failed to load consignment item:", err);
      setError("خطا در بارگذاری پرونده امانی");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadItem();
  }, [loadItem]);

  // آیتم یافت نشد (حذف شده/فروش رفته) → پیام + بازگشت خودکار به لیست امانی
  useEffect(() => {
    if (!notFound) return;
    const t = setTimeout(() => router.replace("/operators/product-manager/escrow/list"), 2500);
    return () => clearTimeout(t);
  }, [notFound, router]);

  // انتخاب مدت امانت (فقط انتخاب، ذخیره با دکمه اصلی)
  const handleSelectDuration = (days: number) => {
    setSelectedDuration(days);
  };

  // انتخاب وضعیت (فقط انتخاب، ذخیره با دکمه اصلی)
  const handleSelectStatus = (status: string) => {
    setSelectedStatus(status);
  };

  // ثبت همه تغییرات در یک PATCH
  const handleSaveAll = async () => {
    const body: Record<string, unknown> = {};

    // قیمت — فقط اگر در حال ویرایش و تغییری وجود داشته باشد
    if (editingPrice) {
      const raw = priceInput.replace(/[^\d]/g, "");
      const n = raw ? Number(raw) : NaN;
      if (!Number.isFinite(n) || n <= 0) {
        setActionError("قیمت نامعتبر است");
        return;
      }
      body.price = String(n);
    }

    // مدت امانت
    if (selectedDuration !== null && selectedDuration !== item?.duration) {
      body.duration = selectedDuration;
    }

    // وضعیت
    if (selectedStatus && selectedStatus !== item?.status) {
      body.status = selectedStatus;
    }

    if (Object.keys(body).length === 0) {
      setActionError("تغییری برای ثبت انتخاب نشده است");
      return;
    }

    try {
      setBusy(true);
      setActionError(null);
      const res = await fetch(`/api/consignments/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "خطا در ثبت تغییرات");
      }
      // بازنشانی همه انتخاب‌ها
      setItem(json.data);
      setEditingPrice(false);
      setSelectedStatus(null);
      setSelectedDuration(null);
      setPriceInput("");
      // ثبت موفق → بازگشت به لیست امانی
      router.push("/operators/product-manager/escrow/list");
    } catch (err) {
      console.error("Failed to save consignment changes:", err);
      setActionError(err instanceof Error ? err.message : "خطا در ثبت تغییرات");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#203253] to-[#11223d] text-white flex items-center justify-center">
        <p className="text-white/60">در حال بارگذاری پرونده…</p>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#203253] to-[#11223d] text-white flex flex-col items-center justify-center gap-3">
        <p className="text-lg text-white/90">آیتم یافت نشد</p>
        <p className="text-sm text-white/50">
          این پرونده امانی حذف شده (فروش رفته یا کنسل) و قابل مشاهده نیست.
        </p>
        <p className="text-xs text-white/40">در حال بازگشت به لیست امانی…</p>
        <Link
          href="/operators/product-manager/escrow/list"
          className="h-10 px-4 inline-flex items-center rounded-xl bg-white/10 border border-white/20 text-white text-sm hover:bg-white/20 transition"
        >
          بازگشت به لیست امانی
        </Link>
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#203253] to-[#11223d] text-white flex flex-col items-center justify-center gap-4">
        <p className="text-red-300">{error || "آیتم یافت نشد"}</p>
        <Link
          href="/operators/product-manager/escrow/list"
          className="h-10 px-4 inline-flex items-center rounded-xl bg-white/10 border border-white/20 text-white text-sm hover:bg-white/20 transition"
        >
          بازگشت به لیست امانی
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#203253] to-[#11223d] text-white p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold">پرونده امانی — خط {item.simNumber}</h1>
            <p className="text-sm text-white/60 mt-1">
              ثبت: {item.createdAt ? formatFaDate(item.createdAt) : "—"} · منبع:{" "}
              {item.source === "workflow" ? "ورک‌فلو" : "ثبت دستی"}
            </p>
          </div>
          <Link
            href="/operators/product-manager/escrow/list"
            className="h-12 md:h-10 px-4 inline-flex items-center rounded-xl bg-white/10 border border-white/20 text-white text-sm hover:bg-white/20 transition shadow-lg shadow-black/10"
          >
            بازگشت به لیست
          </Link>
        </div>

        {actionError && (
          <div className="rounded-2xl border border-red-500/50 bg-red-600/20 px-4 py-3 text-sm text-red-300">
            {actionError}
          </div>
        )}

        {/* Data card */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-4 shadow-lg shadow-black/10">
          <div className="flex items-center justify-between">
            <span className="text-white/60 text-sm">وضعیت</span>
            <span
              className={`px-3 py-1 rounded-full border text-sm font-bold ${
                statusStyles[item.status] || "border-white/20 bg-white/5 text-white/70"
              }`}
            >
              {statusMap[item.status] || item.status}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              ["شماره امانت داده شده", `خط ${item.simNumber}`],
              ["نام مالک", item.ownerName || "—"],
              ["شماره تماس", item.phone || "—"],
              ["مدت امانت", item.duration ? `${item.duration} روز` : "—"],
              ["آخرین بروزرسانی", item.updatedAt ? formatFaDate(item.updatedAt) : "—"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl bg-white/5 border border-white/10 px-4 py-3">
                <p className="text-xs text-white/60 mb-1">{label}</p>
                <p className="font-bold">{value}</p>
              </div>
            ))}
            {/* قیمت — قابل ویرایش */}
            <div className="rounded-xl bg-white/5 border border-white/10 px-4 py-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-white/60">قیمت</p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setPriceInput(item.price ? String(Number(String(item.price).replace(/[^\d]/g, ""))) : "");
                    setEditingPrice((v) => !v);
                  }}
                  className="text-xs font-bold text-[#51BB70] hover:underline disabled:opacity-40"
                >
                  {editingPrice ? "انصراف" : "ویرایش"}
                </button>
              </div>
              {editingPrice ? (
                <input
                  type="number"
                  min={1}
                  value={priceInput}
                  onChange={(e) => setPriceInput(e.target.value)}
                  placeholder="مثلاً 250000000"
                  className="w-full h-12 rounded-lg bg-white/5 border border-white/10 px-3 text-white text-sm outline-none focus:border-[#51BB70]/50 transition"
                />
              ) : (
                <p className="font-bold">{fmt(item.price)} تومان</p>
              )}
            </div>
          </div>
          <div className="rounded-xl bg-white/5 border border-white/10 px-4 py-3">
            <p className="text-xs text-white/60 mb-1">توضیحات</p>
            <p className="text-sm">{item.notes || "—"}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* تمدید امانت — انتخاب مدت (ذخیره با دکمه اصلی) */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-3">
            <h2 className="font-bold text-green-300 text-base md:text-lg">تمدید امانت</h2>
            <div className="grid grid-cols-3 gap-2">
              {[
                [10, "۱۰ روز"],
                [20, "۲۰ روز"],
                [30, "۳۰ روز"],
              ].map(([d, label]) => (
                <button
                  key={d}
                  type="button"
                  disabled={busy}
                  onClick={() => handleSelectDuration(d as number)}
                  className={`h-12 px-2 rounded-xl border text-sm font-bold transition disabled:opacity-40 ${
                    selectedDuration === d
                      ? "bg-[#51BB70] border-[#51BB70] text-[#011B2C]"
                      : item.duration === d
                      ? "bg-[#51BB70]/15 border-[#51BB70]/40 text-green-300"
                      : "bg-white/10 border-white/20 text-white hover:bg-white/20"
                  }`}
                >
                  {label}
                  {selectedDuration === d ? " ✓" : item.duration === d ? " (فعلی)" : ""}
                </button>
              ))}
            </div>
            <p className="text-xs text-white/50">
              مدت فعلی: {item.duration ? `${item.duration} روز` : "—"}
              {selectedDuration !== null && selectedDuration !== item.duration
                ? ` → جدید: ${selectedDuration} روز`
                : ""}
            </p>
          </div>

          {/* تغییر وضعیت: انتخاب */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-3">
            <h2 className="font-bold text-amber-300 text-base md:text-lg">تغییر وضعیت</h2>
            <div className="flex flex-col gap-2">
              {Object.entries(statusMap).map(([key, label]) => {
                const isCurrent = key === item.status;
                const isSelected = selectedStatus === key;
                return (
                  <button
                    key={key}
                    type="button"
                    disabled={busy}
                    onClick={() => handleSelectStatus(key)}
                    className={`h-12 rounded-xl border text-sm font-bold transition disabled:opacity-30 ${
                      isSelected
                        ? "bg-[#51BB70]/20 border-[#51BB70] text-green-200"
                        : isCurrent
                        ? statusStyles[key]
                        : "bg-white/10 border-white/20 text-white hover:bg-white/20"
                    }`}
                  >
                    {label}
                    {isCurrent ? " (فعلی)" : isSelected ? " ✓" : ""}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-white/50">
              با انتخاب «کنسل» یا «فروش رفته»، آیتم از لیست امانی حذف می‌شود.
            </p>
          </div>

          {/* ثبت همه تغییرات — یک PATCH واحد */}
          <button
            type="button"
            disabled={busy}
            onClick={handleSaveAll}
            className="w-full col-span-full h-14 rounded-2xl bg-[#51BB70] text-[#011B2C] text-base font-bold hover:bg-[#46a862] transition disabled:opacity-40 shadow-lg shadow-[#51BB70]/20"
          >
            {busy ? "در حال ثبت..." : "ثبت همه تغییرات"}
          </button>
        </div>
      </div>
    </div>
  );
}
