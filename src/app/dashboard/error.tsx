"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface DashboardErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function DashboardError({ error, reset }: DashboardErrorProps): React.ReactElement {
  React.useEffect(() => {
    console.error("[dashboard] Render error:", error.message);
  }, [error]);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-ivory px-4 py-12">
      <Card className="w-full max-w-md p-7 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-surface text-amber-text">
          <AlertTriangle className="h-6 w-6" aria-hidden="true" />
        </div>
        <h1 className="mt-4 font-serif text-2xl font-bold text-ink">
          Không thể tải không gian làm việc
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-secondary">
          Hệ thống đang gặp gián đoạn tạm thời khi tải dữ liệu thiệp cưới. Bạn vui lòng thử lại sau
          giây lát.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button type="button" onClick={() => reset()} className="min-h-[44px] motion-reduce:transition-none">
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            <span>Thử lại</span>
          </Button>
          <Link
            href="/"
            className="inline-flex min-h-[44px] items-center rounded-full border border-border-strong bg-surface px-6 text-sm font-medium text-ink transition-colors duration-200 hover:bg-blush-hover focus-visible:outline-2 focus-visible:outline-burgundy focus-visible:outline-offset-2 motion-reduce:transition-none"
          >
            Về trang chủ
          </Link>
        </div>
      </Card>
    </main>
  );
}
