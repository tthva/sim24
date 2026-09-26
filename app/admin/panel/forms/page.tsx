"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Layout from "@/components/Layout";
import GlassCard from "@/components/GlassCard";

type FormReport = {
  summary: {
    total: number;
    started: number;
    conversionRate: number;
    formTypes: number;
  };
  byFormType: { formType: string; count: number; started: number; conversionRate: number }[];
  daily: { day: string; count: number }[];
};

type Form = {
  id: string;
  phone: string | null;
  fullName: string | null;
  formType: string;
  formData: any;
  workflowCode: string | null;
  workflowStarted: boolean | null;
  createdAt: string;
  agent: { id: string; username: string } | null;
};

const FORM_LABELS: Record<string, string> = {
  nm: "نام",
  fm: "نام خانوادگی",
  ph: "شماره تماس",
  prov: "استان",
  city: "شهر",
  birthDay: "روز تولد",
  birthMonth: "ماه تولد",
  birthYear: "سال تولد",
  pref: "شماره ترجیحی",
  hk: "نحوه آشنایی",
  cond: "وضعیت",
  nt: "توضیحات",
  sp: "مبلغ سیمکارت",
  dp: "پیش‌پرداخت",
  mo: "تعداد اقساط",
  it: "نوع سرمایه‌گذاری",
  acc: "پذیرش قوانین",
  dNm: "نام",
  dFm: "نام خانوادگی",
  dPh: "شماره تماس",
  dProv: "استان",
  dCity: "شهر",
  dBD: "روز تولد",
  dBM: "ماه تولد",
  dBY: "سال تولد",
  dOwn: "مالکیت",
  dCond: "وضعیت",
  dSimPh: "شماره فروشی",
  dPrice: "قیمت",
  dHk: "نحوه آشنایی",
  mNm: "نام",
  mFm: "نام خانوادگی",
  mPh: "شماره تماس",
  mProv: "استان",
  mCity: "شهر",
  mBD: "روز تولد",
  mBM: "ماه تولد",
  mBY: "سال تولد",
  mOwn: "مالکیت",
  mCond: "وضعیت",
  mSimPh: "خط فروخته شده",
  mDesPh: "خط دلخواه",
  mPrice: "قیمت",
  mHk: "نحوه آشنایی",
  sph: "شماره امانی",
  price: "قیمت",
  duration: "مدت امانت",
  own: "مالکیت",
  uph: "شماره کاربر",
  type: "نوع",
  real_market_value: "ارزش واقعی بازار",
};

const HIDE_KEYS = new Set(["agentId", "attachmentIds", "__typename"]);

function formatFormValue(key: string, value: any): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "بله" : "خیر";
  if (key === "prov" || key === "dProv" || key === "mProv") {
    const provinces = ["","تهران","اصفهان","فارس","خراسان رضوی","آذربایجان شرقی","خوزستان","مازندران","آذربایجان غربی","کرمان","سیستان وبلوچستان","گیلام","کرمانشاه","لرستان","هرمزگان","گلستان","زنجان","اردبیل","قزوین","قم","کردستان","همدان","چهارمحال وبختیاری","بویراحمد","یزد","مرکزی","سمنان","قم","ایلام","کهگیلویه","خراسان شمالی","خراسان جنوبی","البرز"];
    const n = Number(value);
    return provinces[n] || String(value);
  }
  if (key === "city" || key === "dCity" || key === "mCity") return String(value);
  if (key === "hk" || key === "dHk" || key === "mHk") return String(value);
  if (key === "cond" || key === "dCond" || key === "mCond") return value === "new" ? "نو" : value === "used" ? "دست‌دوم" : String(value);
  if (key === "own" || key === "dOwn" || key === "mOwn") return value === "self" ? "خودی" : "غیرخودی";
  if (key === "acc") return value ? "پذیرفته" : "پذیرفته نشده";
  if ((key === "price" || key === "dPrice" || key === "mPrice" || key === "sp" || key === "dp") && !isNaN(Number(value))) {
    return Number(value).toLocaleString("fa-IR") + " تومان";
  }
  return String(value);
}

export default function AdminFormsPage() {
  const r = useRouter();
  const [forms, setForms] = useState<Form[]>([]);
  const [report, setReport] = useState<FormReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedForm, setSelectedForm] = useState<Form | null>(null);
  const [filters, setFilters] = useState({
    formType: "",
    phone: "",
    startDate: "",
    endDate: "",
    agentId: "",
  });

  useEffect(() => {
    fetchForms();
    fetchReport();
  }, []);

  const fetchReport = async () => {
    try {
      const res = await fetch(`/api/admin/reports/forms`);
      if (!res.ok) return;
      const data = await res.json();
      setReport(data);
    } catch {
      // Non-fatal: KPIs simply stay hidden if the report endpoint fails.
    }
  };

  const downloadCsv = () => {
    const params = new URLSearchParams({ format: "csv" });
    if (filters.formType) params.set("formType", filters.formType);
    if (filters.startDate) params.set("dateFrom", filters.startDate);
    if (filters.endDate) params.set("dateTo", filters.endDate);
    if (filters.phone) params.set("phone", filters.phone);
    if (filters.agentId) params.set("agentId", filters.agentId);
    window.location.href = `/api/admin/reports/forms?${params}`;
  };

  const fetchForms = async () => {
    try {
      const params = new URLSearchParams();
      if (filters.formType) params.set("formType", filters.formType);
      if (filters.phone) params.set("phone", filters.phone);
      if (filters.startDate) params.set("startDate", filters.startDate);
      if (filters.endDate) params.set("endDate", filters.endDate);
      if (filters.agentId) params.set("agentId", filters.agentId);

      const res = await fetch(`/api/admin/forms?${params}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setForms(data.forms);
    } catch {
      r.replace("/admin/login");
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key: keyof typeof filters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const applyFilters = () => {
    setLoading(true);
    fetchForms();
  };

  const clearFilters = () => {
    setFilters({
      formType: "",
      phone: "",
      startDate: "",
      endDate: "",
      agentId: "",
    });
    setLoading(true);
    fetchForms();
  };

  if (loading) {
    return (
      <Layout
        wide
        ch={<div className="flex flex-1 justify-center items-center text-white">در حال بارگذاری...</div>}
      />
    );
  }

  return (
    <>
      <Layout
      wide
      ch={
        <div className="flex flex-col flex-1 px-6 py-8 gap-6">
          <GlassCard
            cls="w-full p-6"
            ch={
              <div className="flex justify-between items-center">
                <h1 className="text-white text-xl font-bold">فرم‌های ثبت‌شده</h1>
                <div className="flex items-center gap-3">
                  <button
                    onClick={downloadCsv}
                    className="bg-white/15 text-white text-sm rounded px-4 py-2 hover:bg-white/25"
                  >
                    خروجی CSV
                  </button>
                  <button onClick={() => r.back()} className="text-white/60 text-sm">
                    بازگشت
                  </button>
                </div>
              </div>
            }
          />

          <GlassCard
            cls="w-full p-6"
            ch={
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
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
                  <label className="text-white/70 text-sm block mb-1">نماینده</label>
                  <input
                    type="text"
                    className="w-full bg-white/10 text-white rounded p-2"
                    placeholder="شناسه نماینده"
                    value={filters.agentId}
                    onChange={(e) => handleFilterChange("agentId", e.target.value)}
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
                <div className="flex items-end gap-2">
                  <button onClick={applyFilters} className="ba flex-1">
                    اعمال فیلتر
                  </button>
                  <button onClick={clearFilters} className="bg-white/20 text-white flex-1 rounded p-2">
                    پاک کردن
                  </button>
                </div>
              </div>
            }
          />

          {report && (
            <GlassCard
              cls="w-full p-6"
              ch={
                <div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white/5 rounded-xl p-4">
                      <div className="text-white/50 text-sm">کل ثبت‌ها</div>
                      <div className="text-white text-2xl font-bold mt-1">
                        {report.summary.total.toLocaleString("fa-IR")}
                      </div>
                    </div>
                    <div className="bg-white/5 rounded-xl p-4">
                      <div className="text-white/50 text-sm">شروع ورک‌فلو</div>
                      <div className="text-[#51BB70] text-2xl font-bold mt-1">
                        {report.summary.started.toLocaleString("fa-IR")}
                      </div>
                    </div>
                    <div className="bg-white/5 rounded-xl p-4">
                      <div className="text-white/50 text-sm">نرخ تبدیل</div>
                      <div className="text-white text-2xl font-bold mt-1">
                        {(report.summary.conversionRate * 100).toLocaleString("fa-IR", {
                          maximumFractionDigits: 1,
                        })}
                        ٪
                      </div>
                    </div>
                    <div className="bg-white/5 rounded-xl p-4">
                      <div className="text-white/50 text-sm">نوع فرم‌ها</div>
                      <div className="text-white text-2xl font-bold mt-1">
                        {report.summary.formTypes.toLocaleString("fa-IR")}
                      </div>
                    </div>
                  </div>

                  {report.byFormType.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {report.byFormType.map((ft) => (
                        <div
                          key={ft.formType}
                          className="bg-white/10 rounded-lg px-3 py-2 text-sm text-white"
                        >
                          <span className="font-mono">{ft.formType}</span>
                          <span className="text-white/60 mx-2">•</span>
                          <span>{ft.count.toLocaleString("fa-IR")}</span>
                          <span className="text-white/40 mx-1 text-xs">
                            ({((ft.conversionRate || 0) * 100).toFixed(0)}٪ تبدیل)
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              }
            />
          )}

          <GlassCard
            cls="w-full p-6 flex-1"
            ch={
              <div className="overflow-x-auto">
                <table className="w-full text-white/80">
                  <thead>
                    <tr className="border-b border-white/20">
                      <th className="text-right p-3">شناسه</th>
                      <th className="text-right p-3">نوع</th>
                      <th className="text-right p-3">شماره</th>
                      <th className="text-right p-3">نماینده</th>
                      <th className="text-right p-3">تاریخ</th>
                      <th className="text-right p-3">عملیات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {forms.map((form) => (
                      <tr key={form.id} className="border-b border-white/10 hover:bg-white/5">
                        <td className="p-3">{form.id.slice(-6)}</td>
                        <td className="p-3">{form.formType}</td>
                        <td className="p-3">{form.phone || "-"}</td>
                        <td className="p-3">{form.agent?.username || "-"}</td>
                        <td className="p-3">{new Date(form.createdAt).toLocaleDateString("fa-IR")}</td>
                        <td className="p-3">
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
            }
          />
        </div>
      }
    />
    {selectedForm && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ backgroundColor: "rgba(0,0,0,0.7)" }}
        onClick={() => setSelectedForm(null)}
      >
        <div
          className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl border border-white/10 p-6 shadow-2xl"
          style={{ background: "linear-gradient(to bottom, #203253, #11223d)" }}
          dir="rtl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-white text-xl font-bold">جزئیات فرم</h2>
            <button
              onClick={() => setSelectedForm(null)}
              className="text-white/60 hover:text-white text-2xl leading-none px-2"
            >
              ×
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6 text-sm">
            <div className="bg-white/5 rounded-lg p-3">
              <span className="text-white/50 text-xs">شناسه</span>
              <p className="text-white font-mono text-xs mt-1">{selectedForm.id}</p>
            </div>
            <div className="bg-white/5 rounded-lg p-3">
              <span className="text-white/50 text-xs">نوع فرم</span>
              <p className="text-white mt-1">{selectedForm.formType}</p>
            </div>
            <div className="bg-white/5 rounded-lg p-3">
              <span className="text-white/50 text-xs">نام مشتری</span>
              <p className="text-white mt-1">{selectedForm.fullName || "—"}</p>
            </div>
            <div className="bg-white/5 rounded-lg p-3">
              <span className="text-white/50 text-xs">شماره تماس</span>
              <p className="text-white mt-1">{selectedForm.phone || "—"}</p>
            </div>
            <div className="bg-white/5 rounded-lg p-3">
              <span className="text-white/50 text-xs">نماینده</span>
              <p className="text-white mt-1">{selectedForm.agent?.username || "—"}</p>
            </div>
            <div className="bg-white/5 rounded-lg p-3">
              <span className="text-white/50 text-xs">تاریخ</span>
              <p className="text-white mt-1">{new Date(selectedForm.createdAt).toLocaleDateString("fa-IR")}</p>
            </div>
            <div className="bg-white/5 rounded-lg p-3">
              <span className="text-white/50 text-xs">کد ورک‌فلو</span>
              <p className="text-white mt-1">{selectedForm.workflowCode || "—"}</p>
            </div>
            <div className="bg-white/5 rounded-lg p-3">
              <span className="text-white/50 text-xs">وضعیت ورک‌فلو</span>
              <p className={`mt-1 ${selectedForm.workflowStarted ? "text-[#51BB70]" : "text-red-400"}`}>
                {selectedForm.workflowStarted ? "شروع شده" : "ناموفق"}
              </p>
            </div>
          </div>

          <h3 className="text-white font-bold mb-3 text-sm">داده‌های فرم</h3>
          <div className="bg-white/5 rounded-lg p-4 space-y-2">
            {Object.entries(selectedForm.formData || {})
              .filter(([k]) => !HIDE_KEYS.has(k))
              .map(([key, value]) => (
                <div key={key} className="flex gap-3 text-sm border-b border-white/5 pb-2">
                  <span className="text-white/50 min-w-[120px] shrink-0">
                    {FORM_LABELS[key] || key}:
                  </span>
                  <span className="text-white break-all">
                    {formatFormValue(key, value)}
                  </span>
                </div>
              ))}
            {Object.keys(selectedForm.formData || {}).filter((k) => !HIDE_KEYS.has(k)).length === 0 && (
              <div className="text-white/40 text-center py-4">داده‌ای موجود نیست</div>
            )}
          </div>

          <button
            onClick={() => setSelectedForm(null)}
            className="ba w-full mt-6"
          >
            بستن
          </button>
        </div>
      </div>
    )}
    </>
  );
}