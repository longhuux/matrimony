export default function StageLoading(): React.ReactElement {
  return (
    <div
      className="flex min-h-dvh w-full flex-col bg-stage-bg pb-[calc(1.5rem+env(safe-area-inset-bottom))] text-stage-text"
      aria-busy="true"
      aria-label="Đang tải màn hình LED"
    >
      {/* Top Stage Header Skeleton */}
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-stage-text/10 px-6 py-4 lg:px-10">
        <div className="flex items-center gap-3">
          <div className="h-7 w-28 animate-pulse rounded-full bg-stage-accent/20 motion-reduce:animate-none" />
          <div className="h-8 w-56 animate-pulse rounded-lg bg-stage-text/10 motion-reduce:animate-none sm:w-72" />
        </div>
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-32 animate-pulse rounded-full bg-stage-surface motion-reduce:animate-none" />
          <div className="hidden h-11 w-72 animate-pulse rounded-full bg-stage-surface motion-reduce:animate-none sm:block" />
        </div>
      </header>

      {/* Main 16:9 Stage Content Skeleton */}
      <main className="mx-auto grid w-full max-w-[1600px] flex-1 grid-cols-1 gap-6 px-6 py-6 lg:grid-cols-12 lg:px-10 lg:py-8">
        {/* Hero Spotlight Skeleton */}
        <section className="flex flex-col justify-between rounded-3xl border border-stage-accent/25 bg-stage-surface p-6 shadow-[var(--shadow-elevated)] sm:p-8 lg:col-span-8">
          <div className="flex items-center justify-between">
            <div className="h-8 w-24 animate-pulse rounded-full bg-stage-bg motion-reduce:animate-none" />
            <div className="flex items-center gap-2">
              <div className="h-4 w-12 animate-pulse rounded bg-stage-text/10 motion-reduce:animate-none" />
              <div className="h-11 w-11 animate-pulse rounded-full bg-stage-bg motion-reduce:animate-none" />
              <div className="h-11 w-11 animate-pulse rounded-full bg-stage-bg motion-reduce:animate-none" />
            </div>
          </div>

          <div className="my-8 grid items-center gap-6 md:grid-cols-12">
            <div className="aspect-[4/3] w-full animate-pulse rounded-2xl bg-stage-bg motion-reduce:animate-none md:col-span-6" />
            <div className="space-y-4 md:col-span-6">
              <div className="h-8 w-full animate-pulse rounded-lg bg-stage-text/10 motion-reduce:animate-none" />
              <div className="h-8 w-5/6 animate-pulse rounded-lg bg-stage-text/10 motion-reduce:animate-none" />
              <div className="h-8 w-2/3 animate-pulse rounded-lg bg-stage-text/10 motion-reduce:animate-none" />
              <div className="mt-6 h-5 w-40 animate-pulse rounded bg-stage-accent/20 motion-reduce:animate-none" />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <div className="h-1.5 w-7 animate-pulse rounded-full bg-stage-accent/30 motion-reduce:animate-none" />
            <div className="h-1.5 w-2.5 animate-pulse rounded-full bg-stage-text/15 motion-reduce:animate-none" />
            <div className="h-1.5 w-2.5 animate-pulse rounded-full bg-stage-text/15 motion-reduce:animate-none" />
          </div>
        </section>

        {/* Right Column: Live Wish Ticker + QR Card Skeleton */}
        <aside className="flex flex-col justify-between gap-5 lg:col-span-4">
          <div className="flex flex-1 flex-col rounded-3xl border border-stage-text/12 bg-stage-surface p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="h-6 w-36 animate-pulse rounded bg-stage-text/10 motion-reduce:animate-none" />
              <div className="h-6 w-20 animate-pulse rounded-full bg-stage-accent/20 motion-reduce:animate-none" />
            </div>
            <div className="space-y-3">
              <div className="h-20 w-full animate-pulse rounded-2xl bg-stage-bg/70 motion-reduce:animate-none" />
              <div className="h-20 w-full animate-pulse rounded-2xl bg-stage-bg/70 motion-reduce:animate-none" />
              <div className="h-20 w-full animate-pulse rounded-2xl bg-stage-bg/70 motion-reduce:animate-none" />
            </div>
          </div>

          <div className="flex items-center gap-4 rounded-3xl border border-stage-accent/25 bg-stage-surface p-4 shadow-[var(--shadow-elevated)]">
            <div className="h-28 w-28 shrink-0 animate-pulse rounded-2xl bg-stage-text/15 motion-reduce:animate-none sm:h-32 sm:w-32" />
            <div className="flex-1 space-y-2.5">
              <div className="h-4 w-32 animate-pulse rounded bg-stage-accent/20 motion-reduce:animate-none" />
              <div className="h-6 w-44 animate-pulse rounded bg-stage-text/10 motion-reduce:animate-none" />
              <div className="h-4 w-full animate-pulse rounded bg-stage-text/10 motion-reduce:animate-none" />
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}
