"use client";

import { useCallback, useEffect, useState } from "react";

interface PhoneItem {
  id: string;
  phone: string;
  reason?: string | null;
  note?: string | null;
  createdAt: string;
}

interface Suggestion {
  phone: string;
  count: number;
}

interface PhoneListManagerProps {
  title: string;
  endpoint: string; // "/api/price-expert/blacklist" | "/api/price-expert/whitelist"
  accent: "red" | "green"; // رنگ تم لیست
  noteLabel: string; // "دلیل" | "یادداشت"
  showSuggestions: boolean; // پنل «پیشنهاد بلاک» فقط برای بلک‌لیست
}

export default function PhoneListManager({
  title,
  endpoint,
  accent,
  noteLabel,
  showSuggestions,
}: PhoneListManagerProps) {
  const [items, setItems] = useState<PhoneItem[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(endpoint, { credentials: "include" });
      const json = await res.json();
      if (res.ok && json.success) {
        setItems(json.data?.items ?? []);
        setSuggestions(json.data?.suggestions ?? []);
        setError(null);
      } else {
        setError(json.message || "خطا در بارگذاری");
      }
    } catch {
      setError("خطا در ارتباط با سرور");
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAdd = async (addPhone: string, addNote: string) => {
    setError(null);
    setMessage(null);
    if (!/^09\d{9}$/.test(addPhone.trim())) {
      setError("شماره باید ۱۱ رقم و با 09 شروع شود");
      return;
    }
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(
          addNote.trim()
            ? { phone: addPhone.trim(), [accent === "red" ? "reason" : "note"]: addNote.trim() }
            : { phone: addPhone.trim() },
        ),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setMessage("با موفقیت اضافه شد");
        setPhone("");
        setNote("");
        await load();
      } else {
        setError(json.message || "خطا در افزودن");
      }
    } catch {
      setError("خطا در ارتباط با سرور");
    }
  };

  const handleRemove = async (targetPhone: string) => {
    if (!window.confirm(`حذف ${targetPhone} از ${title}؟`)) return;
    try {
      const res = await fetch(`${endpoint}?phone=${encodeURIComponent(targetPhone)}`, {
        method: "DELETE",
        credentials: "include",
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setMessage("حذف شد");
        await load();
      } else {
        setError(json.message || "خطا در حذف");
      }
    } catch {
      setError("خطا در ارتباط با سرور");
    }
  };

  const accentBorder = accent === "red" ? "border-red-500/30" : "border-emerald-500/30";
  const accentBadge = accent === "red"
    ? "bg-red-500/20 text-red-200 border-red-500/30"
    : "bg-emerald-500/20 text-emerald-200 border-emerald-500/30";
  const accentBtn = accent === "red"
    ? "bg-red-500/20 border-red-500/40 hover:bg-red-500/30"
    : "bg-emerald-500/20 border-emerald-500/40 hover:bg-emerald-500/30";

  return (
    <div dir="rtl" className="space-y-6">
      {/* فرم افزودن */}
      <div className={`rounded-2xl border ${accentBorder} bg-white/5 p-5`}>
        <h2 className="text-white font-bold mb-4">افزودن به {title}</h2>
        <div className="flex flex-col gap-3">
          <input
            dir="ltr" inputMode="numeric" placeholder="09xxxxxxxxx"
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/[^\d]/g, "").slice(0, 11))}
            className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[var(--main-color)]/60"
          />
          <input
            dir="rtl" placeholder={`${noteLabel} (اختیاری)`} value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 200))}
            className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[var(--main-color)]/60"
          />
          <button
            type="button" onClick={() => handleAdd(phone, note)}
            className={`w-full py-2.5 text-sm font-bold text-white rounded-xl border transition-all ${accentBtn}`}
          >
            افزودن به {title}
          </button>
        </div>
        {error && <p className="text-[#FF6B6B] text-xs mt-3">{error}</p>}
        {message && <p className="text-[#51BB70] text-xs mt-3">{message}</p>}
      </div>

      {/* پنل پیشنهاد بلاک (تشخیص خودکار) */}
      {showSuggestions && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5">
          <h2 className="text-amber-200 font-bold mb-1">⚠️ پیشنهاد بلاک</h2>
          <p className="text-white/50 text-xs mb-3">
            شماره‌هایی که در ۲۴ ساعت گذشته ۵ بار یا بیشتر فرم ارزش‌گذاری ثبت کرده‌اند
          </p>
          {suggestions.length === 0 ? (
            <p className="text-white/40 text-sm">پیشنهادی وجود ندارد</p>
          ) : (
            <div className="space-y-2">
              {suggestions.map((s) => (
                <div key={s.phone} className="flex items-center justify-between gap-3 rounded-xl bg-white/5 border border-white/10 px-4 py-2.5">
                  <div>
                    <p className="text-white font-bold text-sm" dir="ltr">{s.phone}</p>
                    <p className="text-amber-200/80 text-xs">{s.count} ارسال در ۲۴ ساعت گذشته</p>
                  </div>
                  <button
                    type="button" onClick={() => handleAdd(s.phone, `auto: ${s.count}x/24h`)}
                    className="shrink-0 px-4 py-1.5 text-xs font-bold text-white bg-red-500/20 border border-red-500/40 rounded-lg hover:bg-red-500/30 transition-all"
                  >
                    بلاک
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* لیست */}
      <div className={`rounded-2xl border ${accentBorder} bg-white/5 p-5`}>
        <h2 className="text-white font-bold mb-4">
          {title} <span className="text-white/50 text-sm">({items.length} شماره)</span>
        </h2>
        {loading ? (
          <p className="text-white/50 text-sm">در حال بارگذاری...</p>
        ) : items.length === 0 ? (
          <p className="text-white/40 text-sm">{title} خالی است</p>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl bg-white/5 border border-white/10 px-4 py-2.5">
                <div className="min-w-0">
                  <p className="text-white font-bold text-sm" dir="ltr">{item.phone}</p>
                  {(item.reason || item.note) && (
                    <p className="text-white/50 text-xs truncate">{item.reason || item.note}</p>
                  )}
                  <p className="text-white/40 text-[11px]">
                    {new Date(item.createdAt).toLocaleDateString("fa-IR")}
                  </p>
                </div>
                <span className={`shrink-0 px-2 py-0.5 text-[11px] rounded-lg border ${accentBadge}`}>
                  {accent === "red" ? "بلاک" : "مطمئن"}
                </span>
                <button
                  type="button" onClick={() => handleRemove(item.phone)}
                  className="shrink-0 px-3 py-1.5 text-xs font-bold text-red-200 bg-red-500/10 border border-red-500/30 rounded-lg hover:bg-red-500/20 transition-all"
                >
                  حذف
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
