"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Check,
  CheckCircle2,
  Copy,
  Crown,
  QrCode,
  Receipt,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useDialogFocus } from "@/lib/use-dialog-focus";
import { formatVnd } from "@/lib/utils";
import { PLAN_CONFIGS, type PlanConfig, type PlanTier } from "@/modules/billing/plans";

interface OrderRecord {
  id: string;
  orderCode: string;
  sku: string;
  amountVnd: number;
  status: "pending" | "paid" | "expired" | "cancelled";
  provider: string;
  paidAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

interface BillingStateResponse {
  orders: OrderRecord[];
  plan: {
    current: PlanTier;
    effective: PlanTier;
    expiresAt: string | null;
    aiCredits: number;
    config: PlanConfig;
  };
}

interface CheckoutModalState {
  order: OrderRecord;
  qrPayload: string;
  qrDataUrl: string;
  sandboxMode: boolean;
}

const FOCUS_RING =
  "focus-visible:outline-2 focus-visible:outline-burgundy focus-visible:outline-offset-2";

const ORDER_STATUS_BADGE: Record<string, { label: string; className: string }> = {
  paid: {
    label: "Đã thanh toán",
    className: "border border-emerald-200 bg-emerald-50 text-emerald-800",
  },
  pending: {
    label: "Chờ thanh toán",
    className: "border border-border bg-amber-surface text-amber-text",
  },
  expired: {
    label: "Hết hạn",
    className: "border border-border bg-blush text-ink-secondary",
  },
  cancelled: {
    label: "Đã hủy",
    className: "border border-red-200 bg-red-50 text-red-700",
  },
};

function formatDuration(months: number): string {
  if (months === 36) return "3 năm";
  if (months === 60) return "5 năm";
  return `${months} tháng`;
}

export default function BillingPage(): React.ReactElement {
  const router = useRouter();
  const [billing, setBilling] = React.useState<BillingStateResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  const [creatingSku, setCreatingSku] = React.useState<PlanTier | null>(null);
  const [checkout, setCheckout] = React.useState<CheckoutModalState | null>(null);
  const [settling, setSettling] = React.useState(false);
  const [copiedOrderCode, setCopiedOrderCode] = React.useState(false);
  const checkoutPanelRef = React.useRef<HTMLDivElement>(null);

  const closeCheckoutModal = React.useCallback(() => setCheckout(null), []);
  useDialogFocus(Boolean(checkout), checkoutPanelRef, { onClose: closeCheckoutModal });

  const loadBilling = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/orders");
      const data = (await res.json().catch(() => ({}))) as BillingStateResponse & {
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || "Không thể tải thông tin gói dịch vụ.");
      }
      setBilling(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đã có lỗi xảy ra.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadBilling();
  }, [loadBilling]);

  async function handleStartCheckout(sku: "pro" | "combo" | "studio_pilot"): Promise<void> {
    setCreatingSku(sku);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sku }),
      });
      const data = (await res.json().catch(() => ({}))) as CheckoutModalState & {
        error?: string;
      };
      if (!res.ok || !data.order) {
        throw new Error(data.error || "Không thể khởi tạo đơn thanh toán.");
      }
      setCheckout(data);
      setCopiedOrderCode(false);
      await loadBilling();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tạo đơn thanh toán thất bại.");
    } finally {
      setCreatingSku(null);
    }
  }

  async function handleSimulateSandboxPaid(): Promise<void> {
    if (!checkout) return;
    setSettling(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderCode: checkout.order.orderCode }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error || "Không thể mô phỏng thanh toán.");
      }
      const upgradedPlanName = PLAN_CONFIGS[checkout.order.sku as PlanTier]?.name ?? checkout.order.sku;
      setCheckout(null);
      setNotice(`Thanh toán thành công! Tài khoản của bạn đã được nâng cấp lên gói ${upgradedPlanName}.`);
      await loadBilling();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Mô phỏng thanh toán thất bại.");
    } finally {
      setSettling(false);
    }
  }

  async function handleCopyOrderCode(code: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedOrderCode(true);
      window.setTimeout(() => setCopiedOrderCode(false), 2000);
    } catch {
      setCopiedOrderCode(false);
    }
  }

  const plans: PlanConfig[] = [
    PLAN_CONFIGS.free,
    PLAN_CONFIGS.pro,
    PLAN_CONFIGS.combo,
    PLAN_CONFIGS.studio_pilot,
  ];

  const activeSku = billing?.plan.effective ?? "free";

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-ink">
            Gói dịch vụ &amp; Thanh toán
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            Thanh toán 1 lần, không phí ẩn. Mọi gói đều miễn phí QR mừng cưới VietQR chuyển thẳng 0% phí.
          </p>
        </div>

        <span className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-amber-surface px-4 py-2 text-xs font-semibold text-amber-text">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
          VietQR Mừng cưới 0% phí trung gian
        </span>
      </div>

      {error ? (
        <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      {notice ? (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{notice}</span>
        </div>
      ) : null}

      {/* Current Plan Summary */}
      {billing ? (
        <Card className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Crown className="h-6 w-6 shrink-0 text-burgundy" aria-hidden="true" />
              <div>
                <p className="text-xs font-medium text-ink-muted">Gói hiện tại của bạn</p>
                <h2 className="font-serif text-2xl font-bold text-ink">
                  {billing.plan.config.name}
                </h2>
                <p className="mt-0.5 text-xs tabular-nums text-ink-secondary">
                  {billing.plan.expiresAt
                    ? `Hiệu lực đến: ${new Date(billing.plan.expiresAt).toLocaleDateString("vi-VN")}`
                    : "Gói cơ bản không giới hạn thời gian trải nghiệm"}
                </p>
              </div>
            </div>

            <div className="border-t border-border pt-3 sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0 sm:text-right">
              <p className="text-xs text-ink-muted">AI Credits khả dụng</p>
              <p className="mt-1 flex items-center gap-1 text-base font-bold tabular-nums text-amber-text sm:justify-end">
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                {billing.plan.aiCredits} lượt
              </p>
            </div>
          </div>
        </Card>
      ) : null}

      {/* 4 Tiers Comparison Grid */}
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
        {plans.map((plan) => {
          const isCurrent = activeSku === plan.sku;
          const isPopular = plan.sku === "pro";
          const featureLines = [
            `${plan.maxWebsites} website thiệp cưới`,
            `${plan.maxImages} ảnh cưới lưu trữ`,
            plan.maxViews === -1
              ? "Không giới hạn lượt xem"
              : `${new Intl.NumberFormat("vi-VN").format(plan.maxViews)} lượt xem`,
            plan.maxGuestsPerInvitation === -1
              ? "Không giới hạn khách mời"
              : `Tối đa ${plan.maxGuestsPerInvitation} khách/thiệp`,
            `${plan.aiCreditsGrant} AI Magic credits`,
            plan.ledCheckinLimit === -1
              ? "Không giới hạn ảnh LED check-in"
              : `${plan.ledCheckinLimit} ảnh LED check-in`,
            "VietQR 0% phí trực tiếp",
            plan.features.removeWatermark ? "Xóa watermark Matrimony" : "Có watermark nhẹ",
            plan.features.dynamicZaloOg ? "Dynamic Zalo OG từng khách" : "Zalo OG mặc định",
            plan.features.ledLuckyDraw ? "Quay số Lucky Draw trên LED" : "Check-in LED cơ bản",
          ];

          return (
            <Card
              key={plan.sku}
              className={`flex flex-col justify-between p-5 ${
                isPopular ? "border-2 border-burgundy ring-4 ring-burgundy/10" : ""
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-serif text-lg font-bold text-ink">{plan.name}</h3>
                  {isPopular ? (
                    <span className="shrink-0 rounded-full bg-burgundy px-2.5 py-0.5 text-xs font-semibold text-ivory">
                      Phổ biến
                    </span>
                  ) : null}
                </div>

                <div className="mt-3 flex items-baseline gap-1.5">
                  <span className="text-3xl font-bold tabular-nums text-burgundy">
                    {formatVnd(plan.priceVnd)}
                  </span>
                  <span className="text-xs text-ink-muted">
                    / {formatDuration(plan.durationMonths)}
                  </span>
                </div>

                <ul className="mt-4 space-y-2 text-xs text-ink-secondary">
                  {featureLines.map((line) => (
                    <li key={line} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-burgundy" aria-hidden="true" />
                      <span className="tabular-nums">{line}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-6 border-t border-border pt-4">
                {plan.sku === "free" ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-[44px] w-full motion-reduce:transition-none"
                    disabled
                  >
                    {isCurrent ? "Đang sử dụng" : "Gói mặc định"}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant={isPopular ? "primary" : "secondary"}
                    className="min-h-[44px] w-full motion-reduce:transition-none"
                    disabled={creatingSku === plan.sku}
                    onClick={() =>
                      void handleStartCheckout(plan.sku as "pro" | "combo" | "studio_pilot")
                    }
                  >
                    {creatingSku === plan.sku
                      ? "Đang tạo QR..."
                      : isCurrent
                        ? "Gia hạn / Mua thêm"
                        : `Nâng cấp ${plan.name}`}
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {/* Order History */}
      <Card className="p-5">
        <div className="flex items-center gap-2">
          <Receipt className="h-4 w-4 text-burgundy" aria-hidden="true" />
          <h2 className="font-serif text-xl font-bold text-ink">Lịch sử đơn hàng</h2>
        </div>

        {loading ? (
          <div className="mt-4 h-24 w-full animate-pulse rounded-xl bg-blush motion-reduce:animate-none" />
        ) : !billing || billing.orders.length === 0 ? (
          <p className="mt-4 text-xs text-ink-muted">Bạn chưa có giao dịch thanh toán nào.</p>
        ) : (
          <>
            {/* Mobile Order Cards */}
            <div className="mt-4 divide-y divide-border border-t border-border md:hidden">
              {billing.orders.map((ord) => {
                const statusInfo = ORDER_STATUS_BADGE[ord.status] ?? ORDER_STATUS_BADGE.pending;
                const planTitle = PLAN_CONFIGS[ord.sku as PlanTier]?.name ?? ord.sku;
                return (
                  <div key={ord.id} className="space-y-2 py-3.5 last:pb-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-semibold tabular-nums text-ink">
                        {ord.orderCode}
                      </span>
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusInfo.className}`}
                      >
                        {statusInfo.label}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="text-ink-secondary">{planTitle}</span>
                      <span className="font-semibold tabular-nums text-burgundy">
                        {formatVnd(ord.amountVnd)}
                      </span>
                    </div>
                    <p className="text-xs tabular-nums text-ink-muted">
                      {new Date(ord.createdAt).toLocaleString("vi-VN")}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Desktop Order Table */}
            <div className="mt-4 hidden overflow-x-auto md:block">
              <table className="w-full min-w-[640px] border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-border text-xs font-semibold uppercase tracking-wider text-ink-muted">
                    <th className="py-2.5 pr-3">Mã đơn</th>
                    <th className="px-3 py-2.5">Gói dịch vụ</th>
                    <th className="px-3 py-2.5">Số tiền</th>
                    <th className="px-3 py-2.5">Trạng thái</th>
                    <th className="px-3 py-2.5">Thời gian tạo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {billing.orders.map((ord) => {
                    const statusInfo = ORDER_STATUS_BADGE[ord.status] ?? ORDER_STATUS_BADGE.pending;
                    const planTitle = PLAN_CONFIGS[ord.sku as PlanTier]?.name ?? ord.sku;
                    return (
                      <tr key={ord.id}>
                        <td className="py-3 pr-3 font-mono font-semibold tabular-nums text-ink">
                          {ord.orderCode}
                        </td>
                        <td className="px-3 py-3 text-ink">{planTitle}</td>
                        <td className="px-3 py-3 font-semibold tabular-nums text-burgundy">
                          {formatVnd(ord.amountVnd)}
                        </td>
                        <td className="px-3 py-3">
                          <span
                            className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusInfo.className}`}
                          >
                            {statusInfo.label}
                          </span>
                        </td>
                        <td className="px-3 py-3 tabular-nums text-ink-muted">
                          {new Date(ord.createdAt).toLocaleString("vi-VN")}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>

      {/* Checkout VietQR / PayOS Modal */}
      {checkout ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="checkout-modal-title"
          onClick={closeCheckoutModal}
        >
          <div
            ref={checkoutPanelRef}
            tabIndex={-1}
            className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-2xl border border-border bg-ivory p-6 shadow-[var(--shadow-elevated)] outline-none"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-burgundy text-ivory">
                  <QrCode className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                  <h2 id="checkout-modal-title" className="font-serif text-xl font-bold text-ink">
                    Thanh toán nâng cấp gói
                  </h2>
                  <p className="text-xs text-ink-muted">
                    Quét mã VietQR qua PayOS để kích hoạt tự động
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeCheckoutModal}
                aria-label="Đóng"
                className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-ink-secondary transition-colors duration-200 hover:bg-blush motion-reduce:transition-none cursor-pointer ${FOCUS_RING}`}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="mt-4 flex flex-col items-center rounded-2xl border border-border bg-surface p-4">
              <Image
                src={checkout.qrDataUrl}
                alt={`Mã VietQR thanh toán đơn ${checkout.order.orderCode}`}
                width={224}
                height={224}
                unoptimized
                className="h-56 w-56 rounded-xl object-contain"
              />
              <p className="mt-2 text-lg font-bold tabular-nums text-burgundy">
                {formatVnd(checkout.order.amountVnd)}
              </p>
              <p className="text-xs text-ink-secondary">
                Gói: {PLAN_CONFIGS[checkout.order.sku as PlanTier]?.name ?? checkout.order.sku}
              </p>
            </div>

            <div className="mt-4 divide-y divide-border border-t border-b border-border text-xs">
              <div className="flex items-center justify-between py-2.5">
                <span className="text-ink-muted">Ngân hàng thụ hưởng</span>
                <span className="font-semibold tabular-nums text-ink">
                  MB Bank, 0909000999
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 py-1.5">
                <span className="text-ink-muted">Nội dung chuyển khoản</span>
                <button
                  type="button"
                  onClick={() => void handleCopyOrderCode(checkout.order.orderCode)}
                  className={`inline-flex min-h-[44px] items-center gap-1.5 font-mono font-bold tabular-nums text-burgundy hover:underline cursor-pointer ${FOCUS_RING}`}
                >
                  <span>{checkout.order.orderCode}</span>
                  {copiedOrderCode ? (
                    <Check className="h-3.5 w-3.5 text-emerald-700" aria-hidden="true" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>

            {checkout.sandboxMode ? (
              <div className="mt-4 rounded-xl border border-border bg-amber-surface p-3.5">
                <p className="text-xs font-medium text-amber-text">
                  Môi trường Dev Sandbox (chưa cấu hình PayOS live key): bạn có thể giả lập thanh toán thành công ngay để kiểm tra luồng nâng cấp gói.
                </p>
                <Button
                  type="button"
                  className="mt-2.5 min-h-[44px] w-full motion-reduce:transition-none"
                  disabled={settling}
                  onClick={() => void handleSimulateSandboxPaid()}
                >
                  {settling
                    ? "Đang kích hoạt gói..."
                    : "Mô phỏng thanh toán thành công (Dev Sandbox)"}
                </Button>
              </div>
            ) : null}

            <div className="mt-4 flex justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={closeCheckoutModal}
                className="min-h-[44px] motion-reduce:transition-none"
              >
                Đóng
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
