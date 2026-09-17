"use client";
import FieldSet from "./FieldSet";
import HowKnow from "./HowKnow";
import AutocompleteField from "./AutocompleteField";
import { RadioButtons } from "./RadioButtons";
import { BirthDate } from "./BirthDate";
import { onlyPersian, digits, isValid0912 } from "@/lib/form-validators";

type Cond = "new" | "used";
type Own = "self" | "other";

interface DirectSellFormProps {
  submitted: boolean;
  dNm: string;
  dFm: string;
  dPh: string;
  dProv: number | "";
  dCity: number | "";
  dBD: string;
  dBM: string;
  dBY: string;
  dOwn: Own;
  dCond: Cond;
  dSimPh: string;
  dPrice: string;
  dHk: string;
  dCities: any[];
  provinces: any[];
  setDNm: (v: string) => void;
  setDFm: (v: string) => void;
  setDPh: (v: string) => void;
  setDProv: (v: number | "") => void;
  setDCity: (v: number | "") => void;
  setDBD: (v: string) => void;
  setDBM: (v: string) => void;
  setDBY: (v: string) => void;
  setDOwn: (v: Own) => void;
  setDCond: (v: Cond) => void;
  setDSimPh: (v: string) => void;
  setDPrice: (v: string) => void;
  setDHk: (v: string) => void;
  dNmE: boolean;
  dFmE: boolean;
  dPhE: boolean;
  dPrE: boolean;
  dCiE: boolean;
  dBdE: boolean;
  dPriceE: boolean;
  dHkE: boolean;
  isMobile: (v: string) => boolean;
  formatPrice: (val: string) => string;
}

export default function DirectSellForm({
  submitted,
  dNm,
  dFm,
  dPh,
  dProv,
  dCity,
  dBD,
  dBM,
  dBY,
  dOwn,
  dCond,
  dSimPh,
  dPrice,
  dHk,
  dCities,
  provinces,
  setDNm,
  setDFm,
  setDPh,
  setDProv,
  setDCity,
  setDBD,
  setDBM,
  setDBY,
  setDOwn,
  setDCond,
  setDSimPh,
  setDPrice,
  setDHk,
  dNmE,
  dFmE,
  dPhE,
  dPrE,
  dCiE,
  dBdE,
  dPriceE,
  dHkE,
  isMobile,
  formatPrice,
}: DirectSellFormProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="afu d2">
        <FieldSet
          label="نام"
          value={dNm}
          onChange={(e) => setDNm(onlyPersian(e.target.value))}
          error={dNmE}
          helperText={dNmE ? "این فیلد اجباری است" : undefined}
          dir="rtl"
        />
      </div>
      <div className="afu d3">
        <FieldSet
          label="نام خانوادگی"
          value={dFm}
          onChange={(e) => setDFm(onlyPersian(e.target.value))}
          error={dFmE}
          helperText={dFmE ? "این فیلد اجباری است" : undefined}
          dir="rtl"
        />
      </div>
      <div className="afu d3">
        <FieldSet
          label="شماره موبایل"
          type="tel"
          value={dPh}
          onChange={(e) =>
            setDPh(e.target.value.replace(/\D/g, "").slice(0, 11))
          }
          error={dPhE}
          helperText={
            dPhE
              ? !dPh
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
            value={dProv}
            onChange={(id) => {
              setDProv(id as number);
              setDCity("");
            }}
            error={dPrE}
            helperText={dPrE ? "این فیلد اجباری است" : undefined}
            openOnFocus
          />
        </div>
        <div className="flex-1">
          <AutocompleteField
            label="شهر"
            options={dCities}
            value={dCity}
            onChange={(id) => setDCity(id as number)}
            error={dCiE}
            helperText={dCiE ? "این فیلد اجباری است" : undefined}
            disabled={!dProv}
            openOnFocus
            key={dProv}
          />
        </div>
      </div>
      <div className="afu d4">
        <BirthDate
          day={dBD}
          month={dBM}
          year={dBY}
          setDay={setDBD}
          setMonth={setDBM}
          setYear={setDBY}
          error={dBdE}
        />
      </div>
      <RadioButtons
        label="مالکیت سیم کارت"
        options={[
          ["self", "خودم"],
          ["other", "دیگری"],
        ]}
        value={dOwn}
        onChange={setDOwn}
      />
      <div className="afu d5">
        <RadioButtons
          label="وضعیت سیم کارت"
          options={[
            ["used", "کارکرده"],
            ["new", "خشک"],
          ]}
          value={dCond}
          onChange={setDCond}
        />
      </div>
      <div className="afu d3">
        <FieldSet
          label="شماره فروشی"
          type="tel"
          value={dSimPh}
          onChange={(e) => {
            const v = digits(e.target.value, 11);
            const ok =
              !v || /^0912\d{0,7}$/.test(v) || (v.length < 4 && "0912".startsWith(v));
            setDSimPh(ok ? v : dSimPh);
          }}
          error={submitted && (!dSimPh || !isValid0912(dSimPh))}
          helperText={
            submitted && (!dSimPh || !isValid0912(dSimPh))
              ? !dSimPh
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
          value={formatPrice(dPrice)}
          onChange={(e) =>
            setDPrice(e.target.value.replace(/\D/g, "").slice(0, 15))
          }
          error={dPriceE}
          helperText={
            dPriceE ? "قیمت باید بیشتر از صفر باشد" : undefined
          }
          dir="rtl"
        />
        {dPrice && (
          <span
            className="absolute left-3 top-1/2 -translate-y-1/2 text-white/60 text-sm pointer-events-none select-none"
            style={{ fontFamily: "Vazirmatn, sans-serif" }}
          >
            تومان
          </span>
        )}
      </div>
      <div className="afu d6">
        <HowKnow val={dHk} onChange={setDHk} forceError={dHkE} />
      </div>
    </div>
  );
}
