"use client";

export const dynamic = "force-dynamic";

import PhoneListManager from "@/components/PhoneListManager";

export default function WhitelistPage() {
  return (
    <div dir="rtl" className="min-h-screen text-white bg-[linear-gradient(180deg,var(--main-color)_0%,var(--secondary-color)_100%)]">
      <div className="max-w-3xl mx-auto px-4 pb-10 pt-6">
        <a
          href="/operators/price-expert"
          className="inline-flex items-center gap-1 text-white/60 text-sm mb-4 hover:text-white transition-colors"
        >
          → بازگشت به داشبورد
        </a>
        <h1 className="text-2xl font-bold mb-1">وایت‌لیست</h1>
        <p className="text-white/60 text-sm mb-6">
          شماره‌های مطمئن — از بررسی تکرار معاف هستند و با نشان 🟢 مشخص می‌شوند
        </p>
        <PhoneListManager
          title="وایت‌لیست"
          endpoint="/api/price-expert/whitelist"
          accent="green"
          noteLabel="یادداشت"
          showSuggestions={false}
        />
      </div>
    </div>
  );
}
