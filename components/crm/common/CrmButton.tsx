"use client";

import { ReactNode } from "react";

export default function CrmButton({
  children,
  onClick,
  variant = "primary",
  disabled,
  type = "button",
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "danger";
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
}) {
  const styles: Record<string, string> = {
    primary:
      "bg-[#51BB70] text-[#011B2C] hover:bg-[#3da85f] border-transparent",
    ghost:
      "bg-transparent text-white/80 hover:text-white hover:bg-white/10 border-white/20",
    danger:
      "bg-transparent text-[#ff7a7a] hover:bg-[#5c3232] border-[#5c3232]",
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`px-4 py-2 rounded-xl text-sm font-bold border transition-colors disabled:opacity-40 ${styles[variant]} ${className}`}
      style={{ fontFamily: "Vazirmatn, sans-serif" }}
    >
      {children}
    </button>
  );
}
