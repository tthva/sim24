"use client";
import FieldSet from "./FieldSet";
import HowKnow from "./HowKnow";
import AutocompleteField from "./AutocompleteField";
import { RadioButtons } from "./RadioButtons";
import { BirthDate } from "./BirthDate";

// تبدیل ارقام فارسی به انگلیسی (۰-۹ → 0-9)
const toE = (s: string) =>
  s.replace(/[۰-۹]/g, (d) => (d.charCodeAt(0) - 1776).toString());
import { onlyPersian, digits, isValid0912 } from "@/lib/form-validators";

type Cond = "new" | "used";
type Own = "self" | "other";

interface MarketSwapFormProps {
  submitted: boolean;
  mNm: string;
  mFm: string;
  mPh: string;
  mProv: number | "";
  mCity: number | "";
  mBD: string;
  mBM: string;
  mBY: string;
  mPrice: string;
  mSimPh: string;
  mDesPh: string;
  mOwn: Own;
  mCond: Cond;
  mHk: string;
  mCities: any[];
  provinces: any[];
  setMNm: (v: string) => void;
  setMFm: (v: string) => void;
  setMPh: (v: string) => void;
  setMProv: (v: number | "") => void;
  setMCity: (v: number | "") => void;
  setMBD: (v: string) => void;
  setMBM: (v: string) => void;
  setMBY: (v: string) => void;
  setMPrice: (v: string) => void;
  setMSimPh: (v: string) => void;
  setMDesPh: (v: string) => void;
  setMOwn: (v: Own) => void;
  setMCond: (v: Cond) => void;
  setMHk: (v: string) => void;
  mNmE: boolean;
  mFmE: boolean;
  mPhE: boolean;
  mPrE: boolean;
  mCiE: boolean;
  mPriceE: boolean;
  mSimPhE: boolean;
  mDesPhE: boolean;
  mHkE: boolean;
  mBdE: boolean;
  isMobile: (v: string) => boolean;
  formatPrice: (val: string) => string;
}

export default function MarketSwapForm({
  submitted,
  mNm,
  mFm,
  mPh,
  mProv,
  mCity,
  mBD,
  mBM,
  mBY,
  mPrice,
  mSimPh,
  mDesPh,
  mOwn,
  mCond,
  mHk,
  mCities,
  provinces,
  setMNm,
  setMFm,
  setMPh,
  setMProv,
  setMCity,
  setMBD,
  setMBM,
  setMBY,
  setMPrice,
  setMSimPh,
  setMDesPh,
  setMOwn,
  setMCond,
  setMHk,
  mNmE,
  mFmE,
  mPhE,
  mPrE,
  mCiE,
  mPriceE,
  mSimPhE,
  mDesPhE,
  mHkE,
  mBdE,
  isMobile,
  formatPrice,
}: MarketSwapFormProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="afu d2">
        <FieldSet
          label="نام"
          value={mNm}
          onChange={(e) => setMNm(onlyPersian(e.target.value))}
          error={mNmE}
          helperText={mNmE ? "این فیلد اجباری است" : undefined}
          dir="rtl"
        />
      </div>
      <div className="afu d3">
        <FieldSet
          label="نام خانوادگی"
          value={mFm}
          onChange={(e) => setMFm(onlyPersian(e.target.value))}
          error={mFmE}
          helperText={mFmE ? "این فیلد اجباری است" : undefined}
          dir="rtl"
        />
      </div>
      <div className="afu d3">
        <FieldSet
          label="شماره موبایل"
          type="tel"
          value={mPh}
          onChange={(e) =>
            setMPh(toE(e.target.value).replace(/\D/g, "").slice(0, 11))
          }
          error={mPhE}
          helperText={
            mPhE
              ? !mPh
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
            value={mProv}
            onChange={(id) => {
              setMProv(id as number);
              setMCity("");
            }}
            error={mPrE}
            helperText={mPrE ? "این فیلد اجباری است" : undefined}
            openOnFocus
          />
        </div>
        <div className="flex-1">
          <AutocompleteField
            label="شهر"
            options={mCities}
            value={mCity}
            onChange={(id) => setMCity(id as number)}
            error={mCiE}
            helperText={mCiE ? "این فیلد اجباری است" : undefined}
            disabled={!mProv}
            openOnFocus
            key={mProv}
          />
        </div>
      </div>
      <div className="afu d4">
        <BirthDate
          day={mBD}
          month={mBM}
          year={mBY}
          setDay={setMBD}
          setMonth={setMBM}
          setYear={setMBY}
          error={mBdE}
        />
      </div>
      <div className="afu d3">
        <FieldSet
          label="شماره فروشی"
          type="tel"
          value={mSimPh}
          onChange={(e) => {
            const v = digits(e.target.value, 11);
            const ok =
              !v || /^0912\d{0,7}$/.test(v) || (v.length < 4 && "0912".startsWith(v));
            setMSimPh(ok ? v : mSimPh);
          }}
          error={mSimPhE}
          helperText={
            mSimPhE
              ? !mSimPh
                ? "این فیلد اجباری است"
                : "شماره باید ۱۱ رقم و با 0912 شروع شود"
              : undefined
          }
          dir="rtl"
                />
      </div>
      <div className="afu d4 relative">
        <FieldSet
          label="قیمت پیشنهادی"
          type="text"
          value={formatPrice(mPrice)}
          onChange={(e) =>
            setMPrice(toE(e.target.value).replace(/\D/g, "").slice(0, 15))
          }
          error={mPriceE}
          helperText={mPriceE ? "قیمت باید بیشتر از صفر باشد" : undefined}
          dir="rtl"
        />
        {mPrice && (
          <span
            className="absolute left-3 top-1/2 -translate-y-1/2 text-white/60 text-sm pointer-events-none select-none"
            style={{ fontFamily: "Vazirmatn, sans-serif" }}
          >
            تومان
          </span>
        )}
      </div>
      <div className="afu d4">
        <FieldSet
          label="شماره دلخواه"
          type="tel"
          value={mDesPh}
          onChange={(e) => {
            const v = digits(e.target.value, 11);
            const ok =
              !v || /^0912\d{0,7}$/.test(v) || (v.length < 4 && "0912".startsWith(v));
            setMDesPh(ok ? v : mDesPh);
          }}
          error={mDesPhE}
          helperText={
            mDesPhE
              ? !mDesPh
                ? "این فیلد اجباری است"
                : "شماره باید ۱۱ رقم و با 0912 شروع شود"
              : undefined
          }
          dir="rtl"
        />
      </div>
      <div className="afu d4">
        <RadioButtons
          label="مالک سیم کارت"
          options={[
            ["self", "خودم"],
            ["other", "دیگری"],
          ]}
          value={mOwn}
          onChange={setMOwn}
        />
      </div>
      <div className="afu d5">
        <RadioButtons
          label="وضعیت سیم کارت"
          options={[
            ["used", "کارکرده"],
            ["new", "خشک"],
          ]}
          value={mCond}
          onChange={setMCond}
        />
      </div>
      <div className="afu d6">
        <HowKnow val={mHk} onChange={setMHk} forceError={mHkE} />
      </div>
    </div>
  );
}
