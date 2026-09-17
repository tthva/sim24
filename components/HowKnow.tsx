"use client";
import { useState, useRef, useEffect } from "react";
import FieldSet from "./FieldSet";

// آیتم "روش‌های دیگر" به لیست اضافه شد تا در منو قابل انتخاب باشد
const ops = [
  "اینستاگرام",
  "تلگرام",
  "بله",
  "سایت",
  "نمایندگی‌ها",
  "نماینده‌ها",
  "مشتریان قبلی",
  "بیلبوردهای شهری",
  "دوستان و آشنایان",
  "ایتا",
  "آپارات",
  "دیوار",
  "دفتر مرکزی",
  "سمینار/ایونت ها",
  "روش‌های دیگر",
];

export default function HowKnow({
  val,
  onChange,
  forceError,
}: {
  val: string;
  onChange: (v: string) => void;
  forceError?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [showOther, setShowOther] = useState(false);
  const [otherVal, setOtherVal] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);

  const hasErr = forceError && !val;

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const handleSelect = (v: string) => {
    if (v === "روش‌های دیگر") {
      setShowOther(true);
      onChange(v);
    } else {
      setShowOther(false);
      setOtherVal(""); // پاک کردن مقدار روش دیگر در صورت تغییر انتخاب
      onChange(v);
    }
    setOpen(false);
  };

  return (
    <div
      className="flex flex-col gap-3 font-[Vazirmatn,sans-serif]"
      ref={wrapRef}
    >
      <div className="relative w-full">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          dir="rtl"
          className={`w-full h-12 flex items-center justify-between px-4 text-sm cursor-pointer text-right rounded-lg outline-none transition-colors
            ${hasErr ? "border-[1.5px] border-[#ef4444]" : "border border-[#88FFA4]"}
            bg-transparent shadow-[inset_0_0_15px_rgba(217,217,217,0.25)]
            ${val ? "text-white" : "text-[#aaa]"}
          `}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke={open ? "#88FFA4" : "#aaa"}
            strokeWidth="2"
            className={`transition-transform duration-200 flex-shrink-0 ${open ? "rotate-180" : "rotate-0"}`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
          <span className="flex-1 text-right">
            {val || "چطور با ما آشنا شدید؟"}
          </span>
        </button>

        {open && (
          <div
            dir="rtl"
            className="absolute bottom-full right-0 left-0 z-[200] mb-1.5 overflow-hidden rounded-xl border-[1.5px] border-[#88FFA4]/40 bg-gradient-to-b from-[#1c3968] to-[#11223d] shadow-[0_-8px_32px_rgba(0,0,0,0.6)]
            
            // کنترل ارتفاع و اسکرول بار نوین
            max-h-[50vh] overflow-y-auto 
            [&::-webkit-scrollbar]:w-1.5
            [&::-webkit-scrollbar-track]:bg-white/5 [&::-webkit-scrollbar-track]:rounded-lg
            [&::-webkit-scrollbar-thumb]:bg-gradient-to-b [&::-webkit-scrollbar-thumb]:from-[#51BB70] [&::-webkit-scrollbar-thumb]:to-[#88FFA4] [&::-webkit-scrollbar-thumb]:rounded-lg
            "
          >
            {ops.map((o, i) => (
              <button
                key={o}
                type="button"
                onClick={() => handleSelect(o)}
                className={`block w-full py-3 px-4 text-right cursor-pointer text-sm transition-colors duration-150
                  ${val === o ? "text-[#51BB70] bg-[#51BB70]/10 font-bold" : "text-white hover:bg-white/5 font-normal"}
                  ${i < ops.length - 1 ? "border-b border-white/[0.07]" : ""}
                `}
              >
                {o}
              </button>
            ))}
          </div>
        )}

        {hasErr && (
          <div className="text-[#FF6B6B] text-xs text-right mt-1" dir="rtl">
            این فیلد اجباری است
          </div>
        )}
      </div>
    </div>
  );
}
