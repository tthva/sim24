"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Layout from "@/components/Layout";
import GlassCard from "@/components/GlassCard";

type Form = {
  id: string;
  phone: string | null;
  formType: string;
  formData: string;
  createdAt: string;
};

const LABELS: Record<string, string> = {
  buy_direct: "خرید نقدی",
  buy_inst: "خرید اقساطی",
  buy_pre: "پیش‌سفارش",
  sell_direct: "فروش سیم‌کارت",
  sell_market: "تعویض سیم‌کارت",
  sell_cons: "فروش امانی",
};
LABELS["invest_installment"] = "سرمایه‌گذاری فروش اقساط";
LABELS["invest_buy-sell"] = "سرمایه‌گذاری خرید و فروش";

const FORM_TITLES: Record<string, string> = {
  buy_direct: "فرم خرید نقدی",
  buy_inst: "فرم خرید اقساطی",
  buy_pre: "فرم پیش‌سفارش",
  sell_direct: "فرم فروش سیم‌کارت",
  sell_market: "فرم تعویض سیم‌کارت",
  sell_cons: "فرم فروش امانی",
};
FORM_TITLES["invest_installment"] = "فرم سرمایه‌گذاری فروش اقساط";
FORM_TITLES["invest_buy-sell"] = "فرم سرمایه‌گذاری خرید و فروش";

const LABEL_MAP: Record<string, string> = {
  nm: "نام",
  fm: "نام خانوادگی",
  ph: "شماره تماس",
  phone: "شماره تماس",
  prov: "استان",
  city: "شهر",
  birthDay: "روز تولد",
  birthMonth: "ماه تولد",
  birthYear: "سال تولد",
  hk: "نحوه آشنایی",
  cond: "وضعیت سیم‌کارت",
  pref: "توضیحات",
  dNm: "نام",
  dFm: "نام خانوادگی",
  dPh: "شماره تماس",
  dProv: "استان",
  dCity: "شهر",
  dBD: "روز تولد",
  dBM: "ماه تولد",
  dBY: "سال تولد",
  dOwn: "مالک سیم‌کارت",
  dCond: "وضعیت سیم‌کارت",
  dSimPh: "شماره فروشی",
  dHk: "نحوه آشنایی",
  mNm: "نام",
  mFm: "نام خانوادگی",
  mPh: "شماره تماس",
  mProv: "استان",
  mCity: "شهر",
  mBD: "روز تولد",
  mBM: "ماه تولد",
  mBY: "سال تولد",
  mSph: "شماره امانت",
  mPrice: "قیمت",
  mDuration: "مدت زمان",
  mOwn: "مالک سیم‌کارت",
  mCond: "وضعیت سیم‌کارت",
  mHk: "نحوه آشنایی",
  sph: "شماره امانت",
  price: "قیمت",
  duration: "مدت زمان",
  own: "مالک سیم‌کارت",
  simPh: "شماره فروشی",
  it: "نوع سرمایه‌گذاری",
  sp: "مبلغ سیم‌کارت",
  dp: "پیش‌پرداخت",
  mo: "تعداد اقساط",
  nt: "توضیحات پیش‌سفارش",
};

const VALUE_MAP: Record<string, (val: any) => string> = {
  cond: (v) => (v === "new" ? "خشک" : v === "used" ? "کارکرده" : String(v)),
  dCond: (v) => (v === "new" ? "خشک" : v === "used" ? "کارکرده" : String(v)),
  mCond: (v) => (v === "new" ? "خشک" : v === "used" ? "کارکرده" : String(v)),
  dOwn: (v) => (v === "self" ? "خودم" : v === "other" ? "دیگری" : String(v)),
  mOwn: (v) => (v === "self" ? "خودم" : v === "other" ? "دیگری" : String(v)),
  own: (v) => (v === "self" ? "خودم" : v === "other" ? "دیگری" : String(v)),
  it: (v) => (v === "installment" ? "فروش اقساط" : v === "buy-sell" ? "خرید و فروش" : String(v)),
};

function parseFormData(data: any): Record<string, any> {
  if (!data) return {};
  // Prisma returns Json fields as already-parsed objects (not strings)
  if (typeof data === "object") return data;
  // Fallback: try to parse as string
  try { return JSON.parse(data); } catch { return {}; }
}

function getLabel(formType: string): string {
  return LABELS[formType] || formType;
}

function getFormTitle(formType: string): string {
  return FORM_TITLES[formType] || "جزئیات فرم";
}

function toPersianDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("fa-IR", {
      year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit"
    });
  } catch { return dateStr; }
}

function toPersianDateShort(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("fa-IR");
  } catch { return dateStr; }
}

function extractPhone(data: Record<string, any>): string {
  return data.ph || data.dPh || data.mPh || data.phone || "";
}

function formatBirthDate(fields: Record<string, any>): string {
  const day = fields.birthDay || fields.dBD || fields.mBD;
  const month = fields.birthMonth || fields.dBM || fields.mBM;
  const year = fields.birthYear || fields.dBY || fields.mBY;
  if (day && month && year) return `${year}/${month}/${day}`;
  return "";
}

function FormDetailModal({ form, onClose }: { form: Form | null; onClose: () => void }) {
  if (!form) return null;

  const fields = parseFormData(form.formData);
  const phone = extractPhone(fields) || form.phone || "—";
  const birthDateStr = formatBirthDate(fields);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#11223d]/60 backdrop-blur-sm"
      style={{ animation: "fadeIn 0.3s ease-out" }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg mx-auto p-6 md:p-8 bg-[#1c3968]/5 backdrop-blur-xl border border-white/20 rounded-3xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.5)] overflow-y-auto max-h-[90vh]"
        style={{ direction: "rtl" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-[#51BB70]">
            {getFormTitle(form.formType)}
          </h2>
          <button onClick={onClose} className="text-white/60 hover:text-white text-lg">✕</button>
        </div>

        <div className="space-y-3 mb-6">
          <DetailRow label="شناسه" value={form.id.slice(-8)} />
          <DetailRow label="نوع" value={getLabel(form.formType)} />
          <DetailRow label="شماره تماس" value={phone} />
          <DetailRow label="تاریخ ثبت" value={toPersianDate(form.createdAt)} />
          {birthDateStr && <DetailRow label="تاریخ تولد" value={birthDateStr} />}
          {Object.entries(fields).map(([key, val]) => {
            if (!val || key === "formType" || key === "agentId") return null;
            if (["birthDay", "birthMonth", "birthYear", "dBD", "dBM", "dBY", "mBD", "mBM", "mBY"].includes(key)) return null;
            const label = LABEL_MAP[key] || key;
            const formatter = VALUE_MAP[key];
            const displayVal = formatter ? formatter(val) : String(val);
            return <DetailRow key={key} label={label} value={displayVal} />;
          })}
        </div>

        <button onClick={onClose} className="ba w-full">بستن</button>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2.5 px-4 rounded-xl bg-white/5 border border-white/5">
      <span className="text-sm text-white/60">{label}</span>
      <span className="text-sm text-white font-medium">{value}</span>
    </div>
  );
}

function exportToCSV(forms: Form[]) {
  const allKeys = new Set<string>();
  const rowsData: Record<string, any>[] = [];

  forms.forEach((f) => {
    const parsed = parseFormData(f.formData);
    rowsData.push(parsed);
    Object.keys(parsed).forEach((k) => allKeys.add(k));
  });

  const excludeKeys = new Set(["birthDay", "birthMonth", "birthYear", "dBD", "dBM", "dBY", "mBD", "mBM", "mBY", "formType", "agentId"]);

  const priorityKeys = [
    "nm", "fm", "dNm", "dFm", "mNm", "mFm",
    "ph", "dPh", "mPh",
    "prov", "dProv", "mProv", "city", "dCity", "mCity",
    "hk", "dHk", "mHk",
  ];

  const sortedKeys = Array.from(allKeys)
    .filter((k) => !excludeKeys.has(k))
    .sort((a, b) => {
      const ai = priorityKeys.indexOf(a);
      const bi = priorityKeys.indexOf(b);
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1;
      if (bi !== -1) return 1;
      return a.localeCompare(b);
    });

  const BOM = "\uFEFF";

  const baseKeys = new Set(["nm", "fm", "dNm", "dFm", "mNm", "mFm", "prov", "dProv", "mProv", "city", "dCity", "mCity", "ph", "dPh", "mPh"]);
  const extraKeys = sortedKeys.filter((k) => !baseKeys.has(k));

  const headers = [
    "شناسه", "نوع", "شماره تماس", "تاریخ",
    "نام", "نام خانوادگی", "استان", "شهر",
    ...extraKeys.map((k) => LABEL_MAP[k] || k),
  ];

  const esc = (v: any): string => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    if (s.includes(",") || s.includes("\n") || s.includes('"')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const rows = forms.map((f, i) => {
    const data = rowsData[i];

    const name = data.nm || data.dNm || data.mNm || "";
    const family = data.fm || data.dFm || data.mFm || "";
    const phone = data.ph || data.dPh || data.mPh || "";
    const province = data.prov ?? data.dProv ?? data.mProv;
    const provinceStr = province !== undefined && province !== null ? String(province) : "";
    const cityVal = data.city ?? data.dCity ?? data.mCity;
    const cityStr = cityVal !== undefined && cityVal !== null ? String(cityVal) : "";

    const cellValues = extraKeys.map((k) => {
      const val = data[k];
      if (val === undefined || val === null) return "";
      const formatter = VALUE_MAP[k];
      return esc(formatter ? formatter(val) : String(val));
    });

    return [
      f.id.slice(-6),
      getLabel(f.formType),
      phone,
      toPersianDateShort(f.createdAt),
      name,
      family,
      provinceStr,
      cityStr,
      ...cellValues,
    ].join(",");
  });

  const csvContent = [headers.join(","), ...rows].join("\n");
  const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const now = new Date().toLocaleDateString("fa-IR").replace(/\//g, "-");
  a.download = `forms-${now}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AgentFormsPage() {
  const r = useRouter();
  const [forms, setForms] = useState<Form[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedForm, setSelectedForm] = useState<Form | null>(null);
  const [filters, setFilters] = useState({
    formType: "",
    phone: "",
    startDate: "",
    endDate: "",
  });

  useEffect(() => {
    fetchForms();
  }, []);

  const fetchForms = async () => {
    try {
      const params = new URLSearchParams();
      if (filters.formType) params.set("formType", filters.formType);
      if (filters.phone) params.set("phone", filters.phone);
      if (filters.startDate) params.set("startDate", filters.startDate);
      if (filters.endDate) params.set("endDate", filters.endDate);

      const res = await fetch(`/api/agent/forms?${params}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setForms(data.forms);
    } catch {
      r.replace("/login");
    } finally {
      setLoading(false);
    }
  };

  const getPhone = (form: Form): string => {
    if (form.phone) return form.phone;
    const data = parseFormData(form.formData);
    return extractPhone(data) || "-";
  };

  const handleFilterChange = (key: keyof typeof filters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const applyFilters = () => {
    setLoading(true);
    fetchForms();
  };

  const clearFilters = () => {
    setFilters({ formType: "", phone: "", startDate: "", endDate: "" });
    setLoading(true);
    fetchForms();
  };

  if (loading) {
    return (
      <Layout
        ch={<div className="flex flex-1 justify-center items-center text-white">در حال بارگذاری...</div>}
      />
    );
  }

  return (
    <>
      <Layout
        ch={
          <div className="flex flex-col flex-1 px-6 py-8 gap-6">
            <GlassCard cls="w-full p-6" ch={
              <div className="flex justify-between items-center">
                <h1 className="text-white text-xl font-bold">فرم‌های شما</h1>
                <div className="flex gap-2">
                  {forms.length > 0 && (
                    <button onClick={() => exportToCSV(forms)} className="text-green-400 hover:text-green-300 text-sm flex items-center gap-1">
                      <span>📥</span> خروجی Excel
                    </button>
                  )}
                  <button onClick={() => r.back()} className="text-white/60 text-sm">بازگشت</button>
                </div>
              </div>
            } />

            <GlassCard cls="w-full p-6" ch={
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="text-white/70 text-sm block mb-1">نوع فرم</label>
                    <select
                      className="w-full bg-white/10 text-white rounded p-2"
                      value={filters.formType}
                      onChange={(e) => handleFilterChange("formType", e.target.value)}
                    >
                      <option value="">همه</option>
                      <option value="buy_">خرید</option>
                      <option value="sell_">فروش</option>
                      <option value="invest_">سرمایه‌گذاری</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-white/70 text-sm block mb-1">شماره تماس</label>
                    <input
                      type="text"
                      className="w-full bg-white/10 text-white rounded p-2"
                      placeholder="جستجو..."
                      value={filters.phone}
                      onChange={(e) => handleFilterChange("phone", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-white/70 text-sm block mb-1">از تاریخ</label>
                    <input
                      type="date"
                      className="w-full bg-white/10 text-white rounded p-2"
                      value={filters.startDate}
                      onChange={(e) => handleFilterChange("startDate", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-white/70 text-sm block mb-1">تا تاریخ</label>
                    <input
                      type="date"
                      className="w-full bg-white/10 text-white rounded p-2"
                      value={filters.endDate}
                      onChange={(e) => handleFilterChange("endDate", e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={applyFilters} className="ba flex-1 max-w-[200px]">اعمال فیلتر</button>
                  <button onClick={clearFilters} className="bg-white/20 text-white flex-1 max-w-[200px] rounded p-2">پاک کردن</button>
                </div>
              </div>
            } />

            <GlassCard cls="w-full p-6 flex-1" ch={
              <div className="overflow-x-auto">
                <table className="w-full text-white/80">
                  <thead>
                    <tr className="border-b border-white/20">
                      <th className="text-right p-3 whitespace-nowrap">شناسه</th>
                      <th className="text-right p-3 whitespace-nowrap">نوع</th>
                      <th className="text-right p-3 whitespace-nowrap">شماره</th>
                      <th className="text-right p-3 whitespace-nowrap">تاریخ</th>
                      <th className="text-right p-3 whitespace-nowrap">عملیات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {forms.map((form) => (
                      <tr key={form.id} className="border-b border-white/10 hover:bg-white/5">
                        <td className="p-3 whitespace-nowrap">{form.id.slice(-6)}</td>
                        <td className="p-3 whitespace-nowrap">{getLabel(form.formType)}</td>
                        <td className="p-3 ltr text-left whitespace-nowrap" dir="ltr">{getPhone(form)}</td>
                        <td className="p-3 whitespace-nowrap">{toPersianDateShort(form.createdAt)}</td>
                        <td className="p-3 whitespace-nowrap">
                          <button
                            onClick={() => setSelectedForm(form)}
                            className="text-blue-400 hover:text-blue-300 text-sm"
                          >
                            مشاهده
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {forms.length === 0 && (
                  <div className="text-white/50 text-center py-10">هیچ فرمی یافت نشد</div>
                )}
              </div>
            } />
          </div>
        }
      />
      {selectedForm && (
        <FormDetailModal form={selectedForm} onClose={() => setSelectedForm(null)} />
      )}
    </>
  );
}