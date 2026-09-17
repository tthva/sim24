"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import AgentDashboard, {
  CategoryItem,
  WorkItem,
} from "@/components/AgentDashboard";

type Task = {
  stepInstanceId: string;
  workflowCode: string;
  workflowTitle: string;
  stepName: string;
  stepDepartment: string;
  stepOrder: number;
  formSchema: unknown;
  allowedActions: string[];
  instanceStatus: string;
  stepStatus: string;
  stageProgress: string | null;
  dueAt: string | null;
  createdAt: string;
  customerFullName: string | null;
  customerPhone: string | null;
};

const CATEGORY_TITLES = ["خرید", "خرید اقساطی", "فروش", "پیش سفارش", "تعویض", "تعویض مرحله 4", "امانی"];

// Direct href map for categories (Persian title → URL)
const hrefMap: Record<string, string> = {
  "خرید": "/operators/product-manager/buy",
  "خرید اقساطی": "/operators/product-manager/installment",
  "فروش": "/operators/product-manager/sell",
  "پیش سفارش": "/operators/product-manager/preorder",
  "تعویض": "/operators/product-manager/switch",
  "تعویض مرحله 4": "/operators/product-manager/f-switch",
  "امانی": "/operators/product-manager/escrow",
}

// Map workflowCode + step info → { section, href }
// SELL_MARKET_SWAP has THREE PRODUCT steps (5-step flow):
//   step 2 «بررسی محصول»           → /switch   (stage 2 — خط دلخواه)
//   step 4 «حذف از سایت»           → /switch   (stage 4 — خط دلخواه، Avablity)
//   step 5 «نهایی‌سازی تعویض/فروش» → /f-switch (stage 5 — خط فروخته شده)
// so the routing must consider stepOrder/stepName, not just workflowCode.
function getCategory(
  workflowCode: string,
  fallbackName: string,
  stepOrder?: number,
  stepName?: string
): {
  section: string;
  href: string;
} {
  // Finalize stage of swap workflows: «نهایی‌سازی تعویض/فروش» (stepOrder 5, isFinal)
  const isSwapFinalize =
    stepOrder === 5 || (stepName ?? fallbackName).includes("نهایی");
  const swapRoute = isSwapFinalize
    ? { section: "تعویض مرحله 4", href: "/operators/product-manager/f-switch" }
    : { section: "تعویض", href: "/operators/product-manager/switch" };

  switch (workflowCode) {
    case "BUY_DIRECT":
      return { section: "خرید", href: "/operators/product-manager/buy" };
    case "BUY_INSTALLMENT":
      return { section: "خرید اقساطی", href: "/operators/product-manager/installment" };
    case "BUY_PREORDER":
      return { section: "پیش سفارش", href: "/operators/product-manager/preorder" };
    case "SELL_DIRECT":
      return { section: "فروش", href: "/operators/product-manager/sell" };
    case "SELL_MARKET_SWAP":
      return swapRoute;
    case "SELL_CONSIGNMENT":
      return { section: "امانی", href: "/operators/product-manager/escrow" };
    default:
      // Handle any other SWAP-type workflow codes as "تعویض"
      if (/SWAP$/i.test(workflowCode)) {
        return swapRoute;
      }
      return { section: fallbackName, href: `/operators/workflow/${fallbackName}` };
  }
}

function getRoute(task: Task): string {
  const id = task.stepInstanceId;
  const { href } = getCategory(task.workflowCode, task.stepName, task.stepOrder, task.stepName);
  return /^\/operators\/workflow\//.test(href)
    ? `/operators/workflow/${id}`
    : `${href}?stepInstanceId=${id}`;
}

function getSection(task: Task): string {
  return getCategory(task.workflowCode, task.stepName, task.stepOrder, task.stepName).section;
}

function formatDate(iso: string): string {
  try {
    return (
      new Date(iso).toLocaleDateString("fa-IR", { timeZone: "Asia/Tehran" }) +
      " " +
      new Date(iso).toLocaleTimeString("fa-IR", {
        timeZone: "Asia/Tehran",
        hour: "2-digit",
        minute: "2-digit",
      })
    );
  } catch {
    return iso;
  }
}

export default function ProductManagerPage() {
  const [works, setWorks] = useState<WorkItem[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadTasks() {
      try {
        const res = await fetch("/api/workflow/tasks", {
          credentials: "include",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const payload = await res.json();
        const tasks: Task[] = (payload?.data ?? []).filter(
          (t: Task) => t.stepDepartment === "PRODUCT"
        );

        if (cancelled) return;

        const statusMap: Record<string, string> = {
          IN_PROGRESS: "در حال بررسی",
          ASSIGNED: "در انتظار",
          COMPLETED: "تکمیل شده",
          PENDING: "در انتظار",
        };

        setWorks(
          tasks.map((task) => ({
            id: task.stepInstanceId,
            title: task.customerFullName || "بدون نام",
            section: getSection(task),
            status:
          (statusMap[task.stepStatus || task.instanceStatus] || task.stepStatus || task.instanceStatus) +
          (task.stepStatus === "IN_PROGRESS" && task.stageProgress ? ` (${task.stageProgress})` : ""),
            phone: task.customerPhone || "—",
            date: formatDate(task.createdAt),
            href: getRoute(task),
          }))
        );

        setCategories(
          CATEGORY_TITLES.map((title) => ({
            title,
            count: tasks.filter((t) => getSection(t) === title).length,
            href: hrefMap[title],
          }))
        );
      } catch (err) {
        console.error("Failed to load PRODUCT tasks:", err);
        if (!cancelled) {
          setWorks([]);
          setCategories([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadTasks();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AgentDashboard
      title="کارشناس محصول"
      categories={categories}
      works={works}
      loading={loading}
    />
  );
}
