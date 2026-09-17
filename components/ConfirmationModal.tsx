"use client";

import React from "react";

interface SuccessModalProps {
  isOpen: boolean;
  requestId?: string;
  onClose: () => void;
  title?: string;
  message?: string;
  variant?: "success" | "error";
}

const SuccessConfirmationModal: React.FC<SuccessModalProps> = ({
  isOpen,
  requestId,
  onClose,
  title = "درخواست با موفقیت ثبت شد",
  message = "درخواست شما با موفقیت ثبت گردید و در اسرع وقت توسط کارشناسان ما بررسی خواهد شد. برای پیگیری‌های بعدی، شماره زیر را نزد خود نگه دارید.",
  variant = "success",
}) => {
  if (!isOpen) return null;

  const isError = variant === "error";

  // رنگ‌ها بر اساس حالت
  const iconColor = isError ? "text-red-500" : "text-emerald-500";
  const iconBg = isError ? "bg-red-500/10" : "bg-emerald-500/10";
  const iconPing = isError ? "bg-red-500/20" : "bg-emerald-500/20";
  const iconDropShadow = isError
    ? "drop-shadow-[0_0_10px_rgba(239,68,68,0.8)]"
    : "drop-shadow-[0_0_10px_rgba(16,185,129,0.8)]";
  const requestIdColor = isError ? "text-red-400" : "text-emerald-400";
  const buttonClass = isError
    ? "bg-red-600 hover:bg-red-700 shadow-red-500/20"
    : "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-fadeIn" dir="rtl">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div className="relative bg-[var(--secondary-color)] border border-white/20 rounded-2xl p-6 md:p-8 max-w-md w-full shadow-2xl animate-slideUp">
        
        {/* Animated Icon */}
        <div className="flex justify-center mb-6">
          <div className={`w-20 h-20 rounded-full ${iconBg} flex items-center justify-center relative`}>
            {/* Ping Animation */}
            <div className={`absolute inset-0 rounded-full ${iconPing} animate-ping`} />
            
            {/* Icon (SVG) */}
            <svg 
              className={`w-10 h-10 ${iconColor} relative z-10 ${iconDropShadow}`} 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              {isError ? (
                <>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 6l12 12" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M18 6L6 18" />
                </>
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              )}
            </svg>
          </div>
        </div>

        {/* Text Content */}
        <h3 className="text-xl font-bold text-white text-center mb-3">
          {title}
        </h3>
        <p className="text-gray-300 text-center mb-6 leading-relaxed text-sm md:text-base">
          {message}
        </p>

        {/* Request ID Box */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-8 flex flex-col items-center justify-center gap-1">
          <span className="text-gray-400 text-xs md:text-sm">
            {isError ? "شناسه خطا:" : "شماره پیگیری درخواست:"}
          </span>
          <span 
            className={`${requestIdColor} font-mono font-bold text-xl tracking-wider select-all`} 
            dir="ltr"
          >
            {requestId || "—"}
          </span>
        </div>

        {/* Action Button */}
        <button
          onClick={onClose}
          className={`w-full ${buttonClass} active:scale-[0.98] text-white font-bold py-3.5 rounded-xl transition-all duration-200 shadow-lg`}
        >
          {isError ? "بازگشت" : "متوجه شدم / بازگشت"}
        </button>
      </div>

      {/* Animations */}
      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
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
          animation: fadeIn 0.2s ease-out forwards;
        }
        .animate-slideUp {
          animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
    </div>
  );
};

export default SuccessConfirmationModal;

