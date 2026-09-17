"use client";
import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import AutoRefreshSession from "@/components/AutoRefreshSession";


interface NavItem {
  h: string;
  l: string;
}

const routeBasedLinks: Record<string, NavItem[]> = {
  "/operators/Investment": [
    { h: "/operators/Investment", l: "داشبورد" },
    { h: "/operators/Investment/Invest", l: "سود ثابت ماهانه" },
    { h: "/operators/Investment/Invest", l: "خرید و فروش ۰۹۱۲" },
  ],

  "/operators/product-manager": [
    { h: "/operators/product-manager", l: "داشبورد " },
    { h: "/operators/product-manager/buy", l: "خرید " },
    { h: "/operators/product-manager/installment", l: "خرید اقساطی" },
    { h: "/operators/product-manager/sell", l: "فروش" },
    { h: "/operators/product-manager/preorder", l: "پیش سفارش" },
    { h: "/operators/product-manager/escrow", l: "فروش امانی" },
    { h: "/operators/product-manager/escrow/list", l: "لیست امانی ها" },
    { h: "/operators/product-manager/f-switch", l: "تعویض مرحله 4" },
    { h: "/operators/product-manager/switch", l: "تعویض مرحله 2" },
  ],

  "/operators/sell-manager": [
    { h: "/operators/sell-manager", l: "داشبورد" },
    { h: "/operators/sell-manager/buy", l: "خرید" },
    { h: "/operators/sell-manager/sell", l: "فروش" },
    { h: "/operators/sell-manager/preorder", l: "پیش سفارش" },
    { h: "/operators/sell-manager/switch", l: "تعویض سیم کارت" },
    { h: "/operators/sell-manager/escrow", l: "فروش امانی" },
    { h: "/operators/sell-manager/Installment", l: "خرید اقساطی" },
  ],
  "/operators/price-expert": [
    { h: "/operators/price-expert", l: "داشبورد" },
    { h: "/operators/price-expert/sell", l: "فروش" },
    { h: "/operators/price-expert/switch", l: "تعویض" },
    { h: "/operators/price-expert/value", l: "ارزش سیم کارت" },
    { h: "/operators/price-expert/escrow", l: "فروش امانی" },
    { h: "/operators/price-expert/blacklist", l: "بلک‌لیست" },
    { h: "/operators/price-expert/whitelist", l: "وایت‌لیست" },
  ],
};

const defaultLinks: NavItem[] = [
  { h: "/", l: "خانه" },
  { h: "/buy", l: "خرید" },
  { h: "/sell", l: "فروش" },
];

export default function Navbar() {
  const [op, setOp] = useState(false);
  const r = useRouter();
  const pathname = usePathname();

  const getRoleFromPath = (): string => {
    if (pathname.startsWith("/operators/Investment")) return "/operators/Investment";
    if (pathname.startsWith("/operators/product-manager"))
      return "/operators/product-manager";
    if (pathname.startsWith("/operators/sell-manager"))
      return "/operators/sell-manager";
    if (pathname.startsWith("/operators/price-expert"))
      return "/operators/price-expert";
    return "default";
  };

  const currentRole = getRoleFromPath();
  const rawLinks = routeBasedLinks[currentRole] || defaultLinks;
  // Deduplicate by (href + label) — keeps both investment types even though they
  // share the same target page, and guarantees unique React keys.
  const links = Array.from(
    new Map(rawLinks.map((item) => [`${item.h}|${item.l}`, item])).values()
  );

  const roleLabels: Record<string, string> = {
    "/operators/Investment": "کارشناس سرمایه‌گذاری",
    "/operators/sell-manager": "کارشناس فروش",
    "/operators/product-manager": "کارشناس محصول",
    "/operators/price-expert": "کارشناس قیمت",
    default: "کاربر",
  };


  return (
    <>
      <AutoRefreshSession />
      <div className="px-6 pt-6 pb-2 asd">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setOp(true)}
            className="flex flex-col gap-1.5 p-1 z-10"
          >
            {[0, 1, 2].map((i) => (
              <span key={i} className="block w-7 h-0.5 bg-white rounded" />
            ))}
          </button>

          <Image
            src="/logo2.png"
            alt="SIM24"
            width={32}
            height={42}
            style={{ objectFit: "contain", display: "block" }}
          />

          <Link
            href="/"
            className="text-white/70 hover:text-white transition-colors"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M9 18l6-6-6-6" />
            </svg>
          </Link>
        </div>
        <div className="mt-3 border-b-2 border-white/30" />
      </div>

      {op && (
        <div
          className="fixed inset-0 z-50 flex"
          style={{ direction: "rtl" }}
          onClick={() => setOp(false)}
        >
          <div
            className="w-[260px] min-h-full flex flex-col py-10 px-6 gap-2 afu"
            style={{
              background: "linear-gradient(180deg,#1C3968 0%,#0a1628 100%)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-6">
              <button
                onClick={() => setOp(false)}
                className="text-white/60 hover:text-white text-xl"
              >
                ✕
              </button>
              <Image
                src="/logo2.png"
                alt="SIM24"
                width={28}
                height={36}
                style={{ objectFit: "contain" }}
              />
            </div>

            <div className="mb-4 p-3 rounded-xl bg-white/10 border border-white/20">
              <p className="text-xs text-gray-300 mb-1">پنل شما:</p>
              <p className="text-white font-bold text-sm">
                {roleLabels[currentRole]}
              </p>
            </div>

            {links.map((item, i) => (
              <Link
                key={`${item.h}|${item.l}`}
                href={item.h}
                onClick={() => setOp(false)}
                className={`text-white text-base font-medium py-3 px-4 rounded-xl text-right transition-colors hover:bg-white/10 afu d${i + 1}`}
              >
                {item.l}
              </Link>
            ))}

            <div className="mt-6 pt-6 border-t border-white/10">
              <button
                onClick={async () => {
                  setOp(false);
                  try {
                    await fetch("/api/operator/auth", { method: "DELETE", credentials: "include" });
                  } finally {
                    r.push("/login");
                  }
                }}
                className="w-full text-white/70 hover:text-red-400 text-base font-medium py-3 px-4 rounded-xl text-right transition-colors hover:bg-red-500/10"
              >
                خروج
              </button>
            </div>
          </div>
          <div className="flex-1 bg-black/50 backdrop-blur-sm" />
        </div>
      )}
    </>
  );
}
