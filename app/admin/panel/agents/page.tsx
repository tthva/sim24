"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Layout from "@/components/Layout";
import GlassCard from "@/components/GlassCard";
import FieldSet from "@/components/FieldSet";

type Agent = {
  id: string;
  username: string;
  createdAt: string;
  _count: { forms: number };
};

export default function AdminAgentsPage() {
  const r = useRouter();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    fetchAgents();
  }, []);

  const fetchAgents = async () => {
    try {
      const res = await fetch("/api/admin/agents", { credentials: "include" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setAgents(data.agents);
    } catch {
      r.replace("/admin/login");
    } finally {
      setLoading(false);
    }
  };

  const handleAddAgent = async () => {
    setError("");
    setSuccess("");
    if (!newUsername || !newPassword || newPassword.length < 4) {
      setError("نام کاربری و رمز عبور (حداقل ۴ کاراکتر) الزامی است");
      return;
    }
    try {
      const res = await fetch("/api/admin/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: newUsername, password: newPassword }),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "خطا در ایجاد نماینده");
        return;
      }
      setSuccess(`نماینده "${newUsername}" با موفقیت ایجاد شد`);
      setNewUsername("");
      setNewPassword("");
      setShowAdd(false);
      fetchAgents();
    } catch {
      setError("خطا در ارتباط با سرور");
    }
  };

  const handleDeleteAgent = async (id: string, username: string) => {
    if (!confirm(`آیا از حذف نماینده "${username}" اطمینان دارید؟`)) return;
    try {
      const res = await fetch(`/api/admin/agents/${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error();
      setSuccess(`نماینده "${username}" حذف شد`);
      fetchAgents();
    } catch {
      setError("خطا در حذف نماینده");
    }
  };

  if (loading) {
    return (
      <Layout wide ch={<div className="flex flex-1 justify-center items-center text-white">در حال بارگذاری...</div>} />
    );
  }

  return (
    <Layout wide ch={
      <div className="flex flex-col flex-1 px-6 py-8 gap-6">
        <GlassCard cls="w-full p-6" ch={
          <div className="flex justify-between items-center">
            <h1 className="text-white text-xl font-bold">👥 مدیریت نمایندگان</h1>
            <button onClick={() => r.back()} className="text-white/60 text-sm">بازگشت</button>
          </div>
        } />

        {/* Add Agent Form */}
        {showAdd && (
          <GlassCard cls="w-full p-6" ch={
            <div className="flex flex-col gap-4">
              <h2 className="text-white text-lg font-bold">افزودن نماینده جدید</h2>
              <FieldSet label="نام کاربری" value={newUsername}
                onChange={(e) => setNewUsername(e.target.value.replace(/\s/g, ""))}
                dir="rtl" placeholder="username" />
              <FieldSet label="رمز عبور" type="password" value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                dir="rtl" placeholder="حداقل ۴ کاراکتر" />
              {error && <div className="text-red-400 text-xs text-right">{error}</div>}
              {success && <div className="text-[#51BB70] text-xs text-right">{success}</div>}
              <div className="flex gap-2">
                <button onClick={handleAddAgent} className="ba flex-1">ذخیره</button>
                <button onClick={() => { setShowAdd(false); setError(""); setSuccess(""); }}
                  className="bg-white/10 hover:bg-white/20 text-white flex-1 rounded-xl p-2 transition">
                  انصراف
                </button>
              </div>
            </div>
          } />
        )}

        {/* Add Agent Button */}
        {!showAdd && (
          <button onClick={() => setShowAdd(true)} className="ba w-full">
            + افزودن نماینده جدید
          </button>
        )}

        {/* Agents List */}
        <GlassCard cls="w-full p-6 flex-1" ch={
          <div className="overflow-x-auto">
            <table className="w-full text-white/80">
              <thead>
                <tr className="border-b border-white/20">
                  <th className="text-right p-3">نام کاربری</th>
                  <th className="text-right p-3">فرم‌ها</th>
                  <th className="text-right p-3">تاریخ ایجاد</th>
                  <th className="text-center p-3">عملیات</th>
                </tr>
              </thead>
              <tbody>
                {agents.map((agent) => (
                  <tr key={agent.id} className="border-b border-white/10 hover:bg-white/5">
                    <td className="p-3 font-medium text-white">{agent.username}</td>
                    <td className="p-3">{agent._count.forms}</td>
                    <td className="p-3">{new Date(agent.createdAt).toLocaleDateString("fa-IR")}</td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => handleDeleteAgent(agent.id, agent.username)}
                        className="text-red-400 hover:text-red-300 text-sm px-3 py-1 rounded bg-red-400/10 hover:bg-red-400/20 transition"
                      >
                        حذف
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {agents.length === 0 && (
              <div className="text-white/50 text-center py-10">هیچ نماینده‌ای ثبت نشده</div>
            )}
          </div>
        } />
      </div>
    } />
  );
}