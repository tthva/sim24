"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  Briefcase,
  MessageSquare,
  BarChart3,
  FileText,
  UserCog,
  Settings,
  Lock,
} from "lucide-react";

export type SidebarItem = {
  label: string;
  href: string;
  icon: React.ReactNode;
  locked?: boolean;
};

export const SIDEBAR_ITEMS: SidebarItem[] = [
  { label: "داشبورد", href: "/crm", icon: <LayoutDashboard size={18} /> },
  { label: "مشتریان", href: "/crm/customers", icon: <Users size={18} /> },
  { label: "تسک‌ها", href: "/crm/tasks", icon: <ClipboardList size={18} /> },
  { label: "پایپ‌لاین", href: "/crm/pipeline", icon: <Briefcase size={18} /> },
  { label: "ارتباطات", href: "/crm/communications", icon: <MessageSquare size={18} /> },
  { label: "گزارش‌ها", href: "/crm/reports/rejections", icon: <BarChart3 size={18} /> },
  { label: "قالب‌ها", href: "/crm/templates", icon: <FileText size={18} /> },
  { label: "نمایندگان", href: "/crm/agents", icon: <UserCog size={18} />, locked: true },
  { label: "تنظیمات", href: "/crm/settings", icon: <Settings size={18} /> },
];

export default function CrmSidebar({
  open,
  onLockedClick,
}: {
  open: boolean;
  onLockedClick: (label: string) => void;
}) {
  const pathname = usePathname();

  return (
    <aside
      className={`fixed lg:static top-0 right-0 h-full z-40 transition-transform duration-200 ${
        open ? "translate-x-0" : "translate-x-full lg:translate-x-0"
      }`}
      style={{ width: 280, background: "#11223d", borderLeft: "1px solid rgba(81,187,254,0.1)" }}
      dir="rtl"
    >
      <div className="flex flex-col h-full p-4">
        {/* Logo */}
        <div className="flex items-center gap-2 px-2 py-4 mb-4">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-[#011B2C] font-black"
            style={{ background: "#51BB70" }}
          >
            S
          </div>
          <div>
            <div className="text-white font-black text-lg leading-tight">SIM24 CRM</div>
            <div className="text-white/40 text-[11px]">مدیریت مشتریان</div>
          </div>
        </div>

        <nav className="flex flex-col gap-1 flex-1">
          {SIDEBAR_ITEMS.map((item) => {
            const active =
              item.href === "/crm"
                ? pathname === "/crm"
                : pathname.startsWith(item.href);
            if (item.locked) {
              return (
                <button
                  key={item.href}
                  onClick={() => onLockedClick(item.label)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-white/30 cursor-not-allowed hover:bg-white/5 transition-colors text-right"
                  data-testid={`crm-nav-${item.href.replace(/\//g, "-")}`}
                >
                  {item.icon}
                  <span className="flex-1">{item.label}</span>
                  <Lock size={13} className="text-white/25" />
                </button>
              );
            }
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors text-right ${
                  active
                    ? "text-[#011B2C] font-bold"
                    : "text-white/60 hover:text-white hover:bg-white/5"
                }`}
                style={active ? { background: "#51BB70" } : undefined}
                data-testid={`crm-nav-${item.href.replace(/\//g, "-")}`}
              >
                {item.icon}
                <span className="flex-1">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="text-white/20 text-[10px] text-center pt-4 border-t border-white/5">
          نسخه فاز ۲ — ارتباطات، قالب‌ها و تسک‌ها
        </div>
      </div>
    </aside>
  );
}
