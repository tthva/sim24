"use client";

import { useMemo, useState } from "react";
import {
  AlarmClock,
  AlertTriangle,
  BadgeCheck,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  Clock,
  CreditCard,
  FileText,
  Phone,
  Receipt,
  ShieldAlert,
  Upload,
  Wallet,
  X,
  Zap,
} from "lucide-react";

/* ============================================================
   TYPES
   ============================================================ */
type InstallmentStatus = "paid" | "due" | "overdue";
type PayMode = "single" | "all";
type FilterType = "all" | "active" | "overdue" | "done";
type PayStep = "select" | "confirm" | "processing" | "done";

interface Installment {
  id: number;
  number: number;
  dueDate: string;
  amount: number;
  status: InstallmentStatus;
  paidDate?: string;
}

interface Contract {
  id: string;
  phoneNumber: string;
  operator: string;
  plan: string;
  merchant: string;
  totalAmount: number;
  monthlyAmount: number;
  months: number;
  signedDate: string;
  installments: Installment[];
}

interface ContractSummary {
  totalPaid: number;
  totalRemaining: number;
  activeCount: number;
  overdueCount: number;
  doneCount: number;
  nextDueAmount: number;
  nextDueDate: string | null;
}

/* ============================================================
   HELPERS
   ============================================================ */
const faDigits = (n: number | string): string => {
  const fa = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
  return String(n).replace(/[0-9]/g, (d) => fa[+d]);
};

const faMoney = (n: number): string => faDigits(n.toLocaleString("en-US"));

const faPhone = (p: string): string => {
  const d = p.replace(/[^\d]/g, "");
  const grouped =
    d.length === 11 ? `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7)}` : d;
  return faDigits(grouped);
};

const faDate = (iso: string): string => {
  const d = new Date(iso);
  const months = [
    "فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور",
    "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند",
  ];
  return `${faDigits(d.getDate())} ${months[d.getMonth() % 12]} ${faDigits(d.getFullYear())}`;
};

const daysUntilDue = (iso: string): number => {
  const due = new Date(iso);
  const now = new Date();
  return Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
};

const hasUrgentInstallment = (contracts: Contract[]): boolean =>
  contracts.some((c) =>
    c.installments.some(
      (i) => i.status !== "paid" && daysUntilDue(i.dueDate) <= 3,
    ),
  );

/* ============================================================
   CONSTANTS
   ============================================================ */
const operatorAccent: Record<string, string> = {
  "همراه اول": "#88ffa4",
  ایرانسل: "#ffd76b",
  رایتل: "#c9a3ff",
};

const statusMeta: Record<
  InstallmentStatus,
  { label: string; color: string; bg: string; border: string; dot: string }
> = {
  paid: {
    label: "پرداخت‌شده",
    color: "#88ffa4",
    bg: "rgba(81,187,112,0.12)",
    border: "#51bb70",
    dot: "#51bb70",
  },
  due: {
    label: "در انتظار",
    color: "#ffd76b",
    bg: "rgba(255,215,107,0.1)",
    border: "#ffd76b",
    dot: "#ffd76b",
  },
  overdue: {
    label: "سررسید گذشته",
    color: "#ff8a8a",
    bg: "rgba(255,107,107,0.12)",
    border: "#ff6b6b",
    dot: "#ff6b6b",
  },
};

const flat = {
  background: "rgba(255,255,255,0.03)",
  borderRadius: 14,
} as const;

/* ============================================================
   MOCK DATA
   ============================================================ */
const buildInstallments = (
  months: number,
  monthly: number,
  paidCount: number,
  overdueCount = 0,
): Installment[] => {
  const today = new Date();
  const list: Installment[] = [];
  for (let i = 0; i < months; i++) {
    const monthOffset = i - paidCount + 1 - overdueCount;
    const due = new Date(today.getFullYear(), today.getMonth() + monthOffset, 10);
    let status: InstallmentStatus = "due";
    let paidDate: string | undefined;
    if (i < paidCount) {
      status = "paid";
      paidDate = new Date(due.getFullYear(), due.getMonth(), 8).toISOString();
    } else if (due < today) {
      status = "overdue";
    }
    list.push({
      id: i + 1,
      number: i + 1,
      dueDate: due.toISOString(),
      amount: monthly,
      status,
      paidDate,
    });
  }
  return list;
};

const INITIAL_CONTRACTS: Contract[] = [
  {
    id: "SIM-1402-8841",
    phoneNumber: "09123456789",
    operator: "همراه اول",
    plan: "دائمی",
    merchant: "فروشگاه سیم‌کارت تهران",
    totalAmount: 24000000,
    monthlyAmount: 2000000,
    months: 12,
    signedDate: "2024-11-15",
    installments: buildInstallments(12, 2000000, 4, 0),
  },
  {
    id: "SIM-1402-7720",
    phoneNumber: "09351234567",
    operator: "ایرانسل",
    plan: "اعتباری",
    merchant: "نمایندگی ایرانسل",
    totalAmount: 31500000,
    monthlyAmount: 3500000,
    months: 9,
    signedDate: "2025-01-05",
    installments: buildInstallments(9, 3500000, 2, 1),
  },
  {
    id: "SIM-1402-6610",
    phoneNumber: "09212345678",
    operator: "رایتل",
    plan: "دائمی",
    merchant: "مرکز فروش رایتل",
    totalAmount: 54000000,
    monthlyAmount: 3000000,
    months: 18,
    signedDate: "2025-02-20",
    installments: buildInstallments(18, 3000000, 1, 2),
  },
  {
    id: "SIM-1401-5532",
    phoneNumber: "09120000012",
    operator: "همراه اول",
    plan: "دائمی - رند",
    merchant: "بازار سیم‌کارت",
    totalAmount: 42000000,
    monthlyAmount: 7000000,
    months: 6,
    signedDate: "2024-06-10",
    installments: buildInstallments(6, 7000000, 6, 0),
  },
];

/* ============================================================
   SMALL UI ATOMS
   ============================================================ */
const SectionTitle = ({
  icon: Icon,
  title,
  sub,
}: {
  icon: typeof Zap;
  title: string;
  sub?: string;
}) => (
  <div className="flex items-center gap-3 mb-4">
    <div
      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
      style={{ background: "rgba(81,187,112,0.14)" }}
    >
      <Icon size={20} color="#88ffa4" />
    </div>
    <div>
      <h2 className="text-white font-bold text-lg leading-tight">{title}</h2>
      {sub && <p className="text-white/50 text-xs mt-0.5">{sub}</p>}
    </div>
  </div>
);

const StatCard = ({
  icon: Icon,
  label,
  value,
  suffix,
  accent,
  delay,
}: {
  icon: typeof Zap;
  label: string;
  value: string;
  suffix?: string;
  accent: string;
  delay: string;
}) => (
  <div
    className={`p-4 afu ${delay}`}
    style={{
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: 16,
    }}
  >
    <div className="flex items-center justify-between mb-3">
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center"
        style={{ background: accent + "22" }}
      >
        <Icon size={18} color={accent} />
      </div>
      <span className="text-white/40 text-[11px]">{label}</span>
    </div>
    <div className="flex items-baseline gap-1">
      <span className="text-white font-extrabold text-xl tracking-tight">{value}</span>
      {suffix && <span className="text-white/40 text-[11px]">{suffix}</span>}
    </div>
  </div>
);

const StatusBadge = ({ status }: { status: InstallmentStatus }) => {
  const m = statusMeta[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap"
      style={{
        color: m.color,
        background: m.bg,
        border: `1px solid ${m.border}44`,
      }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: m.dot }} />
      {m.label}
    </span>
  );
};

const Row = ({
  label,
  value,
  highlight,
  muted,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  muted?: boolean;
}) => (
  <div className="flex items-center justify-between gap-3">
    <span className="text-white/50">{label}</span>
    <span
      className={`font-semibold ${highlight ? "text-[#88ffa4]" : muted ? "text-white/35" : "text-white"}`}
    >
      {value}
    </span>
  </div>
);

const Modal = ({
  children,
  onClose,
  title,
}: {
  children: React.ReactNode;
  onClose: () => void;
  title: string;
}) => (
  <div
    className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 afi"
    style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
    onClick={onClose}
  >
    <div
      className="gc w-full sm:max-w-md max-h-[92vh] overflow-y-auto custom-scroll p-5 asd relative z-10"
      style={{ borderRadius: "24px 24px 0 0" }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-bold text-base">{title}</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-white/70 hover:text-white"
            style={{ background: "rgba(255,255,255,0.06)" }}
          >
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  </div>
);

/* ============================================================
   MAIN COMPONENT
   ============================================================ */
export default function SimCardInstallments() {
  /* ---------- STATE ---------- */
  const [contracts, setContracts] = useState<Contract[]>(INITIAL_CONTRACTS);
  const [filter, setFilter] = useState<FilterType>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [payContract, setPayContract] = useState<Contract | null>(null);
  const [payInstallment, setPayInstallment] = useState<Installment | null>(null);
  const [payMode, setPayMode] = useState<PayMode>("single");
  const [payStep, setPayStep] = useState<PayStep>("select");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [showConsequences, setShowConsequences] = useState(() =>
    hasUrgentInstallment(INITIAL_CONTRACTS),
  );

  /* ---------- DERIVED DATA ---------- */
  const summary = useMemo<ContractSummary>(() => {
    let totalPaid = 0;
    let totalRemaining = 0;
    let activeCount = 0;
    let overdueCount = 0;
    let doneCount = 0;
    let nextDueAmount = 0;
    let nextDueDate: string | null = null;

    for (const c of contracts) {
      const paid = c.installments.filter((i) => i.status === "paid");
      const remaining = c.installments.filter((i) => i.status !== "paid");
      const overdue = c.installments.filter((i) => i.status === "overdue");

      totalPaid += paid.reduce((s, i) => s + i.amount, 0);
      totalRemaining += remaining.reduce((s, i) => s + i.amount, 0);
      if (remaining.length === 0) doneCount++;
      else activeCount++;
      overdueCount += overdue.length;

      if (remaining.length > 0) {
        const next = remaining.sort(
          (a, b) => +new Date(a.dueDate) - +new Date(b.dueDate),
        )[0];
        if (next) {
          nextDueAmount += next.amount;
          if (!nextDueDate || +new Date(next.dueDate) < +new Date(nextDueDate)) {
            nextDueDate = next.dueDate;
          }
        }
      }
    }

    return { totalPaid, totalRemaining, activeCount, overdueCount, doneCount, nextDueAmount, nextDueDate };
  }, [contracts]);

  const urgent = useMemo(() => hasUrgentInstallment(contracts), [contracts]);

  const filtered = useMemo(() => {
    return contracts.filter((c) => {
      const remaining = c.installments.filter((i) => i.status !== "paid");
      const overdue = c.installments.filter((i) => i.status === "overdue");
      if (filter === "all") return true;
      if (filter === "active") return remaining.length > 0 && overdue.length === 0;
      if (filter === "overdue") return overdue.length > 0;
      if (filter === "done") return remaining.length === 0;
      return true;
    });
  }, [contracts, filter]);

  const payAmount = useMemo(() => {
    if (!payContract) return 0;
    if (payMode === "all") {
      return payContract.installments
        .filter((i) => i.status !== "paid")
        .reduce((s, i) => s + i.amount, 0);
    }
    return payInstallment?.amount ?? 0;
  }, [payContract, payInstallment, payMode]);

  const expanded = contracts.find((c) => c.id === expandedId) ?? null;

  /* ---------- HANDLERS ---------- */
  const openPaySingle = (c: Contract) => {
    const next =
      c.installments.find((i) => i.status === "overdue") ??
      c.installments.find((i) => i.status === "due");
    if (!next) return;
    setPayContract(c);
    setPayInstallment(next);
    setPayMode("single");
    setPayStep("select");
    setReceiptFile(null);
    setReceiptPreview(null);
  };

  const openPayAll = (c: Contract) => {
    const remaining = c.installments.filter((i) => i.status !== "paid");
    if (remaining.length === 0) return;
    setPayContract(c);
    setPayInstallment(null);
    setPayMode("all");
    setPayStep("select");
    setReceiptFile(null);
    setReceiptPreview(null);
  };

  const confirmPayment = () => {
    setPayStep("processing");
    setTimeout(() => {
      setContracts((prev) =>
        prev.map((c) => {
          if (c.id !== payContract?.id) return c;
          if (payMode === "all") {
            return {
              ...c,
              installments: c.installments.map((i) =>
                i.status !== "paid"
                  ? { ...i, status: "paid", paidDate: new Date().toISOString() }
                  : i,
              ),
            };
          }
          return {
            ...c,
            installments: c.installments.map((i) =>
              i.id === payInstallment?.id
                ? { ...i, status: "paid", paidDate: new Date().toISOString() }
                : i,
            ),
          };
        }),
      );
      setPayStep("done");
    }, 1700);
  };

  const closePay = () => {
    setPayContract(null);
    setPayInstallment(null);
    setPayStep("select");
    setReceiptFile(null);
    setReceiptPreview(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setReceiptFile(file);
    const reader = new FileReader();
    reader.onload = () => setReceiptPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  /* ---------- RENDER ---------- */
  return (
    <div className="pb min-h-screen flex flex-col">
      {/* ===== Header ===== */}
      <header className="px-4 sm:px-8 pt-6 pb-8 afi">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center"
              style={{
                background: "rgba(81,187,112,0.16)",
                border: "1.5px solid #88ffa4",
              }}
            >
              <Phone size={22} color="#88ffa4" />
            </div>
            <div>
              <h1 className="text-white font-extrabold text-lg sm:text-xl leading-tight">
                اقساط سیم‌کارت
              </h1>
              <p className="text-white/50 text-xs mt-0.5">
                مدیریت یکپارچه خریدهای اقساطی سیم‌کارت
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowConsequences((s) => !s)}
              className="relative px-3 h-10 flex items-center gap-2 text-white text-xs font-semibold transition-colors"
              style={{
                background: showConsequences
                  ? "rgba(255,107,107,0.14)"
                  : "rgba(255,255,255,0.05)",
                border: `1px solid ${showConsequences ? "#ff6b6b55" : "rgba(255,255,255,0.1)"}`,
                borderRadius: 10,
              }}
            >
              <ShieldAlert size={16} color={urgent ? "#ff8a8a" : "#fff"} />
              <span className="hidden sm:inline">عواقم عدم پرداخت</span>
              {urgent && (
                <span
                  className="absolute -top-1 -left-1 w-3 h-3 rounded-full bg-[#ff6b6b] urgent-pulse"
                  style={{ border: "2px solid #11223d" }}
                />
              )}
            </button>
            <button
              onClick={async () => {
                try {
                  await fetch("/api/operator/auth", { method: "DELETE", credentials: "include" });
                } finally {
                  window.location.href = "/login";
                }
              }}
              className="px-3 py-2 bg-red-600/30 hover:bg-red-600/50 text-red-400 rounded-lg transition text-xs font-bold"
            >
              خروج
            </button>
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.12)",
              }}
            >
              ر
            </div>
          </div>
        </div>
      </header>

      {/* ===== Body ===== */}
      <main className="flex-1 px-4 sm:px-8 pb-10">
        <div className="max-w-6xl mx-auto">
          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <StatCard icon={FileText} label="قراردادهای فعال" value={faDigits(summary.activeCount)} suffix={`از ${faDigits(contracts.length)}`} accent="#88ffa4" delay="afu" />
            <StatCard icon={CheckCircle2} label="پرداختی تاکنون" value={faMoney(summary.totalPaid)} suffix="تومان" accent="#51bb70" delay="afu d1" />
            <StatCard icon={Clock} label="باقی‌مانده" value={faMoney(summary.totalRemaining)} suffix="تومان" accent="#ffd76b" delay="afu d2" />
            <StatCard icon={AlarmClock} label="سررسید گذشته" value={faDigits(summary.overdueCount)} suffix="قسط" accent="#ff6b6b" delay="afu d3" />
          </div>

          {/* Consequences Panel */}
          {showConsequences && (
            <div className="gc p-5 mt-5 afu relative z-10">
              <div className="relative z-10">
                <SectionTitle
                  icon={ShieldAlert}
                  title="عواقم عدم پرداخت اقساط"
                  sub={urgent ? "شما قسط سررسید گذشته یا نزدیک به سررسید دارید" : "در صورت عدم پرداخت به‌موقع، موارد زیر اعمال می‌شود"}
                />
                <div className="divide-y divide-white/5">
                  {[
                    { icon: AlertTriangle, title: "جریمه دیرکرد", desc: "برای هر روز تأخیر، معادل ۱٪ مبلغ قسط به‌عنوان جریمه محاسبه می‌شود." },
                    { icon: BadgeCheck, title: "افت رتبه اعتباری", desc: "عدم پرداخت روی امتیاز اعتباری شما ثبت شده و امکان خرید اقساطی بعدی را محدود می‌کند." },
                    { icon: CalendarClock, title: "تعلیق قرارداد", desc: "پس از ۳ قسط معوق، قرارداد تعلیق شده و سیم‌کارت قابل مسدودی می‌شود." },
                    { icon: FileText, title: "اقدام قانونی", desc: "پس از ۶ قسط معوق، پرونده برای پیگرد قانونی به مراجع ذی‌صلاح ارجاع می‌شود." },
                  ].map((it, idx) => (
                    <div key={idx} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: "rgba(255,107,107,0.1)" }}>
                        <it.icon size={16} color="#ff8a8a" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-white font-bold text-sm">{it.title}</h4>
                        <p className="text-white/55 text-xs mt-1 leading-relaxed">{it.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Next Due Highlight */}
          {summary.nextDueDate && (
            <div className="gc p-4 sm:p-5 mt-5 afu relative z-10">
              <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(255,215,107,0.12)" }}>
                    <CalendarClock size={22} color="#ffd76b" />
                  </div>
                  <div>
                    <p className="text-white/50 text-xs">نزدیک‌ترین سررسید</p>
                    <p className="text-white font-bold text-base mt-0.5">{faDate(summary.nextDueDate!)}</p>
                  </div>
                </div>
                <div className="text-left sm:text-right">
                  <p className="text-white/40 text-[11px]">مبلغ قابل پرداخت</p>
                  <p className="text-[#88ffa4] font-extrabold text-lg">
                    {faMoney(summary.nextDueAmount)} <span className="text-white/40 text-xs font-normal">تومان</span>
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="flex items-center gap-2 mt-7 mb-4 overflow-x-auto custom-scroll pb-1">
            {[
              { id: "all", label: "همه" },
              { id: "active", label: "فعال" },
              { id: "overdue", label: "سررسید گذشته" },
              { id: "done", label: "تسویه شده" },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id as FilterType)}
                className="px-4 h-9 rounded-full text-xs font-bold whitespace-nowrap transition-all shrink-0"
                style={
                  filter === f.id
                    ? { background: "#51bb70", color: "#011b2c", border: "1px solid #88ffa4" }
                    : { background: "rgba(255,255,255,0.04)", color: "#fff", border: "1px solid rgba(255,255,255,0.1)" }
                }
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Contracts List */}
          <div className="space-y-4">
            {filtered.length === 0 && (
              <div className="gc p-10 text-center afu relative z-10">
                <div className="relative z-10 text-white/50 text-sm">
                  هیچ قراردادی در این دسته وجود ندارد.
                </div>
              </div>
            )}
            {filtered.map((c, idx) => {
              const paid = c.installments.filter((i) => i.status === "paid").length;
              const remaining = c.installments.length - paid;
              const overdue = c.installments.filter((i) => i.status === "overdue");
              const pct = Math.round((paid / c.installments.length) * 100);
              const next =
                c.installments.find((i) => i.status === "overdue") ??
                c.installments.find((i) => i.status === "due");
              const isExpanded = expandedId === c.id;
              const isDone = remaining === 0;
              const accent = operatorAccent[c.operator] ?? "#88ffa4";
              const remainingAmount = remaining * c.monthlyAmount;

              return (
                <div
                  key={c.id}
                  className="gc p-4 sm:p-5 afu relative z-10"
                  style={{ animationDelay: `${0.05 * ((idx % 4) + 1)}s` }}
                >
                  <div className="relative z-10">
                    {/* Header Row */}
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: accent + "1f" }}>
                          <Phone size={22} color={accent} />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-white font-extrabold text-base leading-tight tracking-wide">
                            {faPhone(c.phoneNumber)}
                          </h3>
                          <div className="flex items-center gap-2 mt-1 text-white/50 text-[11px]">
                            <span style={{ color: accent }}>{c.operator}</span>
                            <span className="w-1 h-1 rounded-full bg-white/30" />
                            <span>{c.plan}</span>
                            <span className="w-1 h-1 rounded-full bg-white/30" />
                            <span>{c.merchant}</span>
                          </div>
                        </div>
                      </div>
                      {isDone ? (
                        <StatusBadge status="paid" />
                      ) : overdue.length > 0 ? (
                        <StatusBadge status="overdue" />
                      ) : (
                        <StatusBadge status="due" />
                      )}
                    </div>

                    {/* Progress */}
                    <div className="mt-5">
                      <div className="flex items-center justify-between text-[11px] mb-2">
                        <span className="text-white/60">
                          پیشرفت: {faDigits(paid)} از {faDigits(c.installments.length)} قسط
                        </span>
                        <span className="text-[#88ffa4] font-bold">{faDigits(pct)}٪</span>
                      </div>
                      <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
                        <div className="h-full rounded-full progress-fill" style={{ width: `${pct}%` }} />
                      </div>
                    </div>

                    {/* Quick Stats */}
                    <div
                      className="grid grid-cols-3 mt-5 overflow-hidden"
                      style={{ ...flat, border: "1px solid rgba(255,255,255,0.06)" }}
                    >
                      <div className="p-3 text-center">
                        <p className="text-white/40 text-[10px]">قسط ماهانه</p>
                        <p className="text-white font-bold text-xs mt-1">{faMoney(c.monthlyAmount)}</p>
                      </div>
                      <div className="p-3 text-center" style={{ borderRight: "1px solid rgba(255,255,255,0.06)", borderLeft: "1px solid rgba(255,255,255,0.06)" }}>
                        <p className="text-white/40 text-[10px]">پرداخت‌شده</p>
                        <p className="text-[#88ffa4] font-bold text-xs mt-1">{faMoney(paid * c.monthlyAmount)}</p>
                      </div>
                      <div className="p-3 text-center">
                        <p className="text-white/40 text-[10px]">باقی‌مانده</p>
                        <p className="font-bold text-xs mt-1" style={{ color: overdue.length > 0 ? "#ff8a8a" : "#ffd76b" }}>
                          {faMoney(remainingAmount)}
                        </p>
                      </div>
                    </div>

                    {/* Next Installment Alert */}
                    {next && !isDone && (
                      <div
                        className="mt-4 p-3 rounded-xl flex items-center gap-3 flex-wrap"
                        style={{
                          background: next.status === "overdue" ? "rgba(255,107,107,0.08)" : "rgba(255,215,107,0.06)",
                        }}
                      >
                        {next.status === "overdue" ? (
                          <AlertTriangle size={16} color="#ff8a8a" className="shrink-0" />
                        ) : (
                          <CalendarClock size={16} color="#ffd76b" className="shrink-0" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-white text-xs font-semibold">
                            قسط {faDigits(next.number)} - {faMoney(next.amount)} تومان
                          </p>
                          <p className="text-white/50 text-[11px] mt-0.5">
                            {next.status === "overdue"
                              ? `سررسید گذشته از ${faDate(next.dueDate)}`
                              : `سررسید: ${faDate(next.dueDate)}`}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-2 mt-5 flex-wrap">
                      {!isDone && (
                        <>
                          <button className="ba gap-2" onClick={() => openPaySingle(c)}>
                            <CreditCard size={16} />
                            پرداخت قسط
                          </button>
                          <button
                            onClick={() => openPayAll(c)}
                            className="gap-2 px-4 h-11 rounded-xl text-xs font-bold flex items-center justify-center transition-colors"
                            style={{
                              background: "rgba(136,255,164,0.1)",
                              color: "#88ffa4",
                              border: "1px solid #88ffa455",
                            }}
                          >
                            <Wallet size={16} />
                            تسویه کامل
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : c.id)}
                        className="px-3 h-11 text-white/70 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
                      >
                        <Receipt size={15} />
                        {isExpanded ? "بستن جزئیات" : "جزئیات اقساط"}
                        <ChevronLeft size={15} className={`transition-transform ${isExpanded ? "rotate-90" : "-rotate-90"}`} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>

      {/* ===== Footer ===== */}
      <footer className="mt-auto px-4 sm:px-8 py-5">
        <div className="max-w-6xl mx-auto flex items-center justify-between text-white/40 text-[11px] flex-wrap gap-2">
          <span>© ۱۴۰۴ - سامانه اقساط سیم‌کارت</span>
          <span>تمام مبالغ به تومان است</span>
        </div>
      </footer>

      {/* ===== Details Modal ===== */}
      {expanded && (
        <Modal onClose={() => setExpandedId(null)} title={`اقساط ${faPhone(expanded.phoneNumber)}`}>
          <p className="text-white/50 text-xs -mt-2 mb-4">
            {expanded.operator} · {expanded.plan} · {expanded.merchant}
          </p>
          <div className="max-h-[52vh] overflow-y-auto custom-scroll -mx-1 px-1">
            <div className="divide-y divide-white/5">
              {expanded.installments.map((ins) => (
                <div key={ins.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {ins.status === "paid" ? (
                      <div className="rc shrink-0" />
                    ) : ins.status === "overdue" ? (
                      <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ border: "2px solid #ff6b6b" }}>
                        <AlertTriangle size={12} color="#ff6b6b" />
                      </div>
                    ) : (
                      <div className="ru shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="text-white text-sm font-semibold">قسط {faDigits(ins.number)}</p>
                      <p className="text-white/45 text-[11px] mt-0.5">
                        {ins.status === "paid" && ins.paidDate
                          ? `پرداخت در ${faDate(ins.paidDate)}`
                          : `سررسید: ${faDate(ins.dueDate)}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-left">
                      <p className="text-white font-bold text-sm">{faMoney(ins.amount)}</p>
                      <p className="text-white/35 text-[10px]">تومان</p>
                    </div>
                    <StatusBadge status={ins.status} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            {expanded.installments.some((i) => i.status !== "paid") && (
              <button
                className="ba flex-1 gap-2"
                onClick={() => {
                  const toPay = expanded;
                  setExpandedId(null);
                  openPaySingle(toPay);
                }}
              >
                <CreditCard size={16} />
                پرداخت قسط بعدی
              </button>
            )}
            <button onClick={() => setExpandedId(null)} className="px-5 h-11 text-white/70 hover:text-white text-xs font-bold transition-colors">
              بستن
            </button>
          </div>
        </Modal>
      )}

      {/* ===== Payment Modal ===== */}
      {payContract && (
        <Modal
          onClose={closePay}
          title={
            payStep === "done"
              ? payMode === "all" ? "تسویه کامل ثبت شد" : "پرداخت ثبت شد"
              : payStep === "processing"
                ? "در حال پردازش"
                : payMode === "all"
                  ? "تسویه کامل قرارداد"
                  : "پرداخت قسط"
          }
        >
          {/* Amount Summary */}
          {payStep !== "done" && (
            <div className="p-4 mb-4 afi" style={{ ...flat, border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: (operatorAccent[payContract.operator] ?? "#88ffa4") + "1f" }}
                >
                  <Phone size={18} color={operatorAccent[payContract.operator] ?? "#88ffa4"} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-white text-sm font-bold tracking-wide">{faPhone(payContract.phoneNumber)}</p>
                  <p className="text-white/50 text-[11px] mt-0.5">
                    {payContract.operator} · {payContract.plan}
                  </p>
                </div>
              </div>
              <div className="pt-3 flex items-center justify-between" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
                <div>
                  <p className="text-white/50 text-[11px]">
                    {payMode === "all" ? "تسویه همه اقساط باقی‌مانده" : `قسط ${faDigits(payInstallment?.number ?? 0)} از ${faDigits(payContract.installments.length)}`}
                  </p>
                  {payMode === "all" && (
                    <p className="text-white/40 text-[10px] mt-0.5">
                      شامل {faDigits(payContract.installments.filter((i) => i.status !== "paid").length)} قسط
                    </p>
                  )}
                  {payMode === "single" && payInstallment && (
                    <p className="text-white/40 text-[10px] mt-0.5">سررسید: {faDate(payInstallment.dueDate)}</p>
                  )}
                </div>
                <div className="text-left">
                  <p className="text-[#88ffa4] font-extrabold text-lg">{faMoney(payAmount)}</p>
                  <p className="text-white/40 text-[10px]">تومان</p>
                </div>
              </div>
              {payMode === "single" && payInstallment?.status === "overdue" && (
                <div className="mt-3 flex items-center gap-2 text-[11px] text-[#ff8a8a]">
                  <AlertTriangle size={13} />
                  این قسط سررسید گذشته است؛ لطفاً هرچه زودتر پرداخت کنید.
                </div>
              )}
            </div>
          )}

          {/* Step: Upload Receipt */}
          {payStep === "select" && (
            <div className="afi">
              <label
                className={`block cursor-pointer p-5 rounded-2xl text-center transition-all ${
                  receiptFile ? "border-2 border-[#51bb70]" : "border-2 border-dashed border-white/15 hover:border-white/30"
                }`}
                style={{ background: receiptFile ? "rgba(81,187,112,0.08)" : "rgba(255,255,255,0.03)" }}
              >
                <input type="file" accept="image/*,.pdf" className="hidden" onChange={handleFileChange} />
                {receiptPreview ? (
                  <div className="space-y-3">
                    <img src={receiptPreview} alt="رسید پرداخت" className="max-h-48 mx-auto rounded-lg object-contain" />
                    <div className="flex items-center justify-center gap-2 text-[#88ffa4] text-xs font-semibold">
                      <CheckCircle2 size={14} />
                      <span>رسید بارگذاری شد</span>
                    </div>
                    <p className="text-white/40 text-[10px] truncate">{receiptFile?.name ?? "—"}</p>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        setReceiptFile(null);
                        setReceiptPreview(null);
                      }}
                      className="text-white/50 hover:text-white text-[11px] underline"
                    >
                      تغییر رسید
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3 py-4">
                    <div className="w-14 h-14 mx-auto rounded-full flex items-center justify-center" style={{ background: "rgba(136,255,164,0.12)" }}>
                      <Upload size={24} color="#88ffa4" />
                    </div>
                    <div>
                      <p className="text-white font-bold text-sm">بارگذاری رسید پرداخت</p>
                      <p className="text-white/50 text-[11px] mt-1">تصویر یا فایل PDF رسید را انتخاب کنید</p>
                    </div>
                    <div className="inline-block px-4 py-2 rounded-lg text-xs font-bold" style={{ background: "rgba(136,255,164,0.15)", color: "#88ffa4" }}>
                      انتخاب فایل
                    </div>
                  </div>
                )}
              </label>

              <div className="mt-4 p-3 rounded-xl flex items-start gap-2 text-[11px]" style={{ background: "rgba(255,215,107,0.08)" }}>
                <AlertTriangle size={14} color="#ffd76b" className="shrink-0 mt-0.5" />
                <p className="text-white/70 leading-relaxed">
                  مبلغ را به شماره حساب اعلام‌شده واریز کرده و رسید را در این بخش بارگذاری کنید. پس از بررسی، پرداخت تأیید می‌شود.
                </p>
              </div>

              <button className="ba w-full mt-5 gap-2" disabled={!receiptFile} onClick={() => setPayStep("confirm")}>
                ادامه
                <ChevronLeft size={16} className="rotate-180" />
              </button>
            </div>
          )}

          {/* Step: Confirm */}
          {payStep === "confirm" && (
            <div className="afi">
              <div className="p-4 mb-4" style={{ ...flat, border: "1px solid rgba(255,255,255,0.07)" }}>
                <div className="space-y-2.5 text-xs">
                  <Row label="شماره سیم‌کارت" value={faPhone(payContract.phoneNumber)} />
                  <Row label="نوع پرداخت" value={payMode === "all" ? "تسویه کامل" : "یک قسط"} />
                  <Row label="روش پرداخت" value="بارگذاری رسید" />
                  <div className="h-px bg-white/8 my-2" />
                  <Row label={payMode === "all" ? "مجموع باقی‌مانده" : "مبلغ قسط"} value={`${faMoney(payAmount)} تومان`} highlight />
                  <div className="h-px bg-white/8 my-2" />
                  <Row label="وضعیت رسید" value={receiptFile ? receiptFile.name : "—"} muted />
                </div>
              </div>

              {receiptPreview && (
                <div className="mb-4 p-2 rounded-xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <img src={receiptPreview} alt="پیش‌نمایش رسید" className="max-h-40 w-full object-contain rounded-lg" />
                </div>
              )}

              {payMode === "single" && payInstallment?.status === "overdue" && (
                <div className="p-3 rounded-xl flex items-start gap-2 text-[11px] mb-4" style={{ background: "rgba(255,107,107,0.08)" }}>
                  <ShieldAlert size={14} color="#ff8a8a" className="shrink-0 mt-0.5" />
                  <p className="text-[#ff8a8a] leading-relaxed">
                    با پرداخت این قسط معوق، از اعمال جریمه‌های بیشتر و اقدامات قانونی جلوگیری می‌شود.
                  </p>
                </div>
              )}
              {payMode === "all" && (
                <div className="p-3 rounded-xl flex items-start gap-2 text-[11px] mb-4" style={{ background: "rgba(81,187,112,0.08)" }}>
                  <CheckCircle2 size={14} color="#88ffa4" className="shrink-0 mt-0.5" />
                  <p className="text-[#88ffa4] leading-relaxed">
                    با تسویه کامل، قرارداد بسته شده و تمام اقساط باقی‌مانده به‌عنوان پرداخت‌شده ثبت می‌شوند.
                  </p>
                </div>
              )}

              <div className="flex gap-2">
                <button className="ba flex-1 gap-2" onClick={confirmPayment}>
                  <CheckCircle2 size={16} />
                  ثبت و ارسال رسید
                </button>
                <button onClick={() => setPayStep("select")} className="px-5 h-11 text-white/70 hover:text-white text-xs font-bold transition-colors">
                  بازگشت
                </button>
              </div>
            </div>
          )}

          {/* Step: Processing */}
          {payStep === "processing" && (
            <div className="py-10 flex flex-col items-center gap-4 afi">
              <div className="w-14 h-14 rounded-full border-4 border-white/15 border-t-[#51bb70] animate-spin" />
              <p className="text-white text-sm">در حال ارسال رسید...</p>
              <p className="text-white/40 text-xs">لطفاً صبر کنید</p>
            </div>
          )}

          {/* Step: Done */}
          {payStep === "done" && (
            <div className="py-8 flex flex-col items-center gap-4 afi text-center">
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center"
                style={{
                  background: "rgba(81,187,112,0.15)",
                  border: "3px solid #51bb70",
                  boxShadow: "0 0 30px rgba(81,187,112,0.4)",
                }}
              >
                <CheckCircle2 size={40} color="#88ffa4" />
              </div>
              <div>
                <h3 className="text-white font-bold text-lg">رسید با موفقیت ارسال شد!</h3>
                <p className="text-white/55 text-xs mt-1">
                  رسید پرداخت شما ثبت شد و پس از بررسی، قسط مربوطه پرداخت‌شده تلقی می‌شود.
                </p>
              </div>
              <div className="p-4 w-full flex items-center justify-between text-xs" style={{ ...flat, border: "1px solid rgba(255,255,255,0.07)" }}>
                <span className="text-white/55">کد پیگیری</span>
                <span className="text-white font-mono font-bold">{faDigits(Math.floor(Math.random() * 9000000) + 1000000)}</span>
              </div>
              <button className="ba w-full mt-2 gap-2" onClick={closePay}>
                <CheckCircle2 size={16} />
                تمام
              </button>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}