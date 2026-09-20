"use client";

import { useState } from "react";
import { Menu, Bell, LogOut } from "lucide-react";

export default function CrmTopbar({ onMenu }: { onMenu: () => void }) {
  const [notifOpen, setNotifOpen] = useState(false);

  const doLogout = () => {
    window.location.href = "/logout";
  };

  return (
    <header
      className="sticky top-0 z-30 flex items-center justify-between px-5 py-3"
      style={{ background: "rgba(10,22,40,0.85)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(81,187,254,0.1)" }}
    >
      <div className="flex items-center gap-3">
        <button
          onClick={onMenu}
          className="lg:hidden text-white/70 hover:text-white p-1"
          aria-label="منو"
        >
          <Menu size={22} />
        </button>
        <div className="text-white/50 text-xs">سیستم مدیریت ارتباط با مشتری — SIM24</div>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative">
          <button
            onClick={() => setNotifOpen((v) => !v)}
            className="text-white/70 hover:text-white p-2 rounded-xl hover:bg-white/5 relative"
            aria-label="اعلان‌ها"
            data-testid="crm-notifications"
          >
            <Bell size={19} />
            <span className="absolute top-1.5 left-1.5 w-2 h-2 rounded-full bg-[#51BB70]" />
          </button>
          {notifOpen && (
            <div
              className="absolute left-0 top-12 w-64 rounded-2xl p-3 text-sm text-white/60 shadow-2xl"
              style={{ background: "#11223d", border: "1px solid rgba(81,187,254,0.2)" }}
            >
              <div className="text-white font-bold mb-2 text-xs">اعلان‌ها</div>
              <div className="text-white/40 text-xs py-4 text-center">اعلان جدیدی وجود ندارد</div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl" style={{ background: "rgba(28,57,104,0.35)" }}>
          <div className="text-right">
            <div className="text-white text-xs font-bold" data-testid="crm-user-name">
              کاربر عملیات
            </div>
            <div className="text-white/40 text-[10px]">اپراتور</div>
          </div>
        </div>

        <button
          onClick={doLogout}
          className="text-white/50 hover:text-[#ff7a7a] p-2 rounded-xl hover:bg-white/5"
          aria-label="خروج"
          title="خروج"
        >
          <LogOut size={18} />
        </button>
      </div>
    </header>
  );
}
