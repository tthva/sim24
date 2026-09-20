"use client";

import { ReactNode, useEffect, useState } from "react";
import CrmSidebar from "@/components/crm/Layout/CrmSidebar";
import CrmTopbar from "@/components/crm/Layout/CrmTopbar";

export default function CrmLayout({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  const handleLocked = (label: string) => setToast(`بخش «${label}» به‌زودی فعال می‌شود`);

  return (
    <div
      dir="rtl"
      className="font-vazir flex min-h-screen"
      style={{
        fontFamily: "Vazirmatn, sans-serif",
        background: "#0a1628",
        color: "#fff",
      }}
    >
      {/* Desktop sidebar (right side) */}
      <div className="hidden lg:block shrink-0" style={{ width: 280 }}>
        <CrmSidebar open onLockedClick={handleLocked} />
      </div>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-30 bg-black/50" onClick={() => setMobileOpen(false)} />
      )}
      <div className="lg:hidden">
        <CrmSidebar open={mobileOpen} onLockedClick={handleLocked} />
      </div>

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0">
        <CrmTopbar onMenu={() => setMobileOpen((v) => !v)} />
        <main className="flex-1 p-5" data-testid="crm-main">
          {children}
        </main>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl text-sm text-white shadow-2xl"
          style={{ background: "#11223d", border: "1px solid rgba(81,187,112,0.5)" }}
          data-testid="crm-toast"
        >
          {toast}
        </div>
      )}
    </div>
  );
}
