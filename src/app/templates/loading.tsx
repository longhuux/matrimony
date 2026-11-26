export default function TemplatesLoading(): React.ReactElement {
  return (
    <div
      className="min-h-dvh bg-ivory text-ink"
      aria-busy="true"
      aria-label="Đang tải thư viện mẫu thiệp cưới"
    >
      <div className="h-[64px] border-b border-border bg-ivory/95" />

      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="mb-8 max-w-2xl space-y-3">
          <div className="h-10 w-3/4 animate-pulse rounded-xl bg-blush motion-reduce:animate-none" />
          <div className="h-5 w-full animate-pulse rounded-lg bg-blush/80 motion-reduce:animate-none" />
        </div>

        <div className="mb-10 flex gap-4 border-b border-border pb-3">
          {[1, 2, 3, 4].map((tab) => (
            <div
              key={tab}
              className="h-8 w-20 animate-pulse rounded-full bg-blush motion-reduce:animate-none"
            />
          ))}
        </div>

        <div className="grid grid-cols-1 gap-x-7 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((item) => (
            <div key={item} className="space-y-3.5">
              <div className="aspect-[3/4] w-full animate-pulse rounded-2xl bg-blush motion-reduce:animate-none" />
              <div className="flex items-center justify-between gap-2">
                <div className="h-5 w-2/3 animate-pulse rounded bg-blush motion-reduce:animate-none" />
                <div className="h-5 w-14 animate-pulse rounded-full bg-blush motion-reduce:animate-none" />
              </div>
              <div className="h-4 w-full animate-pulse rounded bg-blush/70 motion-reduce:animate-none" />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
