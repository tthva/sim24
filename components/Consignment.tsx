"use client";
import { useState, useEffect } from "react";
import { provinces, getCitiesOfProvince } from "@/lib/iranData";
import FieldSet from "@/components/FieldSet";
import AutocompleteField from "@/components/AutocompleteField";
import HowKnow from "@/components/HowKnow";
import TimeLine from "@/components/TimeLine";
import { onlyPersian, clampDay, clampMonth, isValid0912 } from "@/lib/form-validators";

type Own = "self" | "other";
type Cond = "new" | "used";

const toE = (s: string) =>
  s.replace(/[۰-۹]/g, (d) => (d.charCodeAt(0) - 1776).toString());
const isMobile = (v: string) => /^09\d{9}$/.test(toE(v));

const getPersianYear = () => {
  const faYearStr = new Date().toLocaleDateString("fa-IR", { year: "numeric" });
  return parseInt(
    faYearStr.replace(/[۰-۹]/g, (d: string) => String(d.charCodeAt(0) - 1776)),
  );
};

const formatPrice = (value: string) => {
  if (!value) return "";
  return value.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

interface Props {
  submitted: boolean;
  onFieldChange?: (field: string, value: any) => void;
  initialData?: Record<string, any>;
}

export default function Consignment({ submitted, onFieldChange, initialData }: Props) {
  const [nm, setNm] = useState(initialData?.nm ?? "");
  const [fm, setFm] = useState(initialData?.fm ?? "");
  const [ph, setPh] = useState(initialData?.ph ?? "");
  const [prov, setProv] = useState<number | "">(initialData?.prov ?? "");
  const [city, setCity] = useState<number | "">(initialData?.city ?? "");
  const [sph, setSph] = useState(initialData?.sph ?? "");
  const [price, setPrice] = useState(initialData?.price ?? "");
  const [duration, setDuration] = useState(initialData?.duration ?? "");
  const [hk, setHk] = useState(initialData?.hk ?? "");
  const [own, setOwn] = useState<Own>(initialData?.own ?? "other");
  const [cond, setCond] = useState<Cond>(initialData?.cond ?? "used");
  const [birthDay, setBirthDay] = useState(initialData?.birthDay ?? "");
  const [birthMonth, setBirthMonth] = useState(initialData?.birthMonth ?? "");
  const [birthYear, setBirthYear] = useState(initialData?.birthYear ?? "");

  // Sync internal state when initialData changes (e.g., on refresh restore)
  useEffect(() => {
    if (initialData) {
      if (initialData.nm !== undefined) setNm(initialData.nm);
      if (initialData.fm !== undefined) setFm(initialData.fm);
      if (initialData.ph !== undefined) setPh(initialData.ph);
      if (initialData.prov !== undefined) setProv(initialData.prov);
      if (initialData.city !== undefined) setCity(initialData.city);
      if (initialData.sph !== undefined) setSph(initialData.sph);
      if (initialData.price !== undefined) setPrice(initialData.price);
      if (initialData.duration !== undefined) setDuration(initialData.duration);
      if (initialData.hk !== undefined) setHk(initialData.hk);
      if (initialData.own !== undefined) setOwn(initialData.own);
      if (initialData.cond !== undefined) setCond(initialData.cond);
      if (initialData.birthDay !== undefined) setBirthDay(initialData.birthDay);
      if (initialData.birthMonth !== undefined) setBirthMonth(initialData.birthMonth);
      if (initialData.birthYear !== undefined) setBirthYear(initialData.birthYear);
    }
  }, [initialData]);

  const cityOptions = prov ? getCitiesOfProvince(Number(prov)) : [];
  const notify = (field: string, value: any) => onFieldChange?.(field, value);

  const nmErr = submitted && nm.trim().length < 2;
  const fmErr = submitted && fm.trim().length < 2;
  const phErr = submitted && (!ph || !isMobile(ph));
  const provErr = submitted && !prov;
  const cityErr = submitted && !city;
  const sphErr = submitted && (!sph || !isValid0912(sph));
  const priceErr = submitted && !price;
  const durationErr = submitted && !duration;
  const bdErr = submitted && (!birthDay || !birthMonth || !birthYear);

  return (
    <div className="flex flex-col gap-4">
      <div className="afu d2">
        <FieldSet
          label="نام"
          value={nm}
                    onChange={(e) => {
            const v = onlyPersian(e.target.value);
            setNm(v);
            notify("nm", v);
          }}
          error={nmErr}
          helperText={nmErr ? "این فیلد اجباری است" : undefined}
          dir="rtl"
        />
      </div>
      <div className="afu d3">
        <FieldSet
          label="نام خانوادگی"
          value={fm}
                    onChange={(e) => {
            const v = onlyPersian(e.target.value);
            setFm(v);
            notify("fm", v);
          }}
          error={fmErr}
          helperText={fmErr ? "این فیلد اجباری است" : undefined}
          dir="rtl"
        />
      </div>

      <div className="afu d3">
        <FieldSet
          label="شماره جهت ارتباط"
          type="tel"
          value={ph}
          onChange={(e) => {
            const v = toE(e.target.value).replace(/\D/g, "").slice(0, 11);
            setPh(v);
            notify("ph", v);
          }}
          error={phErr}
          helperText={
            phErr
              ? !ph
                ? "این فیلد اجباری است"
                : "شماره باید ۱۱ رقم و با ۰۹ شروع شود"
              : undefined
          }
          dir="rtl"
        />
      </div>

      <div className="flex gap-3 afu d4">
        <div className="flex-1">
          <AutocompleteField
            label="استان"
            options={provinces}
            value={prov}
            onChange={(id) => {
              setProv(id as number);
              setCity("");
              notify("prov", id);
              notify("city", "");
            }}
            error={provErr}
            helperText={provErr ? "این فیلد اجباری است" : undefined}
            openOnFocus={true}
          />
        </div>
        <div className="flex-1">
          <AutocompleteField
            label="شهر"
            options={cityOptions}
            value={city}
            onChange={(id) => {
              setCity(id as number);
              notify("city", id);
            }}
            error={cityErr}
            helperText={cityErr ? "این فیلد اجباری است" : undefined}
            disabled={!prov}
            openOnFocus={true}
            key={prov}
          />
        </div>
      </div>

      <div className="afu d4">
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
              value={birthDay}
              onChange={(e) => {
                let v = toE(e.target.value).replace(/\D/g, "").slice(0, 2);
                if (Number(v) > 31) v = "31";
                setBirthDay(v);
                notify("birthDay", v);
              }}
              onBlur={(e) => {
                // در حین تایپ پر نمی‌کنیم (پرش کرسر)؛ فقط هنگام خروج از فیلد.
                // notify هم فراخوانی می‌شود تا مقدار pad شده به والد برسد:
                if (e.target.value.length === 1) {
                  const padded = clampDay(e.target.value);
                  setBirthDay(padded);
                  notify("birthDay", padded);
                }
              }}
              error={bdErr && !birthDay}
              dir="rtl"
            />
          </div>
          <span className="text-white/60 font-bold">/</span>
          <div className="flex-1">
            <FieldSet
              label="ماه"
              value={birthMonth}
              onChange={(e) => {
                let v = toE(e.target.value).replace(/\D/g, "").slice(0, 2);
                if (Number(v) > 12) v = "12";
                setBirthMonth(v);
                notify("birthMonth", v);
              }}
              onBlur={(e) => {
                // همان منطق روز: صفرگذاری فقط هنگام blur، همراه با notify والد
                if (e.target.value.length === 1) {
                  const padded = clampMonth(e.target.value);
                  setBirthMonth(padded);
                  notify("birthMonth", padded);
                }
              }}
              error={bdErr && !birthMonth}
              dir="rtl"
            />
          </div>
          <span className="text-white/60 font-bold">/</span>
          <div className="flex-1" style={{ minWidth: 80 }}>
            <FieldSet
              label="سال"
              value={birthYear}
              onChange={(e) => {
                let v = toE(e.target.value).replace(/\D/g, "").slice(0, 4);
                const maxYear = getPersianYear() - 17;
                if (v.length === 4) {
                  if (Number(v) < 1300) v = "1300";
                  if (Number(v) > maxYear) v = String(maxYear);
                }
                setBirthYear(v);
                notify("birthYear", v);
              }}
              error={bdErr && !birthYear}
              dir="rtl"
            />
          </div>
        </div>
        {bdErr && (
          <div className="text-[#FF6B6B] text-xs text-right mt-1" dir="rtl">
            تاریخ تولد اجباری است
          </div>
        )}
      </div>

      <div className="afu d5">
        <FieldSet
          label="شماره موبایل جهت امانت"
          type="tel"
          value={sph}
          onChange={(e) => {
            const v0 = toE(e.target.value).replace(/\D/g, "").slice(0, 11);
            const ok =
              !v0 || /^0912\d{0,7}$/.test(v0) || (v0.length < 4 && "0912".startsWith(v0));
            const v = ok ? v0 : sph;
            setSph(v);
            notify("sph", v);
          }}
          error={sphErr}
          helperText={
            sphErr
              ? !sph
                ? "این فیلد اجباری است"
                : "شماره باید ۱۱ رقم و با 0912 شروع شود"
              : undefined
          }
          dir="rtl"
        />
      </div>

      <div className="afu d5 relative">
        <FieldSet
          label="قیمت مورد توافق"
          type="num"
          value={formatPrice(price)}
          onChange={(e) => {
            const v = toE(e.target.value).replace(/\D/g, "");
            setPrice(v);
            notify("price", v);
          }}
          error={priceErr}
          helperText={priceErr ? "این فیلد اجباری است" : undefined}
          dir="rtl"
        />
        {price && (
          <span
            className="absolute left-3 top-1/2 -translate-y-1/2 text-white/60 text-sm pointer-events-none select-none"
            style={{ fontFamily: "Vazirmatn, sans-serif" }}
          >
            تومان
          </span>
        )}
      </div>

      <div className="flex gap-6 items-center text-center">
        <label
          className="text-white text-sm font-medium block text-center ml-auto"
          dir="rtl"
        >
          مالک سیم کارت
        </label>
        {(
          [
            ["self", "خودم"],
            ["other", "دیگری"],
          ] as [Own, string][]
        ).map(([id, lb]) => (
          <button
            key={id}
            onClick={() => {
              setOwn(id);
              notify("own", id);
            }}
            className="flex items-center gap-2"
          >
            <span
              className={`text-sm font-medium transition-colors ${own === id ? "text-[#23E250]" : "text-white"}`}
            >
              {lb}
            </span>
            <div
              style={
                own === id
                  ? {
                      width: 24,
                      height: 24,
                      border: "2px solid #51BB70",
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      filter: "drop-shadow(0 0 4px #23E250)",
                    }
                  : {
                      width: 24,
                      height: 24,
                      border: "2px solid white",
                      borderRadius: "50%",
                    }
              }
            >
              {own === id && (
                <div
                  style={{
                    width: 14,
                    height: 14,
                    background: "#51BB70",
                    borderRadius: "50%",
                  }}
                />
              )}
            </div>
          </button>
        ))}
      </div>

      <div className="afu d5">
        <div className="flex gap-6">
          <label
            className="text-white text-sm font-medium mb-2 block text-right ml-auto"
            dir="rtl"
          >
            وضعیت سیم کارت
          </label>
          {(
            [
              ["used", "کارکرده"],
              ["new", "خشک"],
            ] as [Cond, string][]
          ).map(([id, lb]) => (
            <button
              key={id}
              onClick={() => {
                setCond(id);
                notify("cond", id);
              }}
              className="flex items-center gap-2"
            >
              <span
                className={`text-sm font-medium transition-colors ${cond === id ? "text-[#23E250]" : "text-white"}`}
              >
                {lb}
              </span>
              <div
                style={
                  cond === id
                    ? {
                        width: 24,
                        height: 24,
                        border: "2px solid #51BB70",
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        filter: "drop-shadow(0 0 4px #23E250)",
                      }
                    : {
                        width: 24,
                        height: 24,
                        border: "2px solid white",
                        borderRadius: "50%",
                      }
                }
              >
                {cond === id && (
                  <div
                    style={{
                      width: 14,
                      height: 14,
                      background: "#51BB70",
                      borderRadius: "50%",
                    }}
                  />
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="afu d6">
        <TimeLine
          val={duration}
          onChange={(v) => {
            setDuration(v);
            notify("duration", v);
          }}
          forceError={submitted}
        />
      </div>
      {durationErr && (
        <p className="text-[#FF6B6B] text-xs text-right" dir="rtl">
          این فیلد اجباری است
        </p>
      )}
      <div className="afu d6">
        <HowKnow
          val={hk}
          onChange={(v) => {
            setHk(v);
            notify("hk", v);
          }}
          forceError={submitted}
        />
      </div>
    </div>
  );
}
