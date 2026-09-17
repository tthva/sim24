"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import Navbar from "@/components/Navbar";
import { useTaskNotifications } from "@/hooks/useTaskNotifications";

export interface CategoryItem {
  title: string;
  count: number;
  href: string;
}

export interface WorkItem {
  id: string;
  title: string;
  section: string;
  status: string;
  phone: string;
  date: string;
  href: string;
  // اطلاعات تکمیلی برای نمایش در جزئیات (آیتم امانی)
  owner?: string;
  duration?: number | null;
  daysLeft?: number | null;
}

interface AgentDashboardProps {
  title: string;
  categories: CategoryItem[];
  works: WorkItem[];
  loading?: boolean;
  error?: string | null;
  children?: React.ReactNode;
  hideWorkStats?: boolean;
}

export default function AgentDashboard({
  title,
  categories,
  works,
  loading = false,
  error = null,
  children,
  hideWorkStats = false,
}: AgentDashboardProps) {
  const [open, setOpen] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "waiting" | "inprogress">("all");
  const worksRef = useRef<HTMLDivElement>(null);
  // اعلان بلادرنگ تسک جدید (نوتیفیکیشن + صدا) — با کلید سایلنت در هدر
  const { silent, toggleSilent } = useTaskNotifications();

  useEffect(() => {
    if (activeCategory && worksRef.current) {
      worksRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [activeCategory]);

  const handleCategoryClick = (catTitle: string) => {
    if (activeCategory === catTitle) {
      setActiveCategory(null);
    } else {
      setActiveCategory(catTitle);
      setOpen(null);
    }
  };

  const filteredWorks = works
    .filter((work) => (activeCategory ? work.section === activeCategory : true))
    .filter((work) => {
      // prefix match: IN_PROGRESS items carry a stage suffix, e.g. "در حال بررسی (مذاکره ✓)"
      if (filter === "waiting") return work.status === "در انتظار";
      if (filter === "inprogress") return work.status.startsWith("در حال بررسی");
      return true;
    });

// رنگ نشانگر وضعیت بر اساس متن (وضعیت انقضا رنگی، بقیه آبی)
const statusStyle = (status: string): string => {
  if (status === "منقضی شده") return "bg-red-500/20 text-red-200 border-red-500/30";
  if (status === "در آستانه انقضا") return "bg-amber-500/20 text-amber-200 border-amber-500/30";
  if (status === "فعال") return "bg-green-500/20 text-green-200 border-green-500/30";
  if (status === "نامشخص") return "bg-white/10 text-white/70 border-white/20";
  return "bg-blue-500/20 text-blue-200 border-blue-500/20";
};

  // آمارها فقط بر اساس فیلتر دسته‌بندی فعال محاسبه می‌شوند، نه همه کارها
  const filteredByCategory = activeCategory
    ? works.filter((w) => w.section === activeCategory)
    : works;
  const waitingCount = filteredByCategory.filter((w) => w.status === "در انتظار").length;
  const inProgressCount = filteredByCategory.filter((w) => w.status.startsWith("در حال بررسی")).length;

  const handleFilterClick = (next: "all" | "waiting" | "inprogress") => {
    setFilter((prev) => (prev === next ? "all" : next));
    setOpen(null);
  };

  return (
    <div
      dir="rtl"
      className="min-h-screen text-white bg-[linear-gradient(180deg,var(--main-color)_0%,var(--secondary-color)_100%)]"
    >
      <Navbar />

      <div className="max-w-5xl mx-auto px-4 pb-10">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl mb-2">{title}</h1>
            <p className="text-white/60 text-sm">
              مدیریت درخواست‌ها و انتقال به مرحله بعد
            </p>
          </div>
          {/* کلید سایلنت اعلان تسک جدید */}
          <button
            type="button"
            onClick={toggleSilent}
            title={silent ? "اعلان صدا خاموش است — برای فعال‌سازی کلیک کنید" : "اعلان صدا روشن است — برای خاموش‌کردن کلیک کنید"}
            className={`shrink-0 w-11 h-11 rounded-full flex items-center justify-center text-xl border transition-all duration-200 active:scale-95 ${
              silent
                ? "bg-white/5 border-white/15 text-white/50"
                : "bg-[var(--main-color)]/25 border-[var(--main-color)]/50 text-white shadow-[0_0_15px_rgba(81,187,112,0.25)]"
            }`}
          >
            {silent ? "🔕" : "🔔"}
          </button>
        </div>

        {/* Search Input (passed as children from page) */}
        {children}

        {/* Categories Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
          {categories.map((item) => (
            <button
              key={item.title}
              type="button"
              onClick={() => handleCategoryClick(item.title)}
              className={`group rounded-2xl border backdrop-blur-md px-5 py-4 transition-all duration-300 text-right ${
                activeCategory === item.title
                  ? "bg-green-500/20 border-green-400 shadow-[0_0_15px_rgba(74,222,128,0.15)]"
                  : "bg-white/5 border-green-500/30 hover:bg-green-500/10 hover:border-green-400/60"
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`font-medium transition-colors ${
                    activeCategory === item.title
                      ? "text-green-300"
                      : "text-white"
                  }`}
                >
                  {item.title}
                </span>

                {/* BADGE LOGIC: Only renders if count is strictly greater than 0 */}
                {item.count > 0 && (
                  <span
                    className={`min-w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center transition-all duration-300 ${
                      activeCategory === item.title
                        ? "bg-green-500 text-white border border-green-400"
                        : "bg-green-500/20 text-green-300 border border-green-500/30"
                    }`}
                  >
                    {item.count}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>

        {/* Works Section */}
        <div ref={worksRef} className="scroll-mt-24">
          <div className="mb-4 flex items-center gap-4">
            <h2 className="font-bold text-lg">
              {activeCategory
                ? `کارهای فعال: ${activeCategory}`
                : "کارهای فعال"}
            </h2>

            {!hideWorkStats && (
              <>
                <button
                  type="button"
                  onClick={() => handleFilterClick("waiting")}
                  className={`text-xs px-4 py-2 rounded-xl transition-all border ${
                    filter === "waiting"
                      ? "bg-green-500/20 border-green-400 text-green-300 shadow-[0_0_15px_rgba(74,222,128,0.15)]"
                      : "bg-white/10 hover:bg-white/20 text-white/80 hover:text-white border-white/10"
                  }`}
                >
                  کارهای بررسی نشده: {waitingCount}
                </button>

                <button
                  type="button"
                  onClick={() => handleFilterClick("inprogress")}
                  className={`text-xs px-4 py-2 rounded-xl transition-all border ${
                    filter === "inprogress"
                      ? "bg-blue-500/20 border-blue-400 text-blue-200 shadow-[0_0_15px_rgba(96,165,250,0.15)]"
                      : "bg-white/10 hover:bg-white/20 text-white/80 hover:text-white border-white/10"
                  }`}
                >
                 کارهای در حال انجام: {inProgressCount}
                </button>
              </>
            )}

            {activeCategory && (
              <button
                type="button"
                onClick={() => {
                  setActiveCategory(null);
                  setOpen(null);
                }}
                className="text-xs px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-all border border-white/10"
              >
                نمایش همه
              </button>
            )}
          </div>

          <div className="space-y-4">
            {loading ? (
              <div className="text-center py-12 border border-dashed border-white/10 rounded-3xl bg-white/5">
                <p className="text-white/70">در حال بارگذاری...</p>
              </div>
            ) : error ? (
              <div className="text-center py-12 border border-dashed border-red-500/30 rounded-3xl bg-red-500/5">
                <p className="text-red-200">خطا در دریافت تسک‌ها</p>
              </div>
            ) : filteredWorks.length > 0 ? (
              filteredWorks.map((work) => (
                <div
                  key={work.id}
                  className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-md overflow-hidden transition-all duration-500 ease-in-out"
                >
                  <button
                    type="button"
                    onClick={() => setOpen(open === work.id ? null : work.id)}
                    className="w-full text-right p-5 hover:bg-white/5 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-bold text-lg ">{work.title}</h3>

                        <div className="flex gap-2 mt-2">
                          <span className="text-xs px-3 py-1 rounded-full bg-white/10 text-white/80 border border-white/5">
                            {work.section}
                          </span>

                          <span className={`text-xs px-3 py-1 rounded-full border ${statusStyle(work.status)}`}>
                            {work.status}
                          </span>
                        </div>
                      </div>

                      <svg
                        className={`w-5 h-5 text-white/60 transition-transform duration-300 ${
                          open === work.id ? "rotate-180" : ""
                        }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeWidth={2}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </div>
                  </button>

                  {open === work.id && (
                    <div className="border-t border-white/10 p-5 bg-black/10">
                      <div className="grid md:grid-cols-2 gap-4 mb-5">
                        <div>
                          <p className="text-white/50 text-xs mb-1">
                            شماره تماس
                          </p>
                          <p className="font-medium tracking-wider">
                            {work.phone}
                          </p>
                        </div>

                        <div>
                          <p className="text-white/50 text-xs mb-1">
                            تاریخ ثبت
                          </p>
                          <p className="font-medium">{work.date}</p>
                        </div>

                        <div>
                          <p className="text-white/50 text-xs mb-1">بخش</p>
                          <p className="font-medium">{work.section}</p>
                        </div>

                        <div>
                          <p className="text-white/50 text-xs mb-1">وضعیت</p>
                          <p className={`font-medium ${work.status === "منقضی شده" ? "text-red-200" : work.status === "در آستانه انقضا" ? "text-amber-200" : work.status === "فعال" ? "text-green-200" : "text-blue-200"}`}>
                            {work.status}
                          </p>
                        </div>
                        {work.owner && (
                          <div>
                            <p className="text-white/50 text-xs mb-1">مالک</p>
                            <p className="font-medium">{work.owner}</p>
                          </div>
                        )}
                        {(work.duration != null || work.daysLeft != null) && (
                          <div>
                            <p className="text-white/50 text-xs mb-1">مدت / باقی‌مانده</p>
                            <p className="font-medium">
                              {work.duration != null ? `${work.duration} روز` : "—"}
                              {work.daysLeft != null ? ` · ${work.daysLeft >= 0 ? work.daysLeft + " روز باقی" : Math.abs(work.daysLeft) + " روز گذشته"}` : ""}
                            </p>
                          </div>
                        )}
                      </div>

                      <Link
                        href={work.href}
                        className="inline-flex w-full md:w-auto items-center justify-center h-12 px-8 rounded-2xl bg-green-500 text-white font-bold hover:bg-green-400 transition-colors shadow-lg shadow-green-500/20"
                      >
                        ورود به پرونده
                      </Link>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="text-center py-12 border border-dashed border-white/10 rounded-3xl bg-white/5">
                <p className="text-white/50">تسکی برای شما وجود ندارد</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
