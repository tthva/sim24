"use client";

import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    try {
      await fetch("/api/operator/auth", {
        method: "DELETE",
        credentials: "include",
      });
    } finally {
      router.push("/login");
    }
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      className="px-4 py-2 bg-red-600/30 hover:bg-red-600/50 text-red-400 rounded-lg transition text-sm"
    >
      خروج
    </button>
  );
}
