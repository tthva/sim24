"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Layout from "@/components/Layout";
import GlassCard from "@/components/GlassCard";

interface Admin {
  id: string;
  username: string;
}

export default function AdminPanelPage() {
  const router = useRouter();
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [stats, setStats] = useState({
    totalForms: 0,
    totalAgents: 0,
  });

  useEffect(() => {
    fetchAdmin();
  }, []);

  async function fetchAdmin() {
    try {
      const res = await fetch("/api/admin/agents/me", { credentials: "include" });
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      if (!res.ok) throw new Error("خطا در دریافت اطلاعات");
      const data = await res.json();
            setAdmin(data.admin || { id: "", username: "Admin" });
      
      // Try to fetch stats
      try {
        const formsRes = await fetch("/api/admin/forms", { credentials: "include" });
        if (formsRes.ok) {
          const formsData = await formsRes.json();
          setStats((prev) => ({ ...prev, totalForms: formsData.forms?.length || 0 }));
        }
      } catch {}
    } catch (err: any) {
      setError(err.message);
      router.push("/login");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    try {
      await fetch("/api/operator/auth", {
        method: "DELETE",
        credentials: "include",
      });
      router.push("/login");
    } catch (err) {
      console.error("Logout error:", err);
    }
  }

  if (loading) {
    return (
      <Layout
        wide
        ch={
          <div className="flex flex-1 justify-center items-center text-white">
            در حال بارگذاری...
          </div>
        }
      />
    );
  }

  if (error || !admin) {
    return (
      <Layout
        wide
        ch={
          <div className="flex flex-col flex-1 justify-center items-center px-8 gap-4">
            <div className="text-red-400 text-center">{error || "خطای نامشخص"}</div>
            <button
              onClick={() => router.push("/login")}
              className="ba"
            >
              بازگشت به ورود
            </button>
          </div>
        }
      />
    );
  }

  return (
    <Layout
      wide
      ch={
        <div className="flex flex-col flex-1 px-6 py-8 gap-6">
          <GlassCard
            cls="w-full p-6"
            ch={
              <div className="flex justify-between items-center">
                <div>
                  <h1 className="text-white text-3xl font-bold">🎛️ پنل ادمین</h1>
                  <p className="text-white/60 mt-1">
                    خوش آمدید، {admin.username}
                  </p>
                </div>
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 bg-red-600/30 hover:bg-red-600/50 text-red-400 rounded-lg transition text-sm"
                >
                  خروج
                </button>
              </div>
            }
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <Link href="/admin/panel/forms">
              <GlassCard
                cls="w-full p-6 cursor-pointer hover:border-blue-500/50 transition h-full"
                ch={
                  <div>
                    <div className="text-4xl mb-3">📋</div>
                    <h2 className="text-xl font-bold text-white">
                      همه فرم‌های ثبت شده
                    </h2>
                    <p className="text-white/600 text-2xl mt-4 font-bold">
                      {stats.totalForms}
                    </p>
                    <p className="text-white/60 text-sm">فرم کل</p>
                  </div>
                }
              />
            </Link>

            <Link href="/admin/panel/agents">
              <GlassCard
                cls="w-full p-6 cursor-pointer hover:border-green-500/50 transition h-full"
                ch={
                  <div>
                    <div className="text-4xl mb-3">👥</div>
                    <h2 className="text-xl font-bold text-white">
                      مدیریت نمایندگان
                    </h2>
                    <p className="text-white/60 mt-2">
                      مشاهده و مدیریت تمام نمایندگان سیستم
                    </p>
                  </div>
                }
              />
            </Link>

            <Link href="/admin/panel/monitoring">
              <GlassCard
                cls="w-full p-6 cursor-pointer hover:border-purple-500/50 transition h-full"
                ch={
                  <div>
                    <div className="text-4xl mb-3">📊</div>
                    <h2 className="text-xl font-bold text-white">
                      مانیتورینگ سیستم
                    </h2>
                    <p className="text-white/60 mt-2">
                      مشاهده آمار فرم‌ها، workflowها و تسک‌های در انتظار
                    </p>
                  </div>
                }
              />
            </Link>

            <Link href="/admin/panel/workflows">
              <GlassCard
                cls="w-full p-6 cursor-pointer hover:border-orange-500/50 transition h-full"
                ch={
                  <div>
                    <div className="text-4xl mb-3">⚙️</div>
                    <h2 className="text-xl font-bold text-white">
                      مدیریت ورک‌فلوها
                    </h2>
                    <p className="text-white/60 mt-2">
                      مشاهده جزئیات و مراحل ورک‌فلوهای در حال اجرا
                    </p>
                  </div>
                }
              />
            </Link>
          </div>
        </div>
      }
    />
  );
}
