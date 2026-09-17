"use client";

import useSWR from "swr";
import DepartmentDashboard, { DepartmentCode } from "./DepartmentDashboard";

const fetcher = async (url: string) => {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) {
    const error = new Error(`API error: ${res.status}`);
    (error as any).status = res.status;
    throw error;
  }
  const json = await res.json();
  if (!json.success) {
    const error = new Error(json.message || "API error");
    throw error;
  }
  return json;
};

export default function TasksProvider({
  department,
}: {
  department: DepartmentCode;
}) {
  const { data, error, isLoading } = useSWR("/api/workflow/tasks", fetcher, {
    refreshInterval: 30000, // 30 seconds polling
    revalidateOnFocus: true,
  });

  // Filter tasks by department (API already returns only this operator's tasks,
  // but we filter by department for UI grouping)
  const tasks = (data?.data ?? []).filter(
    (t: any) => t.stepDepartment === department
  );

  // Keep stale data visible on error (SWR keeps last data via `data`),
  // but still show error message
  return (
    <DepartmentDashboard
      department={department}
      tasks={tasks}
      loading={isLoading}
      error={error ? "خطا در دریافت وظایف" : null}
    />
  );
}
