"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  Briefcase,
  MessageSquare,
  BarChart3,
  TrendingUp,
  ChartPie,
  FileText,
  UserCog,
  Settings,
  Bot,
  Lock,
} from "lucide-react";

export type SidebarItem = {
  label: string;
  href: string;
  icon: React.ReactNode;
  locked?: boolean;
  /**
   * Phase 4.8d-1: permission code required to SEE this item.
   * Undefined = always visible (own-work items). The admin "*"-wildcard
   * satisfies any code. Checked against GET /api/auth/permissions.
   */
  requires?: "crm.view_all" | "crm.manage";
};

export const SIDEBAR_ITEMS: SidebarItem[] = [
  // Always visible — personal (own work)
  { label: "داشبورد من", href: "/crm/my-dashboard", icon: <LayoutDashboard size={18} /> },
  { label: "مشتریان من", href: "/crm/customers?scope=mine", icon: <Users size={18} /> },
  { label: "تسک‌های من", href: "/crm/tasks?scope=mine", icon: <ClipboardList size={18} /> },
  { label: "پایپ‌لاین", href: "/crm/pipeline", icon: <Briefcase size={18} /> },
  { label: "ارتباطات من", href: "/crm/communications?scope=mine", icon: <MessageSquare size={18} /> },
  // crm.view_all — managers/admin only (global views)
  { label: "داشبورد کلان", href: "/crm", icon: <LayoutDashboard size={18} />, requires: "crm.view_all" },
  { label: "همه مشتریان", href: "/crm/customers", icon: <Users size={18} />, requires: "crm.view_all" },
  { label: "همه تسک‌ها", href: "/crm/tasks", icon: <ClipboardList size={18} />, requires: "crm.view_all" },
  { label: "همه ارتباطات", href: "/crm/communications", icon: <MessageSquare size={18} />, requires: "crm.view_all" },
  { label: "گزارش‌ها", href: "/crm/reports", icon: <TrendingUp size={18} />, requires: "crm.view_all" },
  { label: "گزارش ریجکت‌ها", href: "/crm/reports/rejections", icon: <ChartPie size={18} />, requires: "crm.view_all" },
  { label: "تحلیل‌ها", href: "/crm/analytics", icon: <BarChart3 size={18} />, requires: "crm.view_all" },
  // crm.manage — managers/admin only (settings/automation/templates)
  { label: "قالب‌ها", href: "/crm/templates", icon: <FileText size={18} />, requires: "crm.manage" },
  { label: "تنظیمات", href: "/crm/settings", icon: <Settings size={18} />, requires: "crm.manage" },
  { label: "اتوماسیون", href: "/crm/settings/automation", icon: <Bot size={18} />, requires: "crm.manage" },
  // Locked placeholder — always visible (coming soon)
  { label: "نمایندگان", href: "/crm/agents", icon: <UserCog size={18} />, locked: true },
];

/** Stable testid for a nav href: "/crm/customers?scope=mine" → crm-nav--crm-customers-scope-mine */
const navTestId = (href: string) => `crm-nav-${href.replace(/[/?=&]/g, "-")}`;

export default function CrmSidebar({
  open,
  onLockedClick,
}: {
  open: boolean;
  onLockedClick: (label: string) => void;
}) {
  const pathname = usePathname();
  // Phase 4.8d-1: permissions are NOT part of the JWT (role only), so fetch
  // them once on mount. null = loading → fail-closed (restricted items stay
  // hidden until the server answers). Fetch error → [] → restricted hidden.
  const [permissions, setPermissions] = useState<string[] | null>(null);
  // Query string used for active-state of ?scope=mine links (set post-hydration
  // to avoid SSR/client markup mismatch).
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/permissions", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled) return;
        setPermissions(d?.success && Array.isArray(d.data) ? d.data : []);
      })
      .catch(() => {
        if (!cancelled) setPermissions([]); // fail-closed
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setSearch(window.location.search);
  }, [pathname]);

  const canSee = (item: SidebarItem): boolean => {
    if (!item.requires) return true;
    if (permissions === null) return false; // loading → fail-closed
    return permissions.includes("*") || permissions.includes(item.requires);
  };

  const visibleItems = SIDEBAR_ITEMS.filter(canSee);
  // Items without a query string — used for parent/child active detection.
  const plainItems = visibleItems.filter((i) => !i.href.includes("?"));

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

        <nav className="flex flex-col gap-1 flex-1" data-testid="crm-sidebar-nav">
          {visibleItems.map((item) => {
            const [basePath, query] = item.href.split("?");
            // A parent route (/crm, /crm/reports, /crm/settings) matches exactly,
            // otherwise its own child entry would highlight the parent too.
            const hasChildRoute = plainItems.some(
              (o) => o.href !== basePath && o.href.startsWith(`${basePath}/`)
            );
            const pathMatches =
              basePath === "/crm" || hasChildRoute
                ? pathname === basePath
                : pathname.startsWith(basePath);
            // Scoped item (?scope=mine) active only when the query matches;
            // plain item not active while a scoped variant is selected.
            const queryOk = query ? search.includes(query) : !search.includes("scope=mine");
            const active = pathMatches && queryOk;
            if (item.locked) {
              return (
                <button
                  key={item.href}
                  onClick={() => onLockedClick(item.label)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-white/30 cursor-not-allowed hover:bg-white/5 transition-colors text-right"
                  data-testid={navTestId(item.href)}
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
                data-testid={navTestId(item.href)}
              >
                {item.icon}
                <span className="flex-1">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="text-white/20 text-[10px] text-center pt-4 border-t border-white/5">
          نسخه فاز ۴.۸ — داشبورد شخصی و دسترسی نقش‌محور
        </div>
      </div>
    </aside>
  );
}
