"use client";
import React from "react";

interface ConfirmRowProps {
  label: string;
  value: string | number;
  isBadge?: boolean;
}

export function ConfirmRow({ label, value, isBadge = false }: ConfirmRowProps) {
  return (
    <div className="flex items-center justify-between py-3 px-4 rounded-xl bg-white/5 border border-white/5">
      <span className="text-sm text-white/60 font-medium">{label}</span>
      {isBadge ? (
        <span className="inline-flex items-center gap-2 text-sm text-acc-bright bg-acc/10 px-3 py-1 rounded-full">
          <span className="w-2 h-2 rounded-full bg-acc-bright shadow-[0_0_6px_#23E250]" />
          {value}
        </span>
      ) : (
        <span className="text-sm text-white font-medium">{value || "—"}</span>
      )}
    </div>
  );
}

interface ConfirmModalProps {
  title: string;
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  children: React.ReactNode;
}

export default function ConfirmModal({
  title,
  open,
  onClose,
  onConfirm,
  confirmLabel = "تأیید نهایی",
  cancelLabel = "انصراف",
  loading = false,
  children,
}: ConfirmModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-dark/60 backdrop-blur-sm"
      style={{ animation: "fadeIn 0.3s ease-out" }}
    >
      <div
        className="relative w-full max-w-lg mx-auto p-6 md:p-8 bg-navy-light/5 backdrop-blur-xl border border-white/20 rounded-3xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.5)] overflow-y-auto max-h-[90vh]"
        style={{ direction: "rtl" }}
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-acc">{title}</h2>
          <button
            onClick={onClose}
            disabled={loading}
            className="flex items-center gap-1 px-4 py-1.5 text-sm font-medium text-white/70 border border-white/20 rounded-full hover:text-white hover:border-acc hover:bg-white/5 transition-all"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M17 3a2.85 2.85 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
              <path d="m15 5 4 4" />
            </svg>
            ویرایش
          </button>
        </div>

        <div className="space-y-4 mb-8">{children}</div>

        <div className="flex gap-3 justify-center">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-6 py-2.5 text-sm font-medium text-white/80 border border-white/20 rounded-xl hover:bg-white/5 hover:border-white/30 transition-all disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="px-8 py-2.5 text-sm font-bold bg-acc text-prim rounded-xl shadow-[0_0_20px_rgba(81,187,112,0.3)] hover:shadow-[0_0_30px_rgba(81,187,112,0.5)] hover:bg-acc-light transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "در حال ارسال..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}