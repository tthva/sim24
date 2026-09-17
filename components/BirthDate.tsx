"use client";
import FieldSet from "./FieldSet";

// تبدیل ارقام فارسی به انگلیسی (۰-۹ → 0-9)
const toE = (s: string) =>
  s.replace(/[۰-۹]/g, (d) => (d.charCodeAt(0) - 1776).toString());

const getPersianYear = () => {
  const faYearStr = new Date().toLocaleDateString("fa-IR", { year: "numeric" });
  return parseInt(
    faYearStr.replace(/[۰-۹]/g, (d: string) => String(d.charCodeAt(0) - 1776)),
  );
};

export function BirthDate({
  day,
  month,
  year,
  setDay,
  setMonth,
  setYear,
  error,
}: {
  day: string;
  month: string;
  year: string;
  setDay: (v: string) => void;
  setMonth: (v: string) => void;
  setYear: (v: string) => void;
  error: boolean;
}) {
  return (
    <div>
      <label
        className="text-white text-sm font-medium mb-2 block text-right"
        dir="rtl"
      >
        تاریخ تولد
      </label>
      <div className="flex gap-2 items-center justify-end" dir="rtl">
        <div className="flex-1">
          <FieldSet
            label="روز"
            value={day}
            onChange={(e) => {
              let v = toE(e.target.value).replace(/\D/g, "").slice(0, 2);
              if (Number(v) > 31) v = "31";
              setDay(v);
            }}
            onBlur={(e) => {
              // در حین تایپ پر نمی‌کنیم (پرش کرسر)؛ فقط هنگام خروج از فیلد:
              if (e.target.value.length === 1) {
                setDay("0" + e.target.value);
              }
            }}
            error={error && !day}
            dir="rtl"
          />
        </div>
        <span className="text-white/60 font-bold">/</span>
        <div className="flex-1">
          <FieldSet
            label="ماه"
            value={month}
            onChange={(e) => {
              let v = toE(e.target.value).replace(/\D/g, "").slice(0, 2);
              if (Number(v) > 12) v = "12";
              setMonth(v);
            }}
            onBlur={(e) => {
              // همان منطق روز: صفرگذاری فقط هنگام blur
              if (e.target.value.length === 1) {
                setMonth("0" + e.target.value);
              }
            }}
            error={error && !month}
            dir="rtl"
          />
        </div>
        <span className="text-white/60 font-bold">/</span>
        <div className="flex-1" style={{ minWidth: 80 }}>
          <FieldSet
            label="سال"
            value={year}
            onChange={(e) => {
              let v = toE(e.target.value).replace(/\D/g, "").slice(0, 4);
              const maxYear = getPersianYear() - 17;
              if (v.length === 4) {
                if (Number(v) < 1300) v = "1300";
                if (Number(v) > maxYear) v = String(maxYear);
              }
              setYear(v);
            }}
            error={error && !year}
            dir="rtl"
          />
        </div>
      </div>
      {error && (
        <div className="text-[#FF6B6B] text-xs text-right mt-1" dir="rtl">
          تاریخ تولد اجباری است
        </div>
      )}
    </div>
  );
}
