export default function InvitationLoading(): React.ReactElement {
  return (
    <main
      className="flex min-h-dvh items-center justify-center bg-ivory px-5 py-16 text-ink"
      aria-busy="true"
      aria-label="Đang tải thiệp cưới"
    >
      <div className="w-full max-w-md space-y-6 text-center">
        <div className="mx-auto aspect-[3/4] w-full animate-pulse rounded-2xl bg-blush motion-reduce:animate-none" />
        <div className="mx-auto h-4 w-28 animate-pulse rounded bg-blush motion-reduce:animate-none" />
        <div className="mx-auto h-8 w-3/4 animate-pulse rounded-lg bg-blush motion-reduce:animate-none" />
        <div className="mx-auto h-4 w-1/2 animate-pulse rounded bg-blush/80 motion-reduce:animate-none" />
      </div>
    </main>
  );
}
