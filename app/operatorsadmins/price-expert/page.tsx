"use client";

import Link from "next/link";
import Navbar from "@/components/Navbar";

type RequestItem = {
  id: string;
  title: string;
  phone: string;
  currentPrice: string;
  suggestedPrice: string;
  status: string;
  stage: string;
  nextStepLabel: string;
  nextHref: string;
};

const metrics = [
  { label: "در انتظار ارزش‌گذاری", value: "21" },
  { label: "امروز نهایی شده", value: "14" },
  { label: "نیازمند بازبینی", value: "6" },
  { label: "اختلاف قیمت بالا", value: "3" },
];

const requests: RequestItem[] = [
  {
    id: "PX-2041",
    title: "فروش خط 0912",
    phone: "0912xxxxxxx",
    currentPrice: "82,000,000 تومان",
    suggestedPrice: "86,500,000 تومان",
    status: "نیازمند قیمت",
    stage: "فروش",
    nextStepLabel: "ارسال به فروش",
    nextHref: "/agent/sell-manager/sell?request=PX-2041",
  },
  {
    id: "PX-2049",
    title: "تعویض شماره رند",
    phone: "0937xxxxxxx",
    currentPrice: "54,000,000 تومان",
    suggestedPrice: "51,000,000 تومان",
    status: "نیازمند تصمیم",
    stage: "تعویض",
    nextStepLabel: "ارسال به تعویض",
    nextHref: "/agent/product-manager/switch?request=PX-2049",
  },
  {
    id: "PX-2058",
    title: "خرید امانی",
    phone: "0911xxxxxxx",
    currentPrice: "31,000,000 تومان",
    suggestedPrice: "35,000,000 تومان",
    status: "در انتظار تایید",
    stage: "امانی",
    nextStepLabel: "ارسال به امانی",
    nextHref: "/agent/sell-manager/escrow?request=PX-2058",
  },
];

export default function PriceExpertDashboardPage() {
  return (
    <div
      dir="rtl"
      className="min-h-screen text-white relative overflow-hidden"
      style={{
        background:
          "linear-gradient(180deg, #2a3c5f 0%, var(--secondary-color) 58%)",
      }}
    >
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-8%] left-[-8%] w-[26rem] h-[26rem] rounded-full blur-[120px] opacity-15 bg-amber-300/20" />
      </div>

      <Navbar />

      <main className="relative z-10 max-w-7xl mx-auto px-4 md:px-6 pb-10">
        <section className="mt-6 rounded-[28px] border border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl p-5 md:p-7">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs text-white/60 tracking-[0.25em] uppercase">
                Price Expert
              </p>
              <h1 className="mt-2 text-3xl md:text-4xl font-black">
                مرکز ارزش‌گذاری
              </h1>
              <p className="mt-2 text-sm md:text-base text-white/75 max-w-2xl leading-7">
                پرونده‌هایی که نیاز به تحلیل قیمت دارند، با تمرکز روی اختلاف
                بازار، قیمت مشتری و پیشنهاد نهایی در یک پنل تمیز و سریع.
              </p>
            </div>

            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3">
              <p className="text-xs text-amber-100/70">دقت امروز</p>
              <p className="text-lg font-bold text-amber-100">96.4%</p>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-3">
            {metrics.map((m) => (
              <div
                key={m.label}
                className="rounded-2xl border border-white/10 bg-white/5 p-4"
              >
                <p className="text-xs text-white/60">{m.label}</p>
                <p className="mt-2 text-2xl font-black">{m.value}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 grid grid-cols-1 xl:grid-cols-[1.7fr_0.9fr] gap-5">
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input
                  className="h-12 rounded-2xl border border-white/10 bg-black/10 px-4 text-sm outline-none placeholder:text-white/40"
                  placeholder="جستجو با کد، شماره یا نوع درخواست"
                />
                <select className="h-12 rounded-2xl border border-white/10 bg-black/10 px-4 text-sm outline-none">
                  <option>همه نوع‌ها</option>
                  <option>فروش</option>
                  <option>تعویض</option>
                  <option>امانی</option>
                </select>
                <select className="h-12 rounded-2xl border border-white/10 bg-black/10 px-4 text-sm outline-none">
                  <option>همه وضعیت‌ها</option>
                  <option>نیازمند قیمت</option>
                  <option>در انتظار تایید</option>
                  <option>نیازمند بازبینی</option>
                </select>
              </div>

              <div className="space-y-4">
                {requests.map((req) => (
                  <article
                    key={req.id}
                    className="rounded-[26px] border border-white/10 bg-white/6 backdrop-blur-md p-5 md:p-6 shadow-[0_12px_40px_rgba(0,0,0,0.12)] hover:border-white/20 transition-all"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[11px] tracking-[0.25em] text-white/50">
                            {req.id}
                          </span>
                          <span className="inline-flex rounded-full border border-amber-500/25 bg-amber-500/10 px-3 py-1 text-xs text-amber-100">
                            {req.stage}
                          </span>
                          <span className="inline-flex rounded-full border border-white/10 bg-white/8 px-3 py-1 text-xs text-white/80">
                            {req.status}
                          </span>
                        </div>

                        <h2 className="mt-3 text-xl md:text-2xl font-bold">
                          {req.title}
                        </h2>
                        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-white/75">
                          <p>شماره: {req.phone}</p>
                          <p>قیمت فعلی: {req.currentPrice}</p>
                          <p>پیشنهاد سیستم: {req.suggestedPrice}</p>
                          <p>وضعیت: آماده انتقال</p>
                        </div>

                        <div className="mt-5 rounded-2xl border border-white/10 bg-black/10 p-4">
                          <div className="flex items-center justify-between text-xs text-white/55 mb-3">
                            <span>خط تصمیم</span>
                            <span>تحلیل → ثبت → انتقال</span>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
                              تحلیل
                            </div>
                            <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
                              ثبت
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/70">
                              ارسال
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-row lg:flex-col gap-3 lg:min-w-[220px]">
                        <Link
                          href={req.nextHref}
                          className="inline-flex flex-1 items-center justify-center rounded-2xl bg-amber-400 px-4 py-3 text-sm font-bold text-slate-950 hover:opacity-90 transition"
                        >
                          {req.nextStepLabel}
                        </Link>
                        <button className="inline-flex flex-1 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white/85 hover:bg-white/10 transition">
                          ثبت قیمت
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>

            <aside className="space-y-4">
              <div className="rounded-[26px] border border-white/10 bg-white/5 backdrop-blur-md p-5">
                <p className="text-sm text-white/60">شاخص کنترل کیفیت</p>
                <h3 className="mt-2 text-xl font-bold">ارزش‌گذاری امروز</h3>
                <div className="mt-5 space-y-3 text-sm">
                  <div className="flex items-center justify-between rounded-2xl bg-black/10 px-4 py-3">
                    <span className="text-white/70">پرونده‌های دقیق</span>
                    <strong>18</strong>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl bg-black/10 px-4 py-3">
                    <span className="text-white/70">اختلاف بالا</span>
                    <strong>3</strong>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl bg-black/10 px-4 py-3">
                    <span className="text-white/70">در انتظار پاسخ</span>
                    <strong>6</strong>
                  </div>
                </div>
              </div>

              <div className="rounded-[26px] border border-white/10 bg-white/5 backdrop-blur-md p-5">
                <p className="text-sm text-white/60">مسیرهای بعدی</p>
                <div className="mt-4 grid gap-3">
                  <Link
                    href="/agent/sell-manager/sell"
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium hover:bg-white/10 transition"
                  >
                    انتقال به فروش
                  </Link>
                  <Link
                    href="/agent/product-manager/buy"
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium hover:bg-white/10 transition"
                  >
                    انتقال به خرید
                  </Link>
                  <Link
                    href="/agent/sell-manager/escrow"
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium hover:bg-white/10 transition"
                  >
                    انتقال به امانی
                  </Link>
                </div>
              </div>
            </aside>
          </div>
        </section>
      </main>
    </div>
  );
}
