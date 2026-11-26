"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LogoutButton(): React.ReactElement {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleLogout(): Promise<void> {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      if (!res.ok) {
        throw new Error("Không thể đăng xuất lúc này.");
      }
      router.push("/login");
      router.refresh();
    } catch {
      setError("Đăng xuất thất bại. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="outline"
        size="sm"
        onClick={handleLogout}
        disabled={loading}
        className="min-h-[44px] motion-reduce:transition-none"
      >
        <LogOut className="h-4 w-4" aria-hidden="true" />
        <span>{loading ? "Đang thoát..." : "Đăng xuất"}</span>
      </Button>
      {error && (
        <p role="alert" className="text-xs font-medium text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
