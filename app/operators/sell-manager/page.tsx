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

const CATEGORY_TITLES = ["خرید", "فروش", "پیش سفارش", "تعویض", "امانی", "اقساطی"];

// Direct href map for categories (Persian title → URL)
const hrefMap: Record<string, string> = {
  "خرید": "/operators/sell-manager/buy",
  "فروش": "/operators/sell-manager/sell",
  "پیش سفارش": "/operators/sell-manager/preorder",
  "تعویض": "/operators/sell-manager/switch",
  "امانی": "/operators/sell-manager/escrow",
  "اقساطی": "/operators/sell-manager/prepay",
};

// Map workflowCode → { section, href }
function getCategory(workflowCode: string, fallbackName: string): {
  section: string;
  href: string;
} {
  switch (workflowCode) {
    case "BUY_DIRECT":
      return { section: "خرید", href: "/operators/sell-manager/buy" };
    case "SELL_DIRECT":
      return { section: "فروش", href: "/operators/sell-manager/sell" };
    case "BUY_PREORDER":
      return { section: "پیش سفارش", href: "/operators/sell-manager/preorder" };
    case "SELL_MARKET_SWAP":
      return { section: "تعویض", href: "/operators/sell-manager/switch" };
    case "SELL_CONSIGNMENT":
      return { section: "امانی", href: "/operators/sell-manager/escrow" };
    case "BUY_INSTALLMENT":
      return { section: "اقساطی", href: "/operators/sell-manager/prepay" };
    default:
      // Handle any other SWAP-type workflow codes as "تعویض"
      if (/SWAP$/i.test(workflowCode)) {
        return { section: "تعویض", href: "/operators/sell-manager/switch" };
      }
      return { section: fallbackName, href: `/operators/workflow/${fallbackName}` };
  }
}

function getRoute(task: Task): string {
  const id = task.stepInstanceId;
  const { href } = getCategory(task.workflowCode, task.stepName);
  return /^\/operators\/workflow\//.test(href)
    ? `/operators/workflow/${id}`
    : `${href}?stepInstanceId=${id}`;
}

function getSection(task: Task): string {
  return getCategory(task.workflowCode, task.stepName).section;
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

export default function SellManagerPage() {
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
          (t: Task) => t.stepDepartment === "SELL"
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
        console.error("Failed to load SELL tasks:", err);
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
      title="کارشناس فروش"
      categories={categories}
      works={works}
      loading={loading}
    />
  );
}
