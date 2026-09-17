"use client";

import Link from "next/link";
import Navbar from "@/components/Navbar";

type RequestItem = {
  id: string;
  title: string;
  phone: string;
  price: string;
  inventoryStatus: string;
  stage: string;
  nextStepLabel: string;
  nextHref: string;
};

const metrics = [
  { label: "در انتظار انتشار", value: "15" },
  { label: "نیازمند تأیید", value: "6" },
  { label: "در انتظار موجودی", value: "4" },
  { label: "منتشر شده", value: "52" },
];

const requests: RequestItem[] = [
  {
    id: "PM-3001",
    title: "خرید مستقیم",
    phone: "0912xxxxxxx",
    price: "85,000,000 تومان",
    inventoryStatus: "آماده انتشار",
    stage: "خرید",
    nextStepLabel: "رفتن به خرید",
    nextHref: "/agent/product-manager/buy?request=PM-3001",
  },
  {
    id: "PM-3007",
    title: "تعویض مرحله دوم",
    phone: "0938xxxxxxx",
    price: "62,000,000 تومان",
    inventoryStatus: "نیازمند بررسی",
    stage: "تعویض",
    nextStepLabel: "رفتن به تعویض",
    nextHref: "/agent/product-manager/switch?request=PM-3007",
  },
  {
    id: "PM-3012",
    title: "خرید امانی",
    phone: "0911xxxxxxx",
    price: "41,500,000 تومان",
    inventoryStatus: "در انتظار تایید",
    stage: "امانی",
    nextStepLabel: "رفتن به امانی",
    nextHref: "/agent/product-manager/escrow?request=PM-3012",
  },
];

export default function ProductManagerDashboardPage() {
  return (
    <div
      dir="rtl"
      className="min-h-screen text-white relative overflow-hidden"
      style={{
        background:
          "linear-gradient(180deg, #203253 0%, var(--secondary-color) 58%)",
      }}
    >
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-8%] right-[10%] w-[26rem] h-[26rem] rounded-full blur-[120px] opacity-15 bg-cyan-300/20" />
      </div>

      <Navbar />

      <main className="relative z-10 max-w-7xl mx-auto px-4 md:px-6 pb-10">
        <section className="mt-6 rounded-[28px] border border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl p-5 md:p-7">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs text-white/60 tracking-[0.25em] uppercase">
                Product Manager
              </p>
              <h1 className="mt-2 text-3xl md:text-4xl font-black">
                مرکز مدیریت محصول
              </h1>
              <p className="mt-2 text-sm md:text-base text-white/75 max-w-2xl leading-7">
                کنترل موجودی، بررسی مراحل انتشار، و هدایت درخواست‌ها به خرید،
                فروش، تعویض یا امانی در یک محیط ساخت‌یافته.
              </p>
            </div>

            <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3">
              <p className="text-xs text-cyan-100/70">پوشش بازار</p>
              <p className="text-lg font-bold text-cyan-100">86%</p>
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
                  placeholder="جستجو بر اساس کد، شماره یا مرحله"
                />
                <select className="h-12 rounded-2xl border border-white/10 bg-black/10 px-4 text-sm outline-none">
                  <option>همه مراحل</option>
                  <option>خرید</option>
                  <option>فروش</option>
                  <option>تعویض</option>
                  <option>امانی</option>
                </select>
                <select className="h-12 rounded-2xl border border-white/10 bg-black/10 px-4 text-sm outline-none">
                  <option>همه وضعیت‌ها</option>
                  <option>آماده انتشار</option>
                  <option>نیازمند بررسی</option>
                  <option>در انتظار تایید</option>
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
                          <span className="inline-flex rounded-full border border-cyan-500/25 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-100">
                            {req.stage}
                          </span>
                          <span className="inline-flex rounded-full border border-white/10 bg-white/8 px-3 py-1 text-xs text-white/80">
                            {req.inventoryStatus}
                          </span>
                        </div>

                        <h2 className="mt-3 text-xl md:text-2xl font-bold">
                          {req.title}
                        </h2>
                        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-white/75">
                          <p>شماره: {req.phone}</p>
                          <p>قیمت: {req.price}</p>
                          <p>وضعیت موجودی: {req.inventoryStatus}</p>
                          <p>آماده برای مرحله بعد</p>
                        </div>

                        <div className="mt-5 rounded-2xl border border-white/10 bg-black/10 p-4">
                          <div className="flex items-center justify-between text-xs text-white/55 mb-3">
                            <span>خط انتشار</span>
                            <span>تایید → ثبت → نمایش</span>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <div className="rounded-2xl border border-cyan-500/25 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-100">
                              تایید
                            </div>
                            <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
                              ثبت
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/70">
                              نمایش
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-row lg:flex-col gap-3 lg:min-w-[220px]">
                        <Link
                          href={req.nextHref}
                          className="inline-flex flex-1 items-center justify-center rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-bold text-slate-950 hover:opacity-90 transition"
                        >
                          {req.nextStepLabel}
                        </Link>
                        <button className="inline-flex flex-1 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white/85 hover:bg-white/10 transition">
                          مدیریت پرونده
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>

            <aside className="space-y-4">
              <div className="rounded-[26px] border border-white/10 bg-white/5 backdrop-blur-md p-5">
                <p className="text-sm text-white/60">وضعیت محصول</p>
                <h3 className="mt-2 text-xl font-bold">کنترل موجودی</h3>
                <div className="mt-5 space-y-3 text-sm">
                  <div className="flex items-center justify-between rounded-2xl bg-black/10 px-4 py-3">
                    <span className="text-white/70">آماده انتشار</span>
                    <strong>15</strong>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl bg-black/10 px-4 py-3">
                    <span className="text-white/70">در انتظار تایید</span>
                    <strong>6</strong>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl bg-black/10 px-4 py-3">
                    <span className="text-white/70">نیازمند بازبینی</span>
                    <strong>4</strong>
                  </div>
                </div>
              </div>

              <div className="rounded-[26px] border border-white/10 bg-white/5 backdrop-blur-md p-5">
                <p className="text-sm text-white/60">مقاصد رایج</p>
                <div className="mt-4 grid gap-3">
                  <Link
                    href="/agent/product-manager/buy"
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium hover:bg-white/10 transition"
                  >
                    خرید
                  </Link>
                  <Link
                    href="/agent/product-manager/sell"
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium hover:bg-white/10 transition"
                  >
                    فروش
                  </Link>
                  <Link
                    href="/agent/product-manager/f-switch"
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium hover:bg-white/10 transition"
                  >
                    تعویض مرحله ۴
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
