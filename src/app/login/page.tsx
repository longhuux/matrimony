import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Heart } from "lucide-react";
import { LoginForm } from "@/components/auth/login-form";
import { SITE_CONFIG } from "@/lib/site-config";
import { isGoogleOAuthConfigured } from "@/modules/auth/google";
import { getCurrentUser } from "@/modules/auth/session";

const FOCUS_RING_CLASS =
  "focus-visible:outline-2 focus-visible:outline-burgundy focus-visible:outline-offset-2";

const ATELIER_HIGHLIGHTS = [
  { label: "Zalo OG", value: "In sẵn tên từng khách" },
  { label: "LED Realtime", value: "Duyệt ảnh 1 chạm" },
  { label: "VietQR", value: "Mừng cưới 0% phí" },
] as const;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}): Promise<React.ReactElement> {
  const user = await getCurrentUser();
  if (user) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const errorMap: Record<string, string> = {
    google_not_configured: "Google OAuth chưa được cấu hình.",
    google_cancelled: "Bạn đã hủy đăng nhập Google.",
    google_failed: "Đăng nhập Google thất bại. Vui lòng thử lại hoặc dùng Email OTP.",
  };
  const initialError = params.error ? (errorMap[params.error] ?? "Đăng nhập thất bại.") : null;

  return (
    <div className="min-h-dvh bg-ivory text-ink lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:inline-flex focus:min-h-[44px] focus:items-center focus:rounded-full focus:bg-burgundy focus:px-5 focus:text-sm focus:font-semibold focus:text-ivory"
      >
        Chuyển thẳng tới nội dung chính
      </a>

      {/* Left Editorial Atelier Visual Panel */}
      <aside className="relative hidden overflow-hidden bg-stage-bg lg:flex lg:flex-col lg:justify-between">
        <Image
          src="/images/wedding/stationery-detail.webp"
          alt="Bộ thiệp cưới giấy mỹ thuật Matrimony Atelier"
          fill
          priority
          sizes="52vw"
          className="object-cover object-center"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-stage-bg via-stage-bg/65 to-stage-bg/30"
        />

        <div className="relative z-10 p-10 xl:p-14">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stage-accent">
            Matrimony Atelier
          </p>
        </div>

        <div className="relative z-10 p-10 xl:p-14">
          <h2 className="max-w-lg font-serif text-3xl font-bold leading-[1.2] tracking-[-0.02em] text-stage-text xl:text-4xl">
            Nơi từng tấm thiệp mang dấu ấn riêng của hai bạn.
          </h2>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-stage-muted">
            Soạn thiệp gọn trên điện thoại, gửi liên kết Zalo in sẵn tên từng vị khách và trình chiếu lời chúc trực tiếp lên màn hình LED sảnh tiệc.
          </p>

          <dl className="mt-8 grid max-w-lg grid-cols-3 gap-6 border-t border-stage-accent/25 pt-6">
            {ATELIER_HIGHLIGHTS.map((item) => (
              <div key={item.label}>
                <dt className="text-xs font-semibold text-stage-accent">{item.label}</dt>
                <dd className="mt-1 text-xs leading-snug text-stage-text">{item.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </aside>

      {/* Right Porcelain Form Panel */}
      <main
        id="main-content"
        className="flex min-h-dvh flex-col justify-between bg-ivory px-5 py-6 pb-[calc(2.5rem+env(safe-area-inset-bottom))] sm:px-10 lg:px-14 lg:py-10"
      >
        <div className="flex items-center justify-between gap-4">
          <Link
            href="/"
            className={`inline-flex min-h-[44px] items-center gap-2.5 rounded-full pr-2 ${FOCUS_RING_CLASS}`}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-burgundy text-ivory">
              <Heart className="h-4 w-4 fill-current" aria-hidden="true" />
            </span>
            <span className="font-serif text-xl font-bold tracking-tight text-ink">
              {SITE_CONFIG.brandName}
            </span>
          </Link>

          <Link
            href="/"
            className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-3 text-sm font-medium text-ink-secondary transition-colors duration-200 motion-reduce:transition-none hover:text-burgundy ${FOCUS_RING_CLASS}`}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>Trang chủ</span>
          </Link>
        </div>

        <div className="mx-auto my-auto w-full max-w-md py-8">
          <LoginForm googleEnabled={isGoogleOAuthConfigured()} initialError={initialError} />
        </div>

        <p className="text-center text-xs text-ink-muted">
          Xác thực không cần mật khẩu qua Google hoặc mã OTP 6 chữ số gửi về email.
        </p>
      </main>
    </div>
  );
}
