"use client";

import Link from "next/link";
import Navbar from "@/components/Navbar";

type RequestItem = {
  id: string;
  title: string;
  phone: string;
  city: string;
  createdAt: string;
  status: string;
  nextStepLabel: string;
  nextHref: string;
};

const metrics = [
  { label: "درخواست‌های جدید", value: "34" },
  { label: "در حال پیگیری", value: "11" },
  { label: "در انتظار مشتری", value: "9" },
  { label: "تکمیل شده", value: "20" },
];

const requests: RequestItem[] = [
  {
    id: "SM-5001",
    title: "درخواست فروش",
    phone: "0912xxxxxxx",
    city: "تهران",
    createdAt: "1405/03/18",
    status: "جدید",
    nextStepLabel: "شروع بررسی",
    nextHref: "/agent/sell-manager/sell?request=SM-5001",
  },
  {
    id: "SM-5008",
    title: "درخواست خرید",
    phone: "0935xxxxxxx",
    city: "مشهد",
    createdAt: "1405/03/17",
    status: "در انتظار تماس",
    nextStepLabel: "رفتن به خرید",
    nextHref: "/agent/sell-manager/buy?request=SM-5008",
  },
  {
    id: "SM-5016",
    title: "درخواست پیش‌سفارش",
    phone: "0911xxxxxxx",
    city: "اصفهان",
    createdAt: "1405/03/16",
    status: "نیازمند اقدام",
    nextStepLabel: "رفتن به پیش‌سفارش",
    nextHref: "/agent/sell-manager/preorder?request=SM-5016",
  },
];

export default function SellManagerDashboardPage() {
  return (
    <div
      dir="rtl"
      className="min-h-screen text-white relative overflow-hidden"
      style={{
        background:
          "linear-gradient(180deg, #233d61 0%, var(--secondary-color) 58%)",
      }}
    >
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute bottom-[-10%] right-[-10%] w-[28rem] h-[28rem] rounded-full blur-[130px] opacity-15 bg-violet-300/15" />
      </div>

      <Navbar />

      <main className="relative z-10 max-w-7xl mx-auto px-4 md:px-6 pb-10">
        <section className="mt-6 rounded-[28px] border border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl p-5 md:p-7">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs text-white/60 tracking-[0.25em] uppercase">
                Sell Manager
              </p>
              <h1 className="mt-2 text-3xl md:text-4xl font-black">
                مرکز مدیریت فروش
              </h1>
              <p className="mt-2 text-sm md:text-base text-white/75 max-w-2xl leading-7">
                نقطه شروع پرونده‌ها برای پیگیری فروش، خرید، پیش‌سفارش، تعویض و
                امانی؛ مرتب، سریع و مناسب برای کار روزانه.
              </p>
            </div>

            <div className="rounded-2xl border border-violet-500/20 bg-violet-500/10 px-4 py-3">
              <p className="text-xs text-violet-100/70">نرخ تکمیل</p>
              <p className="text-lg font-bold text-violet-100">91%</p>
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
                  placeholder="جستجو با شماره، شهر یا کد پرونده"
                />
                <select className="h-12 rounded-2xl border border-white/10 bg-black/10 px-4 text-sm outline-none">
                  <option>همه انواع</option>
                  <option>فروش</option>
                  <option>خرید</option>
                  <option>پیش‌سفارش</option>
                  <option>تعویض</option>
                  <option>امانی</option>
                </select>
                <select className="h-12 rounded-2xl border border-white/10 bg-black/10 px-4 text-sm outline-none">
                  <option>همه وضعیت‌ها</option>
                  <option>جدید</option>
                  <option>در انتظار تماس</option>
                  <option>نیازمند اقدام</option>
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
                          <span className="inline-flex rounded-full border border-violet-500/25 bg-violet-500/10 px-3 py-1 text-xs text-violet-100">
                            {req.status}
                          </span>
                        </div>

                        <h2 className="mt-3 text-xl md:text-2xl font-bold">
                          {req.title}
                        </h2>
                        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-white/75">
                          <p>شماره: {req.phone}</p>
                          <p>شهر: {req.city}</p>
                          <p>ثبت شده: {req.createdAt}</p>
                          <p>نیازمند بررسی مرحله‌ای</p>
                        </div>

                        <div className="mt-5 rounded-2xl border border-white/10 bg-black/10 p-4">
                          <div className="flex items-center justify-between text-xs text-white/55 mb-3">
                            <span>خط عملیات</span>
                            <span>ثبت → پیگیری → انتقال</span>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <div className="rounded-2xl border border-violet-500/25 bg-violet-500/10 px-3 py-2 text-sm text-violet-100">
                              ثبت
                            </div>
                            <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
                              پیگیری
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/70">
                              انتقال
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-row lg:flex-col gap-3 lg:min-w-[220px]">
                        <Link
                          href={req.nextHref}
                          className="inline-flex flex-1 items-center justify-center rounded-2xl bg-violet-400 px-4 py-3 text-sm font-bold text-slate-950 hover:opacity-90 transition"
                        >
                          {req.nextStepLabel}
                        </Link>
                        <button className="inline-flex flex-1 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white/85 hover:bg-white/10 transition">
                          مشاهده درخواست
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>

            <aside className="space-y-4">
              <div className="rounded-[26px] border border-white/10 bg-white/5 backdrop-blur-md p-5">
                <p className="text-sm text-white/60">مرکز فرمان</p>
                <h3 className="mt-2 text-xl font-bold">وظایف امروز</h3>
                <div className="mt-5 space-y-3 text-sm">
                  <div className="flex items-center justify-between rounded-2xl bg-black/10 px-4 py-3">
                    <span className="text-white/70">نیازمند تماس</span>
                    <strong>9</strong>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl bg-black/10 px-4 py-3">
                    <span className="text-white/70">در انتظار پاسخ</span>
                    <strong>11</strong>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl bg-black/10 px-4 py-3">
                    <span className="text-white/70">تکمیل شده</span>
                    <strong>20</strong>
                  </div>
                </div>
              </div>

              <div className="rounded-[26px] border border-white/10 bg-white/5 backdrop-blur-md p-5">
                <p className="text-sm text-white/60">دسترسی سریع</p>
                <div className="mt-4 grid gap-3">
                  <Link
                    href="/agent/sell-manager/buy"
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium hover:bg-white/10 transition"
                  >
                    خرید
                  </Link>
                  <Link
                    href="/agent/sell-manager/sell"
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium hover:bg-white/10 transition"
                  >
                    فروش
                  </Link>
                  <Link
                    href="/agent/sell-manager/preorder"
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium hover:bg-white/10 transition"
                  >
                    پیش‌سفارش
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
