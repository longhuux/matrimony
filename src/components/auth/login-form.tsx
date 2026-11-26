"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Mail, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface LoginFormProps {
  googleEnabled: boolean;
  initialError?: string | null;
}

const FOCUS_RING_CLASS =
  "focus-visible:outline-2 focus-visible:outline-burgundy focus-visible:outline-offset-2";

export function LoginForm({ googleEnabled, initialError }: LoginFormProps): React.ReactElement {
  const router = useRouter();
  const [step, setStep] = React.useState<"email" | "otp">("email");
  const [email, setEmail] = React.useState("");
  const [code, setCode] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(initialError ?? null);
  const [info, setInfo] = React.useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = React.useState(0);

  React.useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setTimeout(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [resendCooldown]);

  async function requestOtp(fallbackMessage: string): Promise<void> {
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/otp/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json()) as { ok?: boolean; message?: string; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Không thể gửi mã OTP.");
        return;
      }
      setInfo(data.message ?? fallbackMessage);
      setStep("otp");
      setResendCooldown(30);
    } catch {
      setError("Lỗi kết nối máy chủ. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRequestOtp(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    await requestOtp("Mã OTP đã được gửi.");
  }

  async function handleResendOtp(): Promise<void> {
    if (resendCooldown > 0 || loading) return;
    await requestOtp("Mã OTP mới đã được gửi.");
  }

  async function handleVerifyOtp(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Mã OTP không hợp lệ.");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Lỗi kết nối máy chủ. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="w-full p-7 sm:p-8">
      <div>
        <h1 className="font-serif text-2xl font-bold tracking-[-0.02em] text-ink sm:text-3xl">
          Chào mừng trở lại Matrimony
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-secondary">
          Tạo thiệp cưới và kích hoạt màn hình LED Realtime trong vài phút.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-800"
        >
          {error}
        </div>
      )}
      {info && (
        <div
          role="status"
          aria-live="polite"
          className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-800"
        >
          {info}
        </div>
      )}

      {googleEnabled ? (
        <>
          <div className="mt-6">
            <a
              href="/api/auth/google"
              className={`inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-border-strong bg-surface px-5 text-sm font-semibold text-ink transition-colors duration-200 motion-reduce:transition-none hover:bg-blush-hover ${FOCUS_RING_CLASS}`}
            >
              <span>Tiếp tục với Google</span>
            </a>
          </div>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs font-medium text-ink-muted">hoặc bằng Email OTP</span>
            <div className="h-px flex-1 bg-border" />
          </div>
        </>
      ) : null}

      <div className={googleEnabled ? "" : "mt-6"}>
        {step === "email" ? (
          <form onSubmit={handleRequestOtp} className="space-y-4">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-xs font-semibold text-ink">
                Địa chỉ Email
              </label>
              <div className="relative">
                <Mail
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
                />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  suppressHydrationWarning
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tenban@example.com"
                  className={`h-11 w-full rounded-xl border border-border-strong bg-ivory pl-10 pr-3.5 text-sm text-ink placeholder:text-ink-muted transition-colors duration-200 motion-reduce:transition-none focus:border-burgundy ${FOCUS_RING_CLASS}`}
                />
              </div>
            </div>
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Đang gửi mã..." : "Gửi mã OTP 6 chữ số"}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div>
              <label htmlFor="otp" className="mb-1.5 block text-xs font-semibold text-ink">
                Nhập mã 6 số gửi tới {email}
              </label>
              <div className="relative">
                <ShieldCheck
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
                />
                <input
                  id="otp"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  suppressHydrationWarning
                  pattern="\d{6}"
                  maxLength={6}
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="123456"
                  className={`h-11 w-full rounded-xl border border-border-strong bg-ivory pl-10 pr-3.5 text-sm font-semibold tracking-widest tabular-nums text-ink placeholder:font-normal placeholder:text-ink-muted transition-colors duration-200 motion-reduce:transition-none focus:border-burgundy ${FOCUS_RING_CLASS}`}
                />
              </div>
            </div>
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Đang xác thực..." : "Xác nhận & Vào Dashboard"}
            </Button>
            <div className="flex flex-col gap-1 border-t border-border pt-3">
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={loading || resendCooldown > 0}
                className={`inline-flex min-h-[44px] w-full cursor-pointer items-center justify-center rounded-xl px-4 text-xs font-semibold text-burgundy transition-colors duration-200 motion-reduce:transition-none hover:bg-blush-hover hover:text-burgundy-dark disabled:cursor-not-allowed disabled:text-ink-muted disabled:hover:bg-transparent ${FOCUS_RING_CLASS}`}
              >
                {resendCooldown > 0 ? (
                  <span>
                    Gửi lại mã OTP (<span className="tabular-nums">{resendCooldown}s</span>)
                  </span>
                ) : (
                  "Gửi lại mã OTP"
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setStep("email");
                  setCode("");
                  setError(null);
                  setInfo(null);
                  setResendCooldown(0);
                }}
                className={`inline-flex min-h-[44px] w-full cursor-pointer items-center justify-center rounded-xl px-4 text-xs font-medium text-ink-secondary transition-colors duration-200 motion-reduce:transition-none hover:bg-blush-hover hover:text-burgundy ${FOCUS_RING_CLASS}`}
              >
                Đổi địa chỉ email khác
              </button>
            </div>
          </form>
        )}
      </div>
    </Card>
  );
}
