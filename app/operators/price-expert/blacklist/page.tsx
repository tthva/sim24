"use client";

export const dynamic = "force-dynamic";

import PhoneListManager from "@/components/PhoneListManager";

export default function BlacklistPage() {
  return (
    <div dir="rtl" className="min-h-screen text-white bg-[linear-gradient(180deg,var(--main-color)_0%,var(--secondary-color)_100%)]">
      <div className="max-w-3xl mx-auto px-4 pb-10 pt-6">
        <a
          href="/operators/price-expert"
          className="inline-flex items-center gap-1 text-white/60 text-sm mb-4 hover:text-white transition-colors"
        >
          → بازگشت به داشبورد
        </a>
        <h1 className="text-2xl font-bold mb-1">بلک‌لیست</h1>
        <p className="text-white/60 text-sm mb-6">
          شماره‌های مسدود — فرم‌های ارزش‌گذاری این شماره‌ها با نشان 🔴 بلاک‌شده مشخص می‌شوند
        </p>
        <PhoneListManager
          title="بلک‌لیست"
          endpoint="/api/price-expert/blacklist"
          accent="red"
          noteLabel="دلیل بلاک"
          showSuggestions={true}
        />
      </div>
    </div>
  );
}
