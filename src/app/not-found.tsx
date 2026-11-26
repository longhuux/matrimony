import Link from "next/link";
import { ArrowRight, Heart } from "lucide-react";

export default function NotFound(): React.ReactElement {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-ivory px-4 py-12 text-ink">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-8 text-center shadow-[var(--shadow-card)]">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blush text-burgundy">
          <Heart className="h-5 w-5" aria-hidden="true" />
        </div>
        <p className="mt-4 font-mono text-xs font-semibold text-burgundy">404</p>
        <h1 className="mt-2 font-serif text-3xl font-bold leading-tight text-ink">
          Không tìm thấy trang bạn cần
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-secondary">
          Đường dẫn thiệp cưới hoặc trang bạn vừa mở có thể đã đổi tên hoặc không còn hiển thị công khai.
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/"
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full bg-burgundy px-6 text-sm font-semibold text-ivory transition-colors duration-200 hover:bg-burgundy-dark"
          >
            Về trang chủ
          </Link>
          <Link
            href="/templates"
            className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-full border border-border-strong bg-surface px-5 text-sm font-semibold text-ink transition-colors duration-200 hover:bg-blush-hover"
          >
            <span>Xem mẫu thiệp</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </main>
  );
}
