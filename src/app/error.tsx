"use client";

import * as React from "react";
import Link from "next/link";
import { AlertCircle, Home, RotateCcw } from "lucide-react";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): React.ReactElement {
  React.useEffect(() => {
    console.error("Application error boundary:", error);
  }, [error]);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-ivory px-4 py-12 text-ink">
      <div
        role="alert"
        className="w-full max-w-md rounded-2xl border border-border bg-surface p-8 text-center shadow-[var(--shadow-card)]"
      >
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blush text-burgundy">
          <AlertCircle className="h-5 w-5" aria-hidden="true" />
        </div>
        <h1 className="mt-4 font-serif text-2xl font-bold leading-snug text-ink">
          Đã có lỗi tải trang
        </h1>
        <p className="mt-2.5 text-sm leading-relaxed text-ink-secondary">
          Hệ thống gặp sự cố tạm thời khi hiển thị nội dung. Bạn có thể thử tải lại trang ngay.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-full bg-burgundy px-5 text-sm font-semibold text-ivory transition-colors duration-200 hover:bg-burgundy-dark"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Thử lại
          </button>
          <Link
            href="/"
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full border border-border-strong bg-surface px-5 text-sm font-semibold text-ink transition-colors duration-200 hover:bg-blush-hover"
          >
            <Home className="h-4 w-4" aria-hidden="true" />
            Về trang chủ
          </Link>
        </div>
      </div>
    </main>
  );
}
