export default function EditorLoading(): React.ReactElement {
  return (
    <div
      className="flex min-h-dvh flex-col bg-ivory text-ink lg:h-dvh lg:overflow-hidden"
      aria-busy="true"
      aria-label="Đang tải không gian thiết kế thiệp cưới"
    >
      {/* Top Studio Bar Skeleton */}
      <header className="sticky top-0 z-30 border-b border-border bg-surface/95 px-3 py-2.5 backdrop-blur-md sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
            <div className="h-10 w-10 animate-pulse rounded-full bg-blush motion-reduce:animate-none sm:w-28" />
            <div className="h-9 w-40 animate-pulse rounded-xl bg-blush motion-reduce:animate-none sm:w-52" />
            <div className="hidden h-6 w-20 animate-pulse rounded-full bg-amber-surface motion-reduce:animate-none md:block" />
          </div>
          <div className="flex items-center gap-2">
            <div className="h-10 w-20 animate-pulse rounded-full bg-blush motion-reduce:animate-none" />
            <div className="hidden h-9 w-28 animate-pulse rounded-full bg-blush motion-reduce:animate-none md:block" />
            <div className="hidden h-10 w-40 animate-pulse rounded-full bg-blush motion-reduce:animate-none lg:block" />
            <div className="h-9 w-20 animate-pulse rounded-full bg-blush motion-reduce:animate-none" />
            <div className="h-9 w-32 animate-pulse rounded-full bg-burgundy/20 motion-reduce:animate-none" />
          </div>
        </div>
      </header>

      {/* Main Hybrid Split Workspace Skeleton */}
      <main className="flex min-h-0 flex-1 flex-col lg:grid lg:grid-cols-[440px_1fr] lg:overflow-hidden">
        {/* Left Control Panel Skeleton */}
        <section className="flex flex-1 flex-col border-r border-border bg-surface lg:h-full">
          <div className="grid grid-cols-4 gap-1 border-b border-border bg-ivory p-1.5">
            {[1, 2, 3, 4].map((tab) => (
              <div
                key={tab}
                className="h-12 animate-pulse rounded-xl bg-blush/80 motion-reduce:animate-none"
              />
            ))}
          </div>

          <div className="flex-1 space-y-5 overflow-y-auto p-4 pb-[calc(6rem+env(safe-area-inset-bottom))] lg:pb-8">
            <div className="flex items-center justify-between">
              <div className="h-4 w-36 animate-pulse rounded bg-blush motion-reduce:animate-none" />
              <div className="h-4 w-28 animate-pulse rounded bg-blush motion-reduce:animate-none" />
            </div>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {[1, 2, 3, 4, 5, 6].map((card) => (
                <div
                  key={card}
                  className="flex gap-3 rounded-2xl border border-border bg-surface p-3 shadow-[var(--shadow-card)]"
                >
                  <div className="h-[74px] w-14 shrink-0 animate-pulse rounded-lg bg-blush motion-reduce:animate-none" />
                  <div className="flex-1 space-y-2 py-0.5">
                    <div className="h-4 w-24 animate-pulse rounded bg-blush motion-reduce:animate-none" />
                    <div className="h-3 w-full animate-pulse rounded bg-blush/70 motion-reduce:animate-none" />
                    <div className="flex gap-1 pt-1">
                      {[1, 2, 3, 4].map((dot) => (
                        <div
                          key={dot}
                          className="h-3.5 w-3.5 animate-pulse rounded-full bg-blush motion-reduce:animate-none"
                        />
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-3 rounded-2xl border border-border bg-surface p-4">
              <div className="h-5 w-40 animate-pulse rounded bg-blush motion-reduce:animate-none" />
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {[1, 2, 3, 4, 5].map((swatch) => (
                  <div
                    key={swatch}
                    className="h-12 animate-pulse rounded-xl bg-blush/60 motion-reduce:animate-none"
                  />
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Right Live Preview Canvas Skeleton */}
        <section className="hidden flex-1 overflow-y-auto bg-blush/50 p-6 lg:block lg:h-full">
          <div className="mx-auto min-h-[680px] max-w-[390px] overflow-hidden rounded-[28px] border-8 border-ink/15 bg-surface shadow-[var(--shadow-elevated)]">
            <div className="h-72 w-full animate-pulse bg-blush motion-reduce:animate-none" />
            <div className="space-y-4 p-6 text-center">
              <div className="mx-auto h-4 w-28 animate-pulse rounded-full bg-amber-surface motion-reduce:animate-none" />
              <div className="mx-auto h-8 w-56 animate-pulse rounded-lg bg-blush motion-reduce:animate-none" />
              <div className="mx-auto h-4 w-40 animate-pulse rounded bg-blush/70 motion-reduce:animate-none" />
              <div className="mt-6 space-y-2.5 pt-4">
                <div className="h-24 w-full animate-pulse rounded-2xl bg-blush/60 motion-reduce:animate-none" />
                <div className="h-24 w-full animate-pulse rounded-2xl bg-blush/60 motion-reduce:animate-none" />
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Mobile Bottom Tab Bar Skeleton */}
      <div className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-2 gap-2 border-t border-border bg-surface/95 p-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] backdrop-blur-md lg:hidden">
        <div className="h-11 animate-pulse rounded-full bg-burgundy/20 motion-reduce:animate-none" />
        <div className="h-11 animate-pulse rounded-full bg-blush motion-reduce:animate-none" />
      </div>
    </div>
  );
}
