"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import InputField from "@/components/InputField";
import { onlyPersian } from "@/lib/form-validators";
import { apiFetch } from "@/lib/api-client";
import RejectionModal from "@/components/crm/RejectionModal";

// ==================== تایپ‌ها ====================
type FieldKey = string;

interface FieldMetadata {
  label: string;
  displayType?: "text" | "price" | "boolean" | "location" | "duration";
  inputType?: "number" | "textarea" | "checkbox" | "text" | "date";
  required?: boolean;
  placeholder?: string;
  isConditional?: boolean;
  isPrice?: boolean;
}

// ==================== Utility ====================
const formatPrice = (value: number | string): string => {
  if (value === null || value === undefined || value === "") return "";
  const num =
    typeof value === "string"
      ? parseFloat(value.toString().replace(/[^\d.-]/g, ""))
      : value;
  if (isNaN(num)) return "";
  return num.toLocaleString("en-US") + " تومان";
};

const formatNumberWithSeparator = (value: number | string): string => {
  if (value === null || value === undefined || value === "") return "";
  const str = value.toString().replace(/[^\d]/g, "");
  if (!str) return "";
  return parseInt(str).toLocaleString("en-US");
};

const parseNumericInput = (value: string): number | string => {
  const cleaned = value.replace(/[^\d]/g, "");
  if (!cleaned) return "";
  return parseInt(cleaned);
};

// ==================== تاریخ شمسی ====================
const formatDateInput = (value: string): string => {
  const cleaned = value.replace(/[^\d]/g, "");
  const limited = cleaned.slice(0, 8);

  if (limited.length <= 2) return limited;
  if (limited.length <= 4) return `${limited.slice(0, 2)}/${limited.slice(2)}`;
  return `${limited.slice(0, 2)}/${limited.slice(2, 4)}/${limited.slice(4)}`;
};

const validatePersianDate = (value: string): boolean => {
  if (!value) return false;

  const regex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
  const match = value.match(regex);

  if (!match) return false;

  const day = parseInt(match[1]);
  const month = parseInt(match[2]);
  const year = parseInt(match[3]);

  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  if (year < 1300 || year > 1500) return false;

  if (month <= 6 && day > 31) return false;
  if (month > 6 && month < 12 && day > 30) return false;
  if (month === 12 && day > 29) return false;

  return true;
};

// ==================== فرمت ساعت ====================
const formatTimeInput = (value: string): string => {
  const cleaned = value.replace(/[^\d]/g, "");
  const limited = cleaned.slice(0, 4);

  if (limited.length <= 2) return limited;
  return `${limited.slice(0, 2)}:${limited.slice(2)}`;
};

const validateTime = (value: string): boolean => {
  if (!value) return false;
  const regex = /^(\d{2}):(\d{2})$/;
  const match = value.match(regex);
  if (!match) return false;
  const hours = parseInt(match[1]);
  const minutes = parseInt(match[2]);
  if (hours < 0 || hours > 23) return false;
  if (minutes < 0 || minutes > 59) return false;
  return true;
};

// ==================== سال شمسی جاری ====================
const getPersianYear = (): number => {
  const formatted = new Intl.DateTimeFormat("en-US-u-ca-persian", {
    timeZone: "Asia/Tehran",
    year: "numeric",
  }).format(new Date());
  return parseInt(formatted.replace(/[^0-9]/g, ""), 10);
};

// تبدیل ارقام فارسی به انگلیسی
const toE = (s: string) =>
  s.replace(/[۰-۹]/g, (d) => (d.charCodeAt(0) - 1776).toString());

// اعتبارسنجی تاریخ شمسی به فرمت YYYY/MM/DD (سال اول)
const validateShamsiYMD = (value: string): boolean => {
  const match = value.match(/^(\d{4})\/(\d{2})\/(\d{2})$/);
  if (!match) return false;
  const year = parseInt(match[1]);
  const month = parseInt(match[2]);
  const day = parseInt(match[3]);
  if (year < 1300 || year > 1500) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1) return false;
  if (month <= 6 && day > 31) return false;
  if (month > 6 && month < 12 && day > 30) return false;
  if (month === 12 && day > 30) return false;
  return true;
};

// فیلدهای شماره‌ای اپراتور (فقط رقم، حداکثر ۱۱)
const OPERATOR_PHONE_FIELDS = new Set([
  "BuyContactNumber", "BuyDesiredNumber", "EscrowContactNumber",
  "SaleContactNumber", "WantedContactNumber", "SimForSale", "contactNumber",
]);
// فیلدهای نام اپراتور (فقط فارسی)
const OPERATOR_PERSIAN_FIELDS = new Set(["simOwner"]);

// fieldRegistry
const fieldRegistry: Record<FieldKey, FieldMetadata> = {
  province: { label: "استان", displayType: "text" },
  city: { label: "شهر", displayType: "text" },
  customerPrice: { label: "قیمت پیشنهادی مشتری", displayType: "price", isPrice: true },
  SalePrice: { label: "قیمت فروش", displayType: "price", isPrice: true },
  Downpayment : { label: " پیش پرداخت", displayType: "price", isPrice: true },
  location: { label: "مکان", displayType: "location" },
  statusType: { label: "نوع سیم کارت", displayType: "boolean" },
  confirmmali: { label: "تایید مالی ", displayType: "boolean" },
  duration: { label: "مدت زمان", displayType: "duration" },
  simType: { label: "نوع سیم‌کارت", displayType: "text" },
  prepaytype: { label: "مدت اقساط", displayType: "text" },
  BuyContactNumber: { label: "شماره خریداری شده", displayType: "text" },
  BuyDesiredNumber: { label: "شماره جهت خرید", displayType: "text" },
  EscrowContactNumber: { label: "شماره امانت داده شده", displayType: "text" },
  SaleContactNumber: { label: "شماره جهت فروش", displayType: "text" },
  WantedContactNumber: { label: "شماره دلخواه", displayType: "text" },
  SimForSale: { label: "سیم کارت فروشی", displayType: "text" },
  simOwner: { label: "اطلاعات مالک سیم‌کارت", displayType: "text" },
  contactNumber: { label: "شماره تماس", displayType: "text" },
  customerDescription: { label: "توضیحات مشتری", displayType: "text" },
  previousAgentNotes: { label: "یادداشت‌های ایجنت قبلی", displayType: "text" },
  PriceAgentNotes: {
    label: "قیمت کارشناس ",
    displayType: "price",
    isPrice: true,
  },
  SimPrice: {
    label: "قیمت سیم کارت ",
    displayType: "price",
    isPrice: true,
  },
  SimPrepay: {
    label: "مبلغ پیش پرداخت ",
    displayType: "price",
    isPrice: true,
  },
  Simghest: {
    label: "مبلغ هر قسط ",
    displayType: "price",
    isPrice: true,
  },
  UserPrice: {
    label: "قیمت پیشنهادی مشتری",
    displayType: "price",
    isPrice: true,
  },
  investmentType: { label: "نوع سرمایه‌گذاری", displayType: "text" },
  contactRequest: { label: "درخواست تماس", displayType: "boolean" },
  acc: { label: " پذیرش قوانین و مقررات", displayType: "boolean" },

  // Input Fields
  mozakere: { label: " مذاکره", inputType: "checkbox", required: false },
  Avablity: { label: " حذف از سایت ", inputType: "checkbox", required: false },
  tasfie: { label: " تسویه", inputType: "checkbox", required: false },
  paying: { label: " تسویه وجه", inputType: "checkbox", required: false },
  confirm: { label: " تایید مدارک", inputType: "checkbox", required: true },
  investmentConfirm: { label: " تایید درخواست سرمایه‌گذاری", inputType: "checkbox", required: true },
  sanad: { label: " انتقال سند", inputType: "checkbox", required: false },
  mali: { label: "  هماهنگی با واحد مالی", inputType: "checkbox", required: false },
  hozor: { label: "  هماهنگی برای حضور", inputType: "checkbox", required: false },
  daftar: { label: "  هماهنگی با دفتر ارائه دهنده ", inputType: "checkbox", required: false },
  sarmaye: { label: "سرمایه گزار ", inputType: "checkbox" , required: false },
  daryaft: { label: "دریافت سیم کارت", inputType: "checkbox" , required: false },
  bastanGhararDad: { label: "بستن قرارداد ", inputType: "checkbox" , required: false },
  testsanad: { label: "تست سند ", inputType: "checkbox" , required: false },

  purchasePrice: {
    label: "قیمت خرید از مشتری",
    inputType: "number",
    required: true,
    placeholder: "مثلاً 12,500,000",
    isPrice: true,
  },
  SellerPurchasePrice: {
    label: "قیمت خرید از مشتری",
    inputType: "number",
    // مثل purchasePrice قبلی: بعد از تیک daftar الزامی است
    // (گیت وابستگی تا قبل از تیک، آن را غیرفعال و غیرالزامی می‌کند)
    required: true,
    placeholder: "مثلاً 12,500,000",
    isPrice: true,
  },
  OKPrice: {
    label: "قیمت توافقی با مشتری",
    inputType: "number",
    required: true,
    placeholder: "مثلاً 12,500,000",
    isPrice: true,
  },
  salePrice: {
    label: "قیمت فروش ",
    inputType: "number",
    required: true,
    placeholder: "مثلاً 15,000,000",
    isPrice: true,
  },
  OkPrice: {
    label: "قیمت توافق شده ",
    inputType: "number",
    required: true,
    placeholder: "مثلاً 15,000,000",
    isPrice: true,
  },
  newPrice: {
    label: "مبلغ جدید",
    inputType: "number",
    required: true,
    placeholder: "مثلاً 20,000,000",
    isPrice: true,
  },
  ProductPrice: {
    label: "قیمت سیم کارت",
    inputType: "number",
    required: true,
    placeholder: "مثلاً 15,000,000",
    isPrice: true,
  },
  ValuePrice: {
    label: " ارزش بازار",
    inputType: "number",
    required: true,
    placeholder: "مثلاً 20,000,000",
    isPrice: true,
  },
  agentNote: {
    label: "یادداشت کارشناس",
    inputType: "textarea",
    required: false,
  },  
  agentreport: {
    label: "گزارش کارشناس",
    inputType: "textarea",
    required: false,
  },
  isAvailable: { label: "موجود هست", inputType: "checkbox", required: false },
  // BUY_INSTALLMENT stage 1 — independent optional checkbox, right after isAvailable
  hasInstallmentOption: { label: "امکان اقساط دارد", inputType: "checkbox", required: false },
  // price-expert/value — proof-of-SMS tick; enabled only after the SMS button is clicked
  smsSent: { label: "پیامک ارسال شد", inputType: "checkbox", required: true },
  Inputsite: { label: " وارد کردن در سایت", inputType: "checkbox", required: true },
  useSuggestedPrice: {
    label: "وارد کردن قیمت جدید",
    inputType: "checkbox",
    required: false,
    isConditional: true,
  },
  BuyerName: {
    label: "نام خریدار",
    inputType: "text",
    required: true,
  },  sarmayeName: {
    label: "نام سرمایه گزار",
    inputType: "text",
    required: true,
  }, 
  buyingfrom : {
    label: "منبع خرید",
    inputType: "text",
    required: true,
  },
  BuyerLName: {
    label: "نام خانوادگی خریدار",
    inputType: "text",
    required: true,
  },   sarmayeLName: {
    label: "نام خانوادگی سرمایه گزار",
    inputType: "text",
    required: true,
  },  
  Time: {
    label: "زمان حضور",
    inputType: "text",
    required: true,
  },  location2: {
    label: "محل حضور ",
    inputType: "text",
    required: true,
  },
  BuyerHome: {
    label: "شهر و استان",
    inputType: "text",
    required: true,
  },
  BuyerBirthday: {
    label: "تاریخ تولد",
    inputType: "date",
    required: true,
    placeholder: "29/12/1405",
  },
} as const;

// کلیدهای مربوط به گروه چک‌باکس دو ستونه (مذاکره / تصویه وجه / تایید مدارک / انتقال سند)
const pairedCheckboxKeys = ["mozakere", "paying", "confirm", "sanad"];

interface RoleWorkflowPageProps {
  stepTitle: string;
  displayFields: FieldKey[];
  inputFields: FieldKey[];
  initialData?: Record<string, any>;
  stepInstanceId?: string;
  displayTitle?: string;
  displaySubtitle?: string;
  inputTitle?: string;
  inputSubtitle?: string;
  redirectUrl?: string;
  isFinalStep?: boolean;
  // Fields that render an SMS button (sms: link) instead of the call button (tel:)
  smsFields?: string[];
  // Fields that stay disabled until the operator actually clicks the SMS button
  smsGatedFields?: string[];
}

// ==================== Confirmation Modal ====================
interface ModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  type?: "danger" | "success";
}

const ConfirmationModal: React.FC<ModalProps> = ({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = "تأیید",
  cancelText = "انصراف",
  type = "danger",
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-fadeIn">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onCancel}
      />
      <div className="relative bg-[var(--secondary-color)] border border-white/20 rounded-2xl p-6 md:p-8 max-w-md w-full shadow-2xl animate-slideUp">
        <div className="flex justify-center mb-4">
          <div
            className={`w-20 h-20 rounded-full flex items-center justify-center relative ${
              type === "danger" ? "bg-red-500/10" : "bg-emerald-500/10"
            }`}
          >
            <div
              className={`absolute inset-0 rounded-full animate-ping ${
                type === "danger" ? "bg-red-500/20" : "bg-emerald-500/20"
              }`}
            />
            <div
              className={`w-12 h-12 rounded-full border-2 ${
                type === "danger"
                  ? "border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.6)]"
                  : "border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.6)]"
              }`}
            />
          </div>
        </div>
        <h3 className="text-xl font-bold text-white text-center mb-3">
          {title}
        </h3>
        <p className="text-gray-300 text-center mb-6 leading-relaxed">
          {message}
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 bg-white/10 hover:bg-white/20 text-white font-medium py-3 rounded-xl transition-all duration-200"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 font-medium py-3 rounded-xl transition-all duration-200 text-white ${
              type === "danger"
                ? "bg-red-600 hover:bg-red-700"
                : "bg-emerald-600 hover:bg-emerald-700"
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }
        .animate-slideUp {
          animation: slideUp 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};

const RoleWorkflowPage: React.FC<RoleWorkflowPageProps> = ({
  stepTitle,
  displayFields,
  inputFields,
        initialData = {},
  stepInstanceId,
  displayTitle = "",
  displaySubtitle = "",
  inputTitle = "",
  inputSubtitle = "",
  redirectUrl = "/operators/price-expert",
  isFinalStep = false,
  smsFields = [],
  smsGatedFields = [],
}) => {
  const [formData, setFormData] = useState<Record<string, any>>({});
  // True once the operator clicks the SMS button — unlocks smsGatedFields (e.g. smsSent)
  const [smsClicked, setSmsClicked] = useState(false);
  // SMS compose modal (price-expert/value): locked segments + editable text
  const [smsModalOpen, setSmsModalOpen] = useState(false);
  const [smsError, setSmsError] = useState("");
  const [smsRecipient, setSmsRecipient] = useState("");
  const [smsSegs, setSmsSegs] = useState<string[]>(["", "", "", ""]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const router = useRouter();
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    type: "accept" | "cancel" | null;
  }>({ isOpen: false, type: null });
  const [rejectionOpen, setRejectionOpen] = useState(false);

  useEffect(() => {
    const initialForm: Record<string, any> = {};
    inputFields.forEach((key) => {
      initialForm[key] =
        initialData[key] ??
        (fieldRegistry[key]?.inputType === "checkbox" ? false : "");
    });
    // مقداردهی اولیه برای فیلد پویا
    initialForm["newPrice"] = initialData["newPrice"] || "";
    setFormData(initialForm);
  }, [inputFields, initialData]);

  const handleInputChange = (key: string, value: any) => {
    // وقتی یک چک‌باکس والد برداشته می‌شود، همه فیلدهای وابسته (مستقیم و غیرمستقیم)
    // پاک می‌شوند تا مقادیر قدیمی مخفی نمانند
    if (value === false) {
      const dependents = getDependentFields(key as FieldKey);
      if (dependents.length > 0) {
        setFormData((prev) => {
          const next = { ...prev };
          dependents.forEach((f) => {
            next[f] = fieldRegistry[f]?.inputType === "checkbox" ? false : "";
          });
          return next;
        });
        setErrors((prev) => {
          const nextErrors = { ...prev };
          dependents.forEach((f) => {
            delete nextErrors[f];
          });
          return nextErrors;
        });
      }
    }
    setFormData((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: "" }));
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    inputFields.forEach((key) => {
      const meta = fieldRegistry[key];
      if (!meta) return;

      // فیلد فقط وقتی اجباری است که در زنجیره وابستگی فعال شده باشد
      // (OKPrice تا قبل از testsanad، فیلدهای خریدار تا قبل از daftar و ...)
      if (!isFieldEffectivelyRequired(key)) return;

      const value = formData[key];

        if (
          value === "" ||
          value == null ||
          (typeof value === "number" && isNaN(value))
        ) {
          newErrors[key] = "این فیلد اجباری است";
        }

        if (key === "BuyerBirthday" && value && !validateShamsiYMD(String(value))) {
          newErrors[key] = "تاریخ نامعتبر است. فرمت صحیح: 1370/05/12";
        } else if (meta.inputType === "date" && key !== "BuyerBirthday" && value && !validatePersianDate(value)) {
          newErrors[key] = "تاریخ نامعتبر است. فرمت صحیح: 29/12/1405";
        }
    });

    // بررسی شرطی برای قیمت جدید
    if (formData["useSuggestedPrice"] === true) {
      const newPriceValue = formData["newPrice"];
      if (!newPriceValue || newPriceValue === "") {
        newErrors["newPrice"] = "لطفاً قیمت جدید را وارد کنید";
      }
    }

    // بررسی شرطی برای فیلدهای "هماهنگی برای حضور" — فقط وقتی فیلدها واقعاً
    // در این مرحله وجود داشته باشند (مثلاً فروش امانی hozor دارد ولی Time/location2 ندارد)
    if (formData["hozor"] === true) {
      if (inputFields.includes("Time")) {
        const timeValue = formData["Time"]?.toString() || "";
        if (!timeValue || timeValue === "") {
          newErrors["Time"] = "لطفاً زمان حضور را وارد کنید";
        } else {
          const dateParts = timeValue.split(" - ");
          const dateStr = dateParts[0] || "";
          const timeStr = dateParts[1] || "";
          if (!validateShamsiYMD(dateStr)) {
            newErrors["Time"] = "تاریخ شمسی نامعتبر است";
          } else if (!validateTime(timeStr)) {
            newErrors["Time"] = "ساعت نامعتبر است (فرمت: HH:MM)";
          }
        }
      }
      if (inputFields.includes("location2") && (!formData["location2"] || formData["location2"] === "")) {
        newErrors["location2"] = "لطفاً محل حضور را وارد کنید";
      }
    }

    // بررسی شرطی برای فیلدهای "سرمایه گزار"
    if (formData["sarmaye"] === true) {
      if (!formData["sarmayeName"] || formData["sarmayeName"] === "") {
        newErrors["sarmayeName"] = "لطفاً نام سرمایه گزار را وارد کنید";
      }
      if (!formData["sarmayeLName"] || formData["sarmayeLName"] === "") {
        newErrors["sarmayeLName"] = "لطفاً نام خانوادگی سرمایه گزار را وارد کنید";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      setModalState({ isOpen: true, type: "accept" });
    }
  };

  const handleCancelJob = () => {
    // Phase 3: mandatory RejectionModal replaces the simple confirm dialog
    setRejectionOpen(true);
  };

  const handleRejectionConfirm = async (rejection: { reasonId: string; reasonName: string; notes: string }) => {
    setRejectionOpen(false);

    // 1) Workflow rejection — source of truth
    try {
      const res = await apiFetch("/api/workflow/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          stepInstanceId,
          action: "reject",
          formData: {},
          notes: rejection.notes || undefined,
        }),
      });
      if (!res.ok) {
        alert("خطا در ریجکت تسک");
        return;
      }
    } catch {
      alert("خطا در ارتباط با سرور");
      return;
    }

    // 2) CRM TaskRejection record — non-blocking: CRM failure must NOT undo the workflow rejection
    try {
      await apiFetch("/api/crm/tasks/rejections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          stepInstanceId,
          reasonId: rejection.reasonId,
          notes: rejection.notes || undefined,
        }),
      });
    } catch (e) {
      console.warn("[CRM] TaskRejection record failed (workflow rejection still valid):", e);
    }

    router.push(redirectUrl);
  };

  const handleModalConfirm = async () => {
    if (modalState.type === "cancel") {
      const payload = {
        stepInstanceId,
        action: "reject",
        formData: {},
      };

      try {
        const res = await apiFetch("/api/workflow/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        });

        if (res.ok) {
          router.push(redirectUrl);
        } else {
          alert("خطا در انصراف از تسک");
        }
      } catch {
        alert("خطا در ارتباط با سرور");
      }

      setModalState({ isOpen: false, type: null });
      return;
    }

    if (modalState.type === "accept") {
      // اگر همه فیلدهای الزامی پر شده باشند مرحله «تکمیل» می‌شود؛
      // در غیر این صورت فقط ذخیره می‌شود (SAVE) و تسک در وضعیت IN_PROGRESS می‌ماند.
      // الزام هر فیلد به زنجیره وابستگی بستگی دارد (isFieldEffectivelyRequired):
      // مثلا فیلدهای خریدار فقط بعد از تیک «دفتر» و OKPrice فقط بعد از «تست سند» اجباری‌اند.
            const requiredKeys = inputFields.filter((k) => isFieldEffectivelyRequired(k as FieldKey));
      // چک‌باکس‌ها باید دقیقاً true باشند؛ مقدار false نباید به‌عنوان «پرشده» شمرده شود
      const unfilledRequired = requiredKeys.filter((k) => {
        const v = formData[k as FieldKey];
        if (fieldRegistry[k as FieldKey]?.inputType === "checkbox") return v !== true;
        return v === undefined || v === null || String(v).trim() === "";
      });
      const allRequiredFilled = unfilledRequired.length === 0;

      // تکمیل فقط وقتی مجاز است که «همه» چک‌باکس‌های زنجیره تیک خورده باشند:
      // هر چک‌باکی که فیلد وابسته دارد (یا خودش اجباری است) باید true باشد؛
      // در غیر این صورت فقط SAVE می‌شود و تسک IN_PROGRESS می‌ماند.
      const uncheckedChainTicks = inputFields.filter((field) => {
        const meta = fieldRegistry[field];
        if (meta?.inputType !== "checkbox") return false;
        const dependents = getDependentFields(field as FieldKey);
        if (
          dependents.length > 0 ||
          isFieldEffectivelyRequired(field as FieldKey) ||
          chainTickKeys.has(field as FieldKey)
        ) {
          return formData[field as FieldKey] !== true;
        }
        return false;
      });
      const allChainTicksChecked = uncheckedChainTicks.length === 0;

      // Debug: نشان بده دقیقاً کدام فیلدها مانع COMPLETE شده‌اند
      console.log("allRequiredFilled:", allRequiredFilled, "| missing:", unfilledRequired.map((k) => `${k}=${JSON.stringify(formData[k as FieldKey])}`));
      console.log("allChainTicksChecked:", allChainTicksChecked, "| unticked:", uncheckedChainTicks);
      console.log("isPartialSave:", !allRequiredFilled || !allChainTicksChecked);

      const isPartialSave = !allRequiredFilled || !allChainTicksChecked;
      const payload = {
        stepInstanceId,
        action: isPartialSave ? "SAVE" : "complete",
        formData: { ...formData },
      };

      console.log("🚀 ارسال به بک‌اند (Payload):", payload);

      try {
        const res = await apiFetch("/api/workflow/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        });

        console.log("📥 complete API status:", res.status);
        const result = await res.json();
        console.log("📥 complete API response:", result);

        if (res.ok || result.success) {
          console.log("✅ " + (isPartialSave ? "Saved" : "Task completed") + ", redirecting to", redirectUrl);
          setFormData({});
          setErrors({});
          setModalState({ isOpen: false, type: null });
          router.push(redirectUrl);
        } else {
          console.error("❌ Complete failed:", result);
          alert(result.error || "خطا در تکمیل کار");
        }
      } catch (err) {
        console.error("❌ Complete network error:", err);
        alert("خطا در ارتباط با سرور");
      }
    }
  };

  const handleModalCancel = () => {
    setModalState({ isOpen: false, type: null });
  };

  const renderDisplayField = (key: FieldKey) => {
    const meta = fieldRegistry[key];
    console.log("🔍 renderDisplayField:", key, "meta:", meta?.label, "value:", initialData[key]);
    if (!meta) {
      console.log("   ❌ No meta for key:", key);
      return null;
    }

    let displayValue: any = initialData[key];
    console.log("   raw displayValue:", displayValue);

    if (meta.displayType === "price") {
      displayValue = formatPrice(displayValue);
    } else if (meta.displayType === "boolean") {
      if (key === "statusType") {
        displayValue = displayValue ? "خشک" : "کارکرده";
      } else {
        displayValue = displayValue ? "بله" : "خیر";
      }
    } else if (meta.displayType === "location") {
      displayValue = `${initialData.province || ""} > ${initialData.city || ""}`;
    } else if (meta.displayType === "duration") {
      displayValue = displayValue ? `${displayValue} روز` : "";
    }
    console.log("   final displayValue:", displayValue);

    // ==================== فیلد شماره تماس با دکمه تماس/پیامک ====================
    if (key === "contactNumber" && displayValue) {
      const phoneNumber = displayValue.toString().replace(/\s/g, "");
      // صفحاتی که در smsFields فیلد را ثبت کرده‌اند دکمه پیامک می‌گیرند (مثلاً value)
      const useSms = smsFields.includes(key);
      const href = `${useSms ? "sms" : "tel"}:${phoneNumber}`;
      const buttonTitle = useSms ? "ارسال پیامک" : "تماس بگیرید";
      return (
        <div
          key={key}
          className="relative px-5 py-1 rounded-2xl border border-white/10 transition-all duration-300 hover:shadow-lg bg-gradient-to-br from-emerald-500/20 to-transparent"
        >
          <div className="flex items-center gap-2 mb-2">
            <p className="text-xs text-white font-medium">{meta.label}</p>
          </div>
          <div className="flex items-center justify-between gap-2">
            <p className="font-bold text-white tracking-wide" dir="ltr">
              {displayValue || (
                <span className="text-white/50 font-normal text-sm">—</span>
              )}
            </p>
            {displayValue && (
              <button
                onClick={() => {
                  if (!useSms) {
                    window.location.href = href;
                    return;
                  }
                  // پیامک فقط بعد از وارد کردن قیمت معتبر مجاز است
                  const priceDigits = String(
                    formData["ValuePrice"] ?? initialData["ValuePrice"] ?? "",
                  ).replace(/[^\d]/g, "");
                  if (!priceDigits) {
                    setSmsError("ابتدا قیمت سیم‌کارت را وارد کنید");
                    return;
                  }
                  setSmsError("");
                  setSmsRecipient(phoneNumber);
                  // متن پیش‌فرض: ۴ بخش قابل ویرایش + ۳ مقدار قفل (نام/شماره سیم‌کارت/قیمت)
                  setSmsSegs([
                    "سلام ",
                    " عزیز؛ ارزش سیم‌کارت ",
                    " توسط کارشناسان ما بررسی شد.\nقیمت نهایی: ",
                    " تومان.\nبرای ادامه هماهنگی با ما تماس بگیرید.",
                  ]);
                  setSmsModalOpen(true);
                }}
                className={`relative shrink-0 w-8 h-8 rounded-full flex items-center justify-center active:scale-95 transition-all duration-200 shadow group ${
                  useSms
                    ? "bg-gradient-to-br from-sky-400 to-sky-600 hover:from-sky-300 hover:to-sky-500 shadow-sky-500/30"
                    : "bg-gradient-to-br from-emerald-400 to-emerald-600 hover:from-emerald-300 hover:to-emerald-500 shadow-emerald-500/30"
                }`}
                title={buttonTitle}
              >
                {/* افکت pulse */}
                <div className={`absolute inset-0 rounded-full animate-ping opacity-30 group-hover:opacity-50 ${useSms ? "bg-sky-400" : "bg-emerald-400"}`} />
                {/* حلقه بیرونی */}
                <div className="absolute inset-0.5 rounded-full border border-white/30" />
                {useSms ? (
                  /* آیکون پیامک (حباب گفتگو) */
                  <svg
                    className="w-3.5 h-3.5 text-white relative z-10"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                    />
                  </svg>
                ) : (
                  /* آیکون تلفن */
                  <svg
                    className="w-3.5 h-3.5 text-white relative z-10 transform rotate-[135deg]"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                    />
                  </svg>
                )}
              </button>
            )}
          </div>
          {useSms && smsError && (
            <p className="text-[#FF6B6B] text-xs mt-2 text-right">{smsError}</p>
          )}
        </div>
      );
    }

    const isPrice = meta.isPrice || meta.displayType === "price";
    return (
      <div
        key={key}
        className={`relative px-5 py-1 rounded-2xl border border-white/10 transition-all duration-300 hover:border-[var(--main-color)]/40 hover:shadow-lg ${
          isPrice
            ? "bg-gradient-to-br from-[var(--main-color)]/20 to-transparent"
            : "bg-white/5"
        }`}
      >
        <div className="flex items-center gap-2 mb-2">
          <p className="text-xs text-white font-medium">{meta.label}</p>
        </div>
        <p
          className={`font-bold break-words text-white ${
            isPrice ? "text-lg" : "text-base"
          }`}
        >
          {displayValue || (
            <span className="text-white/50 font-normal text-sm">—</span>
          )}
        </p>
      </div>
    );
  };

  // ==================== رندر یک چک‌باکس تکی ====================
  // زنجیره وابستگی چک‌باکس‌ها: هر فیلد تا زمانی که فیلد قبلش تیک نخورده غیرفعال است
  // زنجیره پایه (اسکرو/امانی): همیشه فعال
  const baseDependencyMap: Partial<Record<FieldKey, FieldKey>> = {
    daryaft: "hozor",
    bastanGhararDad: "daryaft",
    testsanad: "bastanGhararDad",
    OKPrice: "testsanad",
    Time: "hozor",
    location2: "hozor",
  };

  // زنجیره فروش (sell-manager/sell): هر فیلد تا فعال شدن قبلی غیرفعال است.
  // فقط وقتی اعمال می‌شود که مرحله فعلی «هم» daftar «و» mozakere داشته باشد؛
  // در غیر این صورت (مثلاً price-expert/sell که فقط purchasePrice دارد)
  // فیلدهایی مثل purchasePrice نباید قفل شوند.
  const sellChainDependencyMap: Partial<Record<FieldKey, FieldKey>> = {
    hozor: "mozakere",
    mali: "hozor",
    daftar: "mali",
    sarmaye: "daftar",
    sarmayeName: "sarmaye",
    sarmayeLName: "sarmaye",
    BuyerName: "daftar",
    BuyerLName: "daftar",
    BuyerHome: "daftar",
    BuyerBirthday: "daftar",
    purchasePrice: "daftar",
    // قیمت خرید از مشتری در مرحله فروش — پس از تغییر نام از purchasePrice
    // به SellerPurchasePrice باید به daftar وابسته بماند
    SellerPurchasePrice: "daftar",
  };

  const shouldApplySellChain =
    inputFields.includes("daftar" as FieldKey) &&
    inputFields.includes("mozakere" as FieldKey);

  // BUY product flow (product-manager/buy): ProductPrice (قیمت سیم کارت) is
  // gated behind isAvailable (موجود هست) — disabled until the tick, required
  // for completion only once ticked, reset to "" when the tick is removed.
  const hasBuyProductPriceChain =
    inputFields.includes("isAvailable") && inputFields.includes("ProductPrice");

  // BUY flow tick chain (sell-manager/buy, sell-manager/Installment):
  // مذاکره → تسویه وجه → تایید مدارک → انتقال سند → گزارش کارشناس
  const isBuyFlow =
    inputFields.includes("mozakere") &&
    inputFields.includes("paying") &&
    inputFields.includes("confirm") &&
    inputFields.includes("sanad");

  const buyChainDependencyMap: Partial<Record<FieldKey, FieldKey>> = {
    paying: "mozakere",
    confirm: "paying",
    sanad: "confirm",
  };

  const dependencyMap: Partial<Record<FieldKey, FieldKey>> = {
    ...(shouldApplySellChain
      ? { ...baseDependencyMap, ...sellChainDependencyMap }
      : baseDependencyMap),
    ...(hasBuyProductPriceChain ? { ProductPrice: "isAvailable" } : {}),
    ...(isBuyFlow ? buyChainDependencyMap : {}),
  };

  // همه فیلدهای درگیر زنجیره وابستگی فعال (هم مقصد، هم منبع).
  // آخرین تیک هر زنجیره (BUY: sanad — SELL: sarmaye/…) فیلد وابسته‌ای ندارد،
  // پس بدون این مجموعه از بررسی تکمیل جا می‌ماند. برای تکمیل، همه باید true باشند.
  const chainTickKeys = new Set<FieldKey>([
    ...(Object.keys(dependencyMap) as FieldKey[]),
    ...(Object.values(dependencyMap) as FieldKey[]),
  ]);

  // Two-stage PRODUCT step detection (BUY_DIRECT / BUY_INSTALLMENT):
  // both PRODUCT stages render through the same page with the same field set —
  // the presence of Avablity + isAvailable in inputFields identifies this flow.
  const isBuyProductStage =
    inputFields.includes("Avablity") && inputFields.includes("isAvailable");

  const isFieldDisabled = (key: FieldKey): boolean => {
    // ==================== Two-stage PRODUCT step (BUY workflows) ====================
    // BUY_DIRECT / BUY_INSTALLMENT have two PRODUCT stages rendered through the
    // same page (product-manager/buy) with the same fields; the stage is
    // distinguished by the step's isFinal flag (isFinalStep prop):
    // - First PRODUCT stage: isAvailable (موجود هست) enabled,
    //   Avablity (حذف از سایت) disabled
    // - Final PRODUCT stage: Avablity (حذف از سایت) enabled, other ticks
    //   disabled but showing their saved values (locked with «ثبت شده ✓»
    //   via initialData)
    if (isBuyProductStage) {
      if (isFinalStep) {
        // Final stage: only Avablity is editable — all other ticks locked
        return key !== "Avablity";
      }
      // First stage: isAvailable enabled, Avablity disabled
      if (key === "Avablity") return true;
    }
    // SMS-gated fields (e.g. smsSent): locked until the operator clicks the SMS button
    if (smsGatedFields.includes(key) && !smsClicked) return true;
    const dep = dependencyMap[key];
    return !!dep && !formData[dep];
  };
  // فیلد قبلاً ذخیره شده؟ هر فیلدی که در initialData مقدار غیرخالی دارد قفل می‌شود
  // (true برای چک‌باکس، متن/عدد غیرخالی برای بقیه) و فقط خواندنی است.
  const isFieldLockedBySave = (key: FieldKey): boolean => {
    const v = (initialData as Record<string, unknown>)[key];
    if (v === undefined || v === null || v === false || v === "—") return false;
    return String(v).trim() !== "";
  };

  // همه فیلدهایی که (مستقیم یا غیرمستقیم) به یک کلید وابسته‌اند — برای پاک‌کردن آبشاری
  const getDependentFields = (key: FieldKey): FieldKey[] => {
    const result: FieldKey[] = [];
    const collect = (parent: FieldKey) => {
      Object.entries(dependencyMap).forEach(([field, dep]) => {
        if (dep === parent && !result.includes(field as FieldKey)) {
          result.push(field as FieldKey);
          collect(field as FieldKey);
        }
      });
    };
    collect(key);
    return result;
  };

  // فیلدهایی که با تیک‌های زنجیره فروش اجباری می‌شوند (علاوه بر required رجیستری)
  const SARMAYE_DEPENDENT_FIELDS: FieldKey[] = ["sarmayeName", "sarmayeLName"];
  const DAFTAR_DEPENDENT_FIELDS: FieldKey[] = [
    "BuyerName",
    "BuyerLName",
    "BuyerHome",
    "BuyerBirthday",
    "purchasePrice",
  ];

  /**
   * آیا این فیلد «الان» اجباری است؟
   * - اگر در زنجیره وابستگی غیرفعال باشد هرگز اجباری نیست (مثل OKPrice تا قبل از تست سند)
   * - تیک‌های زنجیره (mozakere/hozor/mali/daftar/sarmaye و ...) وقتی اجباری‌اند که
   *   این مرحله فیلدی داشته باشد که به آن‌ها وابسته است — یعنی تکمیل زنجیره لازم است
   * - sarmayeName/sarmayeLName فقط وقتی sarmaye تیک خورده اجباری‌اند
   * - فیلدهای خریدار فقط وقتی daftar تیک خورده اجباری‌اند
   */
  const isFieldEffectivelyRequired = (key: FieldKey): boolean => {
    const dep = dependencyMap[key];
    if (dep && formData[dep] !== true) return false;

    // Two-stage PRODUCT step (BUY workflows): stage-specific required tick —
    // first stage requires «موجود هست», final stage requires «حذف از سایت»
    if (isBuyProductStage) {
      if (!isFinalStep && key === "isAvailable") return true;
      if (isFinalStep && key === "Avablity") return true;
    }

    // تیک‌های زنجیره: اگر این مرحله فیلد وابسته‌ای به این تیک دارد، خود تیک هم برای تکمیل اجباری است
    const hasDependentInStep = inputFields.some((k) => dependencyMap[k as FieldKey] === key);
    if (hasDependentInStep) return true;

    if (key === "OKPrice") return true; // تا زمانی که فعال شده باشد، برای تکمیل الزامی است
    if (SARMAYE_DEPENDENT_FIELDS.includes(key)) return formData["sarmaye"] === true;
    if (DAFTAR_DEPENDENT_FIELDS.includes(key)) return formData["daftar"] === true;
    return !!fieldRegistry[key]?.required;
  };

  // قیمت توافقی اجباری است وقتی «تست سند» تیک خورده؛ در این حالت ثبت بدون وارد کردن آن غیرفعال می‌شود
  const okPriceBlocked =
    inputFields.includes("OKPrice") &&
    formData["testsanad"] === true &&
    (formData["OKPrice"] === undefined ||
      formData["OKPrice"] === null ||
      String(formData["OKPrice"]).trim() === "");

  // شفاف‌سازی برای اپراتور: دقیقاً کدام فیلدها مانع «تکمیل نهایی» هستند؟
  // همین منطقی است که هنگام ارسال بین SAVE و COMPLETE تصمیم می‌گیرد.
  const completionBlockers = (() => {
    const requiredKeys = inputFields.filter((k) => isFieldEffectivelyRequired(k as FieldKey));
    const missing = requiredKeys.filter((k) => {
      const v = formData[k as FieldKey];
      if (fieldRegistry[k as FieldKey]?.inputType === "checkbox") return v !== true;
      return v === undefined || v === null || String(v).trim() === "";
    });
    const unticked = inputFields.filter((field) => {
      const meta = fieldRegistry[field];
      if (meta?.inputType !== "checkbox") return false;
      const dependents = getDependentFields(field as FieldKey);
      if (
        dependents.length > 0 ||
        isFieldEffectivelyRequired(field as FieldKey) ||
        chainTickKeys.has(field as FieldKey)
      ) {
        return formData[field as FieldKey] !== true;
      }
      return false;
    });
    return Array.from(new Set([...missing, ...unticked])).map(
      (k) => (fieldRegistry[k as FieldKey]?.label || k).trim()
    );
  })();

  const renderSingleCheckbox = (key: FieldKey) => {
    const meta = fieldRegistry[key];
    if (!meta || meta.inputType !== "checkbox") return null;

            const value = formData[key];
    const dependencyDisabled = isFieldDisabled(key);
    // A checkbox that was already saved as true cannot be unchecked — it's locked in.
    const isSavedTrue = initialData[key] === true;
    const disabled = dependencyDisabled || isSavedTrue;

    return (
      <label
        key={key}
        className={`flex items-center gap-3 p-4 rounded-xl border transition-all duration-300 ${
          disabled
            ? isSavedTrue
              ? "opacity-75 cursor-not-allowed bg-emerald-950/30 border-emerald-500/50 shadow-inner"
              : "opacity-50 cursor-not-allowed bg-white/5 border-white/10"
            : `cursor-pointer ${
                value
                  ? "bg-[var(--main-color)]/30 border-[var(--main-color)] shadow-md"
                  : "bg-white/5 border-white/15 hover:bg-white/10"
              }`
        }`}
      >
        <div
          className={`w-6 h-6 shrink-0 rounded-md border-2 flex items-center justify-center transition-all ${
            value
              ? "bg-[var(--main-color)] border-[var(--main-color)]"
              : isSavedTrue
              ? "border-emerald-400"
              : "border-gray-500"
          }`}
        >
          {value && (
            <div className="w-2.5 h-1.5 border-l-2 border-b-2 border-white transform -rotate-45 translate-y-[-1px]" />
          )}
        </div>
        <input
          type="checkbox"
          checked={!!value}
          disabled={disabled}
          onChange={(e) => {
            if (isSavedTrue) return; // locked — cannot uncheck a saved-true checkbox
            handleInputChange(key, e.target.checked);
          }}
          className="sr-only"
        />
        <span className="text-white font-medium text-sm select-none">
          {meta.label}
        </span>
        {isSavedTrue && (
          <span className="mr-auto text-xs text-emerald-400 font-medium shrink-0">
            ثبت شده ✓
          </span>
        )}
      </label>
    );
  };

  // ==================== رندر گروه چک‌باکس دو ستونه (مذاکره/تصویه/تایید/سند) ====================
  const renderPairedCheckboxGroup = () => {
    const keysToRender = pairedCheckboxKeys.filter((k) =>
      inputFields.includes(k)
    );
    if (keysToRender.length === 0) return null;

    return (
      <div key="paired-checkbox-group" className="mb-6">
        <div className="grid grid-cols-2 gap-3">
          {keysToRender.map((key) => renderSingleCheckbox(key))}
        </div>
      </div>
    );
  };

// ==================== رندر گروه چک‌باکس‌ها (بدون کارت) ====================
  const renderCheckboxGroup = (keys: FieldKey[]) => {
    return (
      <div key="checkbox-group" className="space-y-3 mb-6">
        {keys.map((key) => renderSingleCheckbox(key))}

        {formData["useSuggestedPrice"] && inputFields.includes("useSuggestedPrice") && (
          <div className="animate-fadeIn mt-4 pr-2">
            <div className="mb-3">
              <label className="text-sm font-medium text-gray-200 flex items-center gap-2">
                {fieldRegistry["newPrice"].label}
                <span className="text-red-400 text-xs">*</span>
              </label>
            </div>
            <InputField
              label=""
              type="text"
              ph={fieldRegistry["newPrice"].placeholder}
              val={formatNumberWithSeparator(formData["newPrice"])}
              onChange={(val: string) => {
                handleInputChange("newPrice", parseNumericInput(val));
              }}
              numeric={false}
              forceError={!!errors["newPrice"]}
            />
            {errors["newPrice"] && (
              <p className="text-red-400 text-xs mt-2">
                {errors["newPrice"]}
              </p>
            )}
          </div>
        )}
      </div>
    );
  };

  // ==================== رندر چک‌باکس با فیلدهای ورودی شرطی در یک باکس ====================
  const renderCheckboxGroupWithInputs = (parentKey: FieldKey, childKeys: FieldKey[]) => {
    const parentMeta = fieldRegistry[parentKey];
    if (!parentMeta) return null;
    const parentValue = formData[parentKey];

    return (
      <div key={`group-${parentKey}`} className="mb-6">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-3">
          {renderSingleCheckbox(parentKey)}

          {parentValue && (
            <div className="animate-fadeIn space-y-4 pr-2 border-r-2 border-[var(--main-color)]/30">
              {childKeys.map((key) => {
                const meta = fieldRegistry[key];
                if (!meta || !meta.inputType) return null;
                const value = formData[key];
                const hasError = !!errors[key];
                const isPriceField = meta.isPrice || meta.inputType === "number";

                // ==================== فیلد زمان حضور (ماه/روز + ساعت، سال خودکار) ====================
                if (key === "Time") {
                  // مقدار ترکیبی ذخیره‌شده: YYYY/MM/DD - HH:MM
                  const savedLocked = isFieldLockedBySave(key);
                  const combinedValue = value?.toString() || "";
                  const storedParts = combinedValue.split(" - ");
                  const storedDatePart = storedParts[0] || "";
                  const timeValue = storedParts[1] || "";
                  const storedSegs = storedDatePart.split("/");
                  const monthValue = storedSegs.length === 3 ? storedSegs[1] : "";
                  const dayValue = storedSegs.length === 3 ? storedSegs[2] : "";
                  const currentYear = getPersianYear();

                  // ساخت مقدار ترکیبی (سال به صورت خودکار = سال شمسی جاری)
                  const buildCombined = (m: string, d: string, t: string) => {
                    const dateStr = m || d ? `${currentYear}/${m}/${d}` : "";
                    if (dateStr && t) return `${dateStr} - ${t}`;
                    if (dateStr) return dateStr;
                    return t;
                  };
                  const isDateInvalid =
                    (monthValue !== "" || dayValue !== "") &&
                    !validateShamsiYMD(`${currentYear}/${monthValue || "00"}/${dayValue || "00"}`);

                  return (
                    <div key={key}>
                      <label className="block text-sm font-medium text-gray-200 mb-3 flex items-center gap-2">
                        {meta.label}
                        {meta.required && !savedLocked && <span className="text-red-400 text-xs">*</span>}
                        {savedLocked && (
                          <span className="text-xs text-emerald-400 font-medium">ثبت شده ✓</span>
                        )}
                      </label>
                      <div className={`bg-gradient-to-br from-[var(--main-color)]/10 to-transparent border rounded-xl p-4 space-y-3 ${savedLocked ? "border-emerald-500/50 opacity-75 pointer-events-none" : "border-white/10"}`}>
                        {/* ردیف ماه / روز */}
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs text-gray-400 mb-1.5 flex items-center gap-1.5">
                              <svg className="w-3.5 h-3.5 text-[var(--main-color)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              ماه
                            </label>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={monthValue}
                              onChange={(e) => {
                                let raw = toE(e.target.value).replace(/\D/g, "").slice(0, 2);
                                if (raw !== "" && parseInt(raw, 10) > 12) raw = "12";
                                handleInputChange(key, buildCombined(raw, dayValue, timeValue));
                              }}
                              placeholder="05"
                              maxLength={2}
                              className="w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-[var(--main-color)]/50 transition-all duration-200 text-center"
                              dir="ltr"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-gray-400 mb-1.5 flex items-center gap-1.5">
                              <svg className="w-3.5 h-3.5 text-[var(--main-color)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              روز
                            </label>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={dayValue}
                              onChange={(e) => {
                                let raw = toE(e.target.value).replace(/\D/g, "").slice(0, 2);
                                if (raw !== "" && parseInt(raw, 10) > 31) raw = "31";
                                handleInputChange(key, buildCombined(monthValue, raw, timeValue));
                              }}
                              placeholder="24"
                              maxLength={2}
                              className="w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-[var(--main-color)]/50 transition-all duration-200 text-center"
                              dir="ltr"
                            />
                          </div>
                        </div>
                        {isDateInvalid && (
                          <p className="text-red-400 text-xs">تاریخ نامعتبر (سال {currentYear} به صورت خودکار در نظر گرفته شد)</p>
                        )}

                        {/* ردیف ساعت */}
                        <div>
                          <label className="text-xs text-gray-400 mb-1.5 flex items-center gap-1.5">
                            <svg className="w-3.5 h-3.5 text-[var(--main-color)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            ساعت
                          </label>
                          <div className="relative">
                            <input
                              type="text"
                              value={timeValue}
                              onChange={(e) => {
                                const formatted = formatTimeInput(toE(e.target.value));
                                handleInputChange(key, buildCombined(monthValue, dayValue, formatted));
                              }}
                              placeholder="14:30"
                              className="w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-[var(--main-color)]/50 transition-all duration-200"
                              dir="ltr"
                            />
                            {timeValue && !validateTime(timeValue) && timeValue.length >= 5 && (
                              <p className="text-red-400 text-xs mt-1">ساعت نامعتبر (00-23:00-59)</p>
                            )}
                          </div>
                        </div>
                      </div>
                      {hasError && (
                        <p className="text-red-400 text-xs mt-2">{errors[key]}</p>
                      )}
                    </div>
                  );
                }

                if (meta.inputType === "text") {
                  const savedLocked = isFieldLockedBySave(key);
                  return (
                    <div key={key} className={savedLocked ? "opacity-75 pointer-events-none" : ""}>
                      <label className="block text-sm font-medium text-gray-200 mb-2 flex items-center gap-2">
                        {meta.label}
                        {meta.required && !savedLocked && <span className="text-red-400 text-xs">*</span>}
                        {savedLocked && <span className="text-xs text-emerald-400 font-medium">ثبت شده ✓</span>}
                      </label>
                      <InputField
                        label=""
                        type="text"
                        ph={meta.placeholder}
                        val={value?.toString() || ""}
                        onChange={(val: string) => {
                          if (savedLocked) return;
                          if (OPERATOR_PHONE_FIELDS.has(key)) handleInputChange(key, toE(val).replace(/\D/g, "").slice(0, 11));
                          else if (OPERATOR_PERSIAN_FIELDS.has(key)) handleInputChange(key, onlyPersian(val));
                          else handleInputChange(key, val);
                        }}
                        numeric={false}
                        forceError={hasError}
                      />
                      {hasError && (
                        <p className="text-red-400 text-xs mt-2">{errors[key]}</p>
                      )}
                    </div>
                  );
                }

                if (meta.inputType === "number") {
                  const savedLocked = isFieldLockedBySave(key);
                  return (
                    <div key={key} className={savedLocked ? "opacity-75 pointer-events-none" : ""}>
                      <label className="block text-sm font-medium text-gray-200 mb-2 flex items-center gap-2">
                        {meta.label}
                        {meta.required && !savedLocked && <span className="text-red-400 text-xs">*</span>}
                        {savedLocked && <span className="text-xs text-emerald-400 font-medium">ثبت شده ✓</span>}
                      </label>
                      <InputField
                        label=""
                        type="text"
                        ph={meta.placeholder}
                        val={
                          isPriceField
                            ? formatNumberWithSeparator(value)
                            : value?.toString() || ""
                        }
                        onChange={(val: string) => {
                          if (savedLocked) return;
                          if (isPriceField) handleInputChange(key, parseNumericInput(val));
                          else handleInputChange(key, val);
                        }}
                        numeric={false}
                        forceError={hasError}
                      />
                      {hasError && (
                        <p className="text-red-400 text-xs mt-2">{errors[key]}</p>
                      )}
                    </div>
                  );
                }

                return null;
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderInputField = (key: FieldKey) => {
    const meta = fieldRegistry[key];
    if (!meta || !meta.inputType) return null;
    if (key === "useSuggestedPrice") return null;

    // ==================== گروه دو ستونه: مذاکره / تصویه وجه / تایید مدارک / انتقال سند ====================
    if (pairedCheckboxKeys.includes(key)) {
      const firstPresentKey = pairedCheckboxKeys.find((k) =>
        inputFields.includes(k)
      );
      if (key !== firstPresentKey) return null; // فقط یکبار کل گروه رندر شود
      return renderPairedCheckboxGroup();
    }

    // ==================== چک‌باکس با فیلدهای زیرمجموعه: هماهنگی برای حضور ====================
    if (key === "hozor") {
      return renderCheckboxGroupWithInputs("hozor", ["Time", "location2"]);
    }

    // ==================== چک‌باکس با فیلدهای زیرمجموعه: سرمایه گزار ====================
    if (key === "sarmaye") {
      return renderCheckboxGroupWithInputs("sarmaye", ["sarmayeName", "sarmayeLName"]);
    }

    // ==================== رد شدن از فیلدهایی که داخل گروه‌ها رندر می‌شوند ====================
    if (["Time", "location2", "sarmayeName", "sarmayeLName"].includes(key)) {
      return null;
    }

    // ==================== گروه‌بندی چک‌باکس‌ها ====================
    if (key === "isAvailable") {
      const hasUseSuggested = inputFields.includes("useSuggestedPrice");
      const checkboxKeys = hasUseSuggested
        ? ["isAvailable", "useSuggestedPrice"]
        : ["isAvailable"];
      return renderCheckboxGroup(checkboxKeys);
    }

    const value = formData[key];
    const hasError = !!errors[key];
    const isPriceField = meta.isPrice || meta.inputType === "number";
    const fieldDisabled = isFieldDisabled(key) || isFieldLockedBySave(key);
    const savedLocked = isFieldLockedBySave(key);

    // ==================== تاریخ تولد خریدار (روز/ماه/سال جدا) ====================
    if (key === "BuyerBirthday") {
      // مقدار ترکیبی ذخیره‌شده: YYYY/MM/DD
      const combinedValue = value?.toString() || "";
      const segs = combinedValue.split("/");
      const yearValue = segs.length === 3 ? segs[0] : "";
      const monthValue = segs.length === 3 ? segs[1] : "";
      const dayValue = segs.length === 3 ? segs[2] : "";

      const buildCombined = (y: string, m: string, d: string) =>
        y || m || d ? `${y}/${m}/${d}` : "";

      const isDateInvalid =
        (yearValue !== "" || monthValue !== "" || dayValue !== "") &&
        !validateShamsiYMD(`${yearValue || "0000"}/${monthValue || "00"}/${dayValue || "00"}`);

      return (
        <div
          key={key}
          className={`mb-6 ${
            fieldDisabled ? "opacity-50 pointer-events-none cursor-not-allowed" : ""
          }`}
        >
                    <label className="block text-sm font-medium text-gray-200 mb-3 flex items-center gap-2">
            {meta.label}
            {isFieldEffectivelyRequired(key) && !fieldDisabled && (
              <span className="text-red-400 text-xs">*</span>
            )}
            {savedLocked && (
              <span className="text-xs text-emerald-400 font-medium">ثبت شده ✓</span>
            )}
          </label>
          <div className="bg-gradient-to-br from-[var(--main-color)]/10 to-transparent border border-white/10 rounded-xl p-4">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-gray-400 mb-1.5 flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 text-[var(--main-color)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  روز
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={dayValue}
                  disabled={fieldDisabled}
                  onChange={(e) => {
                    let raw = toE(e.target.value).replace(/\D/g, "").slice(0, 2);
                    if (raw !== "" && parseInt(raw, 10) > 31) raw = "31";
                    handleInputChange(key, buildCombined(yearValue, monthValue, raw));
                  }}
                  placeholder="12"
                  maxLength={2}
                  className={`w-full bg-white/5 border rounded-lg px-3 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none transition-all duration-200 text-center ${
                    hasError || isDateInvalid ? "border-red-500" : "border-white/15 focus:border-[var(--main-color)]/50"
                  }`}
                  dir="ltr"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1.5 flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 text-[var(--main-color)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  ماه
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={monthValue}
                  disabled={fieldDisabled}
                  onChange={(e) => {
                    let raw = toE(e.target.value).replace(/\D/g, "").slice(0, 2);
                    if (raw !== "" && parseInt(raw, 10) > 12) raw = "12";
                    handleInputChange(key, buildCombined(yearValue, raw, dayValue));
                  }}
                  placeholder="05"
                  maxLength={2}
                  className={`w-full bg-white/5 border rounded-lg px-3 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none transition-all duration-200 text-center ${
                    hasError || isDateInvalid ? "border-red-500" : "border-white/15 focus:border-[var(--main-color)]/50"
                  }`}
                  dir="ltr"
                />
              </div>
              {/* سال */}
              <div>
                <label className="text-xs text-gray-400 mb-1.5 flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 text-[var(--main-color)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  سال
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={yearValue}
                  disabled={fieldDisabled}
                  onChange={(e) => {
                    let raw = toE(e.target.value).replace(/\D/g, "").slice(0, 4);
                    if (raw !== "" && parseInt(raw, 10) > 1500) raw = "1500";
                    handleInputChange(key, buildCombined(raw, monthValue, dayValue));
                  }}
                  placeholder="1370"
                  maxLength={4}
                  className={`w-full bg-white/5 border rounded-lg px-3 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none transition-all duration-200 text-center ${
                    hasError || isDateInvalid ? "border-red-500" : "border-white/15 focus:border-[var(--main-color)]/50"
                  }`}
                  dir="ltr"
                />
              </div>
            </div>
          </div>
          {(hasError || isDateInvalid) && !fieldDisabled && (
            <p className="text-red-400 text-xs mt-2">
              {hasError
                ? errors[key]
                : "تاریخ نامعتبر است (ماه ۱-۱۲، روز متناسب با ماه، سال ۱۳۰۰-۱۵۰۰)"}
            </p>
          )}
        </div>
      );
    }

    if (meta.inputType === "date") {
      return (
        <div key={key} className={`mb-6 ${savedLocked ? "opacity-75 pointer-events-none" : ""}`}>
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-medium text-gray-200 flex items-center gap-2">
              {meta.label}
              {meta.required && !savedLocked && <span className="text-red-400 text-xs">*</span>}
              {savedLocked && <span className="text-xs text-emerald-400 font-medium">ثبت شده ✓</span>}
            </label>
          </div>
          <InputField
            label=""
            type="text"
            ph={meta.placeholder || "29/12/1405"}
            val={value?.toString() || ""}
            onChange={(val: string) => {
              if (savedLocked) return;
              const formatted = formatDateInput(val);
              handleInputChange(key, formatted);
            }}
            numeric={false}
            forceError={hasError}
          />
          {hasError && (
            <p className="text-red-400 text-xs mt-2">
              {errors[key] || "تاریخ نامعتبر است. فرمت صحیح: 29/12/1405"}
            </p>
          )}
        </div>
      );
    }

    if (meta.inputType === "textarea") {
      return (
        <div key={key} className={`mb-6 ${savedLocked ? "opacity-75 pointer-events-none" : ""}`}>
          <label className="block text-sm font-medium mb-3 text-gray-200 mt-3">
            {meta.label}
            {meta.required && !savedLocked && (
              <span className="text-red-400 mr-1 text-xs">*</span>
            )}
            {savedLocked && <span className="text-emerald-400 text-xs font-medium">ثبت شده ✓</span>}
          </label>
          <textarea
            value={value || ""}
            onChange={(e) => {
              if (savedLocked) return;
              handleInputChange(key, e.target.value);
            }}
            disabled={savedLocked}
            placeholder={meta.placeholder}
            className="w-full border rounded-xl p-4 text-white min-h-[140px] focus:outline-none transition-all duration-200 resize-none"
            style={{
              background: "rgba(255,255,255,0.05)",
              borderColor: hasError ? "#ef4444" : "rgba(255,255,255,0.15)",
            }}
            dir="rtl"
          />
          {hasError && (
            <p className="text-red-400 text-xs mt-2">{errors[key]}</p>
          )}
        </div>
      );
    }

    if (meta.inputType === "checkbox") {
      return renderSingleCheckbox(key);
    }

    return (
      <div
        key={key}
        className={`mb-6 ${
          fieldDisabled ? "opacity-50 pointer-events-none cursor-not-allowed" : ""
        } ${savedLocked && !fieldDisabled ? "opacity-75 pointer-events-none" : ""}`}
      >
        <div className="flex items-center justify-between mb-3">
          <label className="text-sm font-medium text-gray-200 flex items-center gap-2">
            {meta.label}
            {meta.required && !fieldDisabled && (
              <span className="text-red-400 text-xs">*</span>
            )}
            {savedLocked && <span className="text-xs text-emerald-400 font-medium">ثبت شده ✓</span>}
          </label>
          {isPriceField &&
            value !== "" &&
            value !== null &&
            value !== undefined && (
              <span className="text-xs text-emerald-300/80 font-medium">
                {formatPrice(value)}
              </span>
            )}
        </div>
        <InputField
          label=""
          type="text"
          ph={meta.placeholder}
          val={
            isPriceField
              ? formatNumberWithSeparator(value)
              : value?.toString() || ""
          }
          onChange={(val: string) => {
            if (fieldDisabled || savedLocked) return;
            if (isPriceField) handleInputChange(key, parseNumericInput(val));
            else if (OPERATOR_PHONE_FIELDS.has(key)) handleInputChange(key, toE(val).replace(/\D/g, "").slice(0, 11));
            else if (OPERATOR_PERSIAN_FIELDS.has(key)) handleInputChange(key, onlyPersian(val));
            else handleInputChange(key, val);
          }}
          numeric={false}
          forceError={hasError}
        />
        {hasError && <p className="text-red-400 text-xs mt-2">{errors[key]}</p>}
      </div>
    );
  };

  return (
    <div
      className="min-h-screen text-white relative overflow-x-hidden"
      style={{
        background:
          "linear-gradient(180deg, var(--main-color) 0%, var(--secondary-color) 48.56%)",
      }}
      dir="rtl"
    >
      <div
        className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full blur-[120px] opacity-10 pointer-events-none"
        style={{ background: "var(--main-color)" }}
      />

            <Navbar />

      <div className="relative z-10 max-w-5xl mx-auto px-4 py-10 md:py-14">
        <div className="flex justify-between items-center mb-8">
          <Link
            href="/operators/price-expert"
            className="text-sm text-white/60 hover:text-white transition flex items-center gap-1"
          >
            ← بازگشت به داشبورد
          </Link>
        </div>
        <div className="text-center mb-12">
          <h1 className="text-3xl md:text-4xl text-white mb-3">{stepTitle}</h1>
          <div
            className="w-24 h-1 mx-auto rounded-full"
            style={{ background: "var(--main-color)" }}
          />
        </div>

        <div className="space-y-8">
          <div className="p-6 md:p-8">
            <div className="mb-2">
              <div className=" relative">
                <h2 className="text-xl font-bold text-white">{displayTitle}</h2>
                <p className="text-xs text-white/80 mt-1">{displaySubtitle}</p>
              </div>

              {displayFields.includes("province") &&
              displayFields.includes("city") ? (
                <>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    {renderDisplayField("province")}
                    {renderDisplayField("city")}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {displayFields
                      .filter((key) => key !== "province" && key !== "city")
                      .map(renderDisplayField)}
                  </div>
                </>
              ) : (
                // حالت پیش‌فرض اگر یکی از آن‌ها نبود
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {displayFields.map(renderDisplayField)}
                </div>
              )}
            </div>

            <div className="relative flex items-center justify-center py-6">
              <div className="absolute w-full h-[1px] bg-gradient-to-r from-transparent via-white to-transparent"></div>
              <div className="relative w-2 h-2 rounded-full bg-white shadow-[0_0_10px_white] z-10"></div>
            </div>

            <div>
              <form onSubmit={handleSubmit} className="">
                {inputFields.map(renderInputField)}

                {completionBlockers.length > 0 && (
                  <div className="mt-4 mb-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-amber-200 text-sm leading-6">
                    <span className="font-bold">
                      برای تکمیل نهایی مرحله، موارد زیر باقی مانده است:{" "}
                    </span>
                    <span>{completionBlockers.join("، ")}</span>
                    <br />
                    <span className="text-xs text-amber-300/80">
                      در صورت عدم تکمیل همه موارد، اطلاعات فقط «ذخیره» می‌شود و
                      تسک در وضعیت «در حال بررسی» باقی می‌ماند.
                    </span>
                  </div>
                )}

                <div className="pt-6 flex gap-3">
                  <button
                    type="button"
                    onClick={handleCancelJob}
                    className="flex-1 bg-red-600/20 hover:bg-red-600/30 border border-red-500/50 text-red-300 hover:text-red-200 font-bold py-4 rounded-xl text-base transition-all duration-300 flex items-center justify-center"
                  >
                    <span>انصراف </span>
                  </button>

                  <button
                    type="submit"
                    disabled={okPriceBlocked}
                    className={`flex-[2] text-white font-bold py-4 rounded-xl text-base transition-all duration-300 flex items-center justify-center ${
                      okPriceBlocked
                        ? "opacity-50 cursor-not-allowed"
                        : "hover:opacity-90 hover:shadow-lg active:scale-[0.98]"
                    }`}
                    style={{ background: "#3da85f" }}
                  >
                    <span>ثبت</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>

      <ConfirmationModal
        isOpen={modalState.isOpen}
        title={
          modalState.type === "cancel" ? "انصراف از درخواست" : "تأیید ارسال"
        }
        message={
          modalState.type === "cancel"
            ? "آیا مطمئن هستید که می‌خواهید از این درخواست انصراف دهید؟ این عمل قابل بازگشت نیست."
            : "آیا از ارسال اطلاعات اطمینان دارید؟ پس از ارسال، امکان ویرایش وجود نخواهد داشت."
        }
        onConfirm={handleModalConfirm}
        onCancel={handleModalCancel}
        confirmText={
          modalState.type === "cancel" ? "بله، انصراف می‌دهم" : "تأیید و ارسال"
        }
        cancelText="بازگشت"
        type={modalState.type === "cancel" ? "danger" : "success"}
      />

      {/* ==================== CRM REJECTION MODAL (Phase 3, mandatory) ==================== */}
      <RejectionModal
        open={rejectionOpen}
        onClose={() => setRejectionOpen(false)}
        onConfirm={handleRejectionConfirm}
      />

      {/* ==================== SMS COMPOSE MODAL (price-expert/value) ==================== */}
      {smsModalOpen &&
        (() => {
          const lockedName =
            [initialData?.nm, initialData?.fm].filter(Boolean).join(" ").trim() || "مشتری";
          const lockedSim = String(
            initialData?.ph || initialData?.SaleContactNumber || "",
          ).replace(/\s/g, "");
          const priceDigits = String(
            formData["ValuePrice"] ?? initialData?.ValuePrice ?? "",
          ).replace(/[^\d]/g, "");
          const lockedPrice = priceDigits
            ? Number(priceDigits).toLocaleString("en-US")
            : "—";
          const finalMsg = `${smsSegs[0]}${lockedName}${smsSegs[1]}${lockedSim}${smsSegs[2]}${priceDigits}${smsSegs[3]}`;
          const segLabels = ["متن اول", "متن دوم", "متن سوم", "متن پایانی"];
          return (
            <div
              className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn"
              onClick={() => setSmsModalOpen(false)}
            >
              <div
                className="relative bg-[var(--secondary-color)] border border-white/20 rounded-2xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl animate-slideUp"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="text-white font-bold text-lg mb-1">ارسال پیامک</h3>
                <p className="text-white/50 text-xs mb-4">
                  گیرنده: <span dir="ltr" className="text-white/80">{smsRecipient}</span>
                  {" — "}مقادیر سبز قفل هستند و فقط متن‌ها قابل ویرایش‌اند.
                </p>

                {/* نوار مقادیر قفل */}
                <div className="grid grid-cols-3 gap-2 mb-4">
                  <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/30 px-3 py-2 text-center">
                    <p className="text-[10px] text-emerald-300/70">نام مشتری (قفل)</p>
                    <p className="text-white text-sm font-bold truncate">{lockedName}</p>
                  </div>
                  <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/30 px-3 py-2 text-center">
                    <p className="text-[10px] text-emerald-300/70">شماره سیم‌کارت (قفل)</p>
                    <p className="text-white text-sm font-bold truncate" dir="ltr">{lockedSim || "—"}</p>
                  </div>
                  <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/30 px-3 py-2 text-center">
                    <p className="text-[10px] text-emerald-300/70">قیمت (قفل)</p>
                    <p className="text-white text-sm font-bold truncate">{lockedPrice}</p>
                  </div>
                </div>

                {/* بخش‌های قابل ویرایش بین مقادیر قفل */}
                <div className="space-y-2">
                  {smsSegs.map((seg, i) => (
                    <div key={i}>
                      <label className="text-xs text-white/60 mb-1 block">{segLabels[i]}</label>
                      <textarea
                        dir="rtl"
                        rows={2}
                        value={seg}
                        onChange={(e) =>
                          setSmsSegs((prev) => prev.map((s, j) => (j === i ? e.target.value : s)))
                        }
                        className="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-[var(--main-color)]/60 resize-none"
                      />
                      {i < 2 && (
                        <div className="my-1 px-1">
                          <span className="inline-block text-[11px] text-emerald-300 bg-emerald-500/10 border border-emerald-500/40 rounded-lg px-2 py-0.5">
                            🔒 {i === 0 ? lockedName : lockedSim || "—"}
                          </span>
                        </div>
                      )}
                      {i === 2 && (
                        <div className="my-1 px-1">
                          <span className="inline-block text-[11px] text-emerald-300 bg-emerald-500/10 border border-emerald-500/40 rounded-lg px-2 py-0.5">
                            🔒 {lockedPrice}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* پیش‌نمایش نهایی */}
                <div className="mt-4 rounded-xl bg-white/5 border border-white/10 p-3">
                  <p className="text-[10px] text-white/50 mb-1">پیش‌نمایش پیامک:</p>
                  <p className="text-white/90 text-sm whitespace-pre-line" dir="rtl">{finalMsg}</p>
                </div>

                <div className="flex gap-3 mt-5">
                  <button
                    onClick={() => {
                      setSmsClicked(true); // unlock smsSent
                      window.location.href = `sms:${smsRecipient}?body=${encodeURIComponent(finalMsg)}`;
                      setSmsModalOpen(false);
                    }}
                    className="flex-1 py-2.5 text-sm font-bold bg-[#51BB70] text-[#011B2C] rounded-xl hover:bg-[#45a762] transition-all"
                  >
                    ارسال پیامک
                  </button>
                  <button
                    onClick={() => setSmsModalOpen(false)}
                    className="flex-1 py-2.5 text-sm font-bold bg-white/10 text-white rounded-xl hover:bg-white/15 transition-all"
                  >
                    انصراف
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
    </div>
  );
};

export default RoleWorkflowPage;
