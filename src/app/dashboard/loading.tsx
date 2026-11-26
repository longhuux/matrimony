import { Card } from "@/components/ui/card";

export default function DashboardLoading(): React.ReactElement {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Đang tải không gian làm việc"
      className="min-h-dvh bg-ivory"
    >
      <span className="sr-only">Đang tải dữ liệu bảng điều khiển...</span>
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 animate-pulse rounded-full bg-border motion-reduce:animate-none" />
            <div className="h-5 w-28 animate-pulse rounded-md bg-border motion-reduce:animate-none" />
          </div>
          <div className="h-11 w-28 animate-pulse rounded-full bg-border motion-reduce:animate-none" />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="h-8 w-64 animate-pulse rounded-lg bg-border motion-reduce:animate-none" />
            <div className="h-4 w-80 max-w-full animate-pulse rounded-md bg-blush motion-reduce:animate-none" />
          </div>
          <div className="h-11 w-32 animate-pulse rounded-full bg-blush motion-reduce:animate-none" />
        </div>

        {/* Hairline Quick-Action Strip Skeleton */}
        <div className="mb-8 grid divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface shadow-[var(--shadow-card)] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {[0, 1, 2].map((item) => (
            <div key={item} className="space-y-2 p-5">
              <div className="h-4 w-36 animate-pulse rounded bg-border motion-reduce:animate-none" />
              <div className="h-3.5 w-48 max-w-full animate-pulse rounded bg-blush motion-reduce:animate-none" />
            </div>
          ))}
        </div>

        {/* 6-Cell Atelier Ledger Skeleton */}
        <div className="mb-10 grid gap-px overflow-hidden rounded-2xl border border-border bg-border shadow-[var(--shadow-card)] sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((item) => (
            <div key={item} className="bg-surface p-5">
              <div className="flex items-center justify-between">
                <div className="h-4 w-32 animate-pulse rounded bg-blush motion-reduce:animate-none" />
                <div className="h-4 w-4 animate-pulse rounded bg-border motion-reduce:animate-none" />
              </div>
              <div className="mt-3 h-7 w-24 animate-pulse rounded-md bg-border motion-reduce:animate-none" />
              <div className="mt-3 h-2 w-full animate-pulse rounded-full bg-blush motion-reduce:animate-none" />
            </div>
          ))}
        </div>

        <div className="mb-4 h-6 w-52 animate-pulse rounded-md bg-border motion-reduce:animate-none" />
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1].map((item) => (
            <Card key={item} className="p-5">
              <div className="h-5 w-48 animate-pulse rounded bg-border motion-reduce:animate-none" />
              <div className="mt-2 h-3.5 w-36 animate-pulse rounded bg-blush motion-reduce:animate-none" />
              <div className="mt-5 h-11 w-full animate-pulse rounded-full bg-blush motion-reduce:animate-none" />
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
