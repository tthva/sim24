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
  risk?: string | null;
  dueAt: string | null;
  createdAt: string;
  customerFullName: string | null;
  customerPhone: string | null;
};

const CATEGORY_TITLES = ["فروش", "تعویض", "ارزش سیم کارت", "فروش امانی"];

// Direct href map for categories (Persian title → URL)
const hrefMap: Record<string, string> = {
  "فروش": "/operators/price-expert/sell",
  "تعویض": "/operators/price-expert/switch",
  "ارزش سیم کارت": "/operators/price-expert/value",
  "فروش امانی": "/operators/price-expert/escrow",
}

// بج ریسک ضدتقلب PRICE_SEARCH (از formData.metadata.risk)
const RISK_BADGES: Record<string, string> = {
  blocked: "🔴",
  high_risk: "🔴",
  suspicious: "⚠️",
  trusted: "🟢",
};

// Map workflowCode → { section, href }
function getCategory(workflowCode: string, fallbackName: string): {
  section: string;
  href: string;
} {
  switch (workflowCode) {
    case "PRICE_SEARCH":
      return { section: "ارزش سیم کارت", href: "/operators/price-expert/value" };
    case "SELL_DIRECT":
      return { section: "فروش", href: "/operators/price-expert/sell" };
    case "SELL_MARKET_SWAP":
      return { section: "تعویض", href: "/operators/price-expert/switch" };
    case "SELL_CONSIGNMENT":
      return { section: "فروش امانی", href: "/operators/price-expert/escrow" };
    case "SIM_SWAP":
      return { section: "تعویض", href: "/operators/price-expert/switch" };
    default:
      // Handle any other SWAP-type workflow codes as "تعویض"
      if (/SWAP$/i.test(workflowCode)) {
        return { section: "تعویض", href: "/operators/price-expert/switch" };
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
      new Date(iso).toLocaleDateString("fa-IR") +
      " " +
      new Date(iso).toLocaleTimeString("fa-IR", {
        hour: "2-digit",
        minute: "2-digit",
      })
    );
  } catch {
    return iso;
  }
}

export default function PriceExpertPage() {
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
          (t: Task) => t.stepDepartment === "PRICE"
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
            title:
              (task.customerFullName || "بدون نام") +
              // بج ریسک: 🔴 بلاک/پرخطر، ⚠️ مشکوک، 🟢 مطمئن
              (task.risk && RISK_BADGES[task.risk] ? ` ${RISK_BADGES[task.risk]}` : ""),
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
        console.error("Failed to load PRICE tasks:", err);
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
      title="کارشناس قیمت"
      categories={categories}
      works={works}
      loading={loading}
    />
  );
}
    