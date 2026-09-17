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
  // نوع فرم سرمایه‌گذاری (از instanceData.it) — installment | buy-sell
  formType?: string | null;
};

const CATEGORY_TITLES = ["سود ثابت ماهانه", "خرید و فروش ۰۹۱۲"];

// Direct href map for categories (Persian title → URL)
const hrefMap: Record<string, string> = {
  "سود ثابت ماهانه": "/operators/Investment/Invest",
  "خرید و فروش ۰۹۱۲": "/operators/Investment/Invest",
};

// Map the investment type (it) → { section, href }
function getCategory(it: string | null | undefined): {
  section: string;
  href: string;
} {
  if (it === "installment") {
    return { section: "سود ثابت ماهانه", href: "/operators/Investment/Invest" };
  }
  if (it === "buy-sell") {
    return { section: "خرید و فروش ۰۹۱۲", href: "/operators/Investment/Invest" };
  }
  return { section: "سود ثابت ماهانه", href: "/operators/Investment/Invest" };
}

function getRoute(task: Task): string {
  const id = task.stepInstanceId;
  const { href } = getCategory(task.formType ?? null);
  return /^\/operators\/workflow\//.test(href)
    ? `/operators/workflow/${id}`
    : `${href}?stepInstanceId=${id}`;
}

function getSection(task: Task): string {
  return getCategory(task.formType ?? null).section;
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

export default function InvestmentPage() {
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
          (t: Task) => t.stepDepartment === "INVESTMENT"
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
        console.error("Failed to load INVESTMENT tasks:", err);
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
      title="مشاور سرمایه‌گذاری"
      categories={categories}
      works={works}
      loading={loading}
    />
  );
}
