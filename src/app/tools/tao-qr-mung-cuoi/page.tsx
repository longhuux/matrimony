"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Download, Heart, Printer, QrCode } from "lucide-react";
import { Card } from "@/components/ui/card";
import { VIETNAM_BANKS, buildVietQrPayload } from "@/modules/vietqr";
import { renderQrDataUrl } from "@/modules/vietqr/qr-render";

const FOCUS_RING_CLASS =
  "focus-visible:outline-2 focus-visible:outline-burgundy focus-visible:outline-offset-2";

type StandeeStyleId = "ivory-minimal" | "sac-son" | "cung-dinh";

interface StandeeStyleConfig {
  id: StandeeStyleId;
  name: string;
  desc: string;
  outerBg: string;
  innerBg: string;
  borderColor: string;
  accentColor: string;
  titleColor: string;
  textColor: string;
  mutedColor: string;
}

const STANDEE_STYLES: Record<StandeeStyleId, StandeeStyleConfig> = {
  "ivory-minimal": {
    id: "ivory-minimal",
    name: "Ivory Minimal",
    desc: "Nền ngà trang nhã, viền mảnh tối giản",
    outerBg: "#FFFCF9",
    innerBg: "#FFFFFF",
    borderColor: "#D9C5B7",
    accentColor: "#8B2635",
    titleColor: "#231B18",
    textColor: "#231B18",
    mutedColor: "#6B5B53",
  },
  "sac-son": {
    id: "sac-son",
    name: "Sắc Son Truyền Thống",
    desc: "Khung đỏ son ấm áp kết hợp viền vàng đồng",
    outerBg: "#8B2635",
    innerBg: "#FFF8F6",
    borderColor: "#C89D66",
    accentColor: "#8B2635",
    titleColor: "#8B2635",
    textColor: "#2B1414",
    mutedColor: "#5A4B44",
  },
  "cung-dinh": {
    id: "cung-dinh",
    name: "Cung Đình Ánh Vàng",
    desc: "Nền trầm sang trọng nổi bật chữ ánh vàng",
    outerBg: "#16100E",
    innerBg: "#231B18",
    borderColor: "#C89D66",
    accentColor: "#E6C280",
    titleColor: "#FFFCF9",
    textColor: "#FFFCF9",
    mutedColor: "#D9C5B7",
  },
};

function ensureBrowserBufferPolyfill(): void {
  if (typeof globalThis.Buffer !== "undefined") return;
  const encoder = new TextEncoder();
  (
    globalThis as unknown as {
      Buffer: {
        byteLength: (value: string) => number;
        from: (value: string) => Uint8Array;
      };
    }
  ).Buffer = {
    byteLength: (value: string) => encoder.encode(value).length,
    from: (value: string) => encoder.encode(value),
  };
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

export default function TaoQrMungCuoiPage(): React.ReactElement {
  const [bankBin, setBankBin] = React.useState<string>(VIETNAM_BANKS[0].bin);
  const [accountNumber, setAccountNumber] = React.useState<string>("1023456789");
  const [accountHolder, setAccountHolder] = React.useState<string>("NGUYEN GIA HUY");
  const [coupleNames, setCoupleNames] = React.useState<string>("Gia Huy & Minh Anh");
  const [transferNote, setTransferNote] = React.useState<string>("Mung cuoi Gia Huy Minh Anh");
  const [styleId, setStyleId] = React.useState<StandeeStyleId>("ivory-minimal");

  const [qrDataUrl, setQrDataUrl] = React.useState<string>("");
  const [qrError, setQrError] = React.useState<string>("");
  const [exporting, setExporting] = React.useState<boolean>(false);

  const selectedBank = React.useMemo(
    () => VIETNAM_BANKS.find((bank) => bank.bin === bankBin) ?? VIETNAM_BANKS[0],
    [bankBin],
  );
  const activeStyle = STANDEE_STYLES[styleId];

  React.useEffect(() => {
    let cancelled = false;

    const generateQr = async (): Promise<void> => {
      const cleanAccount = accountNumber.trim();
      if (!/^[a-zA-Z0-9]{4,30}$/.test(cleanAccount)) {
        setQrDataUrl("");
        setQrError("Số tài khoản cần từ 4 đến 30 ký tự chữ hoặc số (không khoảng trắng).");
        return;
      }

      try {
        ensureBrowserBufferPolyfill();
        const payload = buildVietQrPayload({
          bankBin,
          accountNumber: cleanAccount,
          description: transferNote.trim() || `Mung cuoi ${coupleNames}`,
        });
        const dataUrl = await renderQrDataUrl(payload, 520);
        if (!cancelled) {
          setQrDataUrl(dataUrl);
          setQrError("");
        }
      } catch (err) {
        if (!cancelled) {
          setQrDataUrl("");
          setQrError(
            err instanceof Error ? err.message : "Không thể tạo mã VietQR hợp lệ.",
          );
        }
      }
    };

    void generateQr();
    return () => {
      cancelled = true;
    };
  }, [bankBin, accountNumber, transferNote, coupleNames]);

  const handleDownloadHighResPng = async (): Promise<void> => {
    if (!qrDataUrl) return;
    setExporting(true);
    try {
      const width = 1200;
      const height = 1600;
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Outer standee background
      ctx.fillStyle = activeStyle.outerBg;
      ctx.fillRect(0, 0, width, height);

      // Inner card panel
      const pad = 64;
      drawRoundedRect(ctx, pad, pad, width - pad * 2, height - pad * 2, 36);
      ctx.fillStyle = activeStyle.innerBg;
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = activeStyle.borderColor;
      ctx.stroke();

      // Inner hairline frame
      drawRoundedRect(ctx, pad + 24, pad + 24, width - (pad + 24) * 2, height - (pad + 24) * 2, 24);
      ctx.lineWidth = 2;
      ctx.strokeStyle = activeStyle.borderColor;
      ctx.stroke();

      ctx.textAlign = "center";

      // Header subtitle
      ctx.fillStyle = activeStyle.accentColor;
      ctx.font = '600 32px "Be Vietnam Pro", sans-serif';
      ctx.fillText("HỘP MỪNG CƯỚI VIETQR", width / 2, 190);

      // Couple names
      ctx.fillStyle = activeStyle.titleColor;
      ctx.font = '700 72px "Playfair Display", Georgia, serif';
      ctx.fillText(coupleNames.trim() || "Cô Dâu & Chú Rể", width / 2, 290);

      // Divider line
      ctx.strokeStyle = activeStyle.borderColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(width / 2 - 140, 340);
      ctx.lineTo(width / 2 + 140, 340);
      ctx.stroke();

      // White QR container for guaranteed scannability
      const qrBoxSize = 620;
      const qrBoxX = (width - qrBoxSize) / 2;
      const qrBoxY = 400;
      drawRoundedRect(ctx, qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 28);
      ctx.fillStyle = "#FFFFFF";
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#EADBD1";
      ctx.stroke();

      const qrImage = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new window.Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("Không thể tải ảnh QR."));
        img.src = qrDataUrl;
      });
      ctx.drawImage(qrImage, qrBoxX + 36, qrBoxY + 36, qrBoxSize - 72, qrBoxSize - 72);

      // Bank details
      ctx.fillStyle = activeStyle.accentColor;
      ctx.font = '600 32px "Be Vietnam Pro", sans-serif';
      ctx.fillText(`${selectedBank.name} (${selectedBank.shortName})`, width / 2, 1110);

      ctx.fillStyle = activeStyle.textColor;
      ctx.font = '700 44px "Be Vietnam Pro", sans-serif';
      ctx.fillText(
        (accountHolder.trim() || "CHU TAI KHOAN").toUpperCase(),
        width / 2,
        1180,
      );

      ctx.fillStyle = activeStyle.accentColor;
      ctx.font = '700 46px monospace';
      ctx.fillText(accountNumber.trim(), width / 2, 1255);

      if (transferNote.trim()) {
        ctx.fillStyle = activeStyle.mutedColor;
        ctx.font = '500 28px "Be Vietnam Pro", sans-serif';
        ctx.fillText(`Nội dung: ${transferNote.trim()}`, width / 2, 1330);
      }

      ctx.fillStyle = activeStyle.mutedColor;
      ctx.font = '500 24px "Be Vietnam Pro", sans-serif';
      ctx.fillText("Quét mã bằng ứng dụng ngân hàng, chuyển khoản trực tiếp 0% phí", width / 2, 1445);

      const pngUrl = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = pngUrl;
      link.download = `the-qr-mung-cuoi-${styleId}.png`;
      link.click();
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="min-h-dvh bg-ivory text-ink print:bg-white">
      <a
        href="#main-content"
        className="sr-only print:hidden focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:inline-flex focus:min-h-[44px] focus:items-center focus:rounded-full focus:bg-burgundy focus:px-5 focus:text-sm focus:font-semibold focus:text-ivory"
      >
        Chuyển thẳng tới nội dung chính
      </a>

      <header className="sticky top-0 z-30 h-[72px] border-b border-border bg-ivory/95 backdrop-blur-md print:hidden">
        <div className="mx-auto flex h-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link
            href="/"
            className={`flex min-w-0 shrink-0 items-center gap-2 rounded-full py-1 sm:gap-2.5 ${FOCUS_RING_CLASS}`}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-burgundy text-ivory">
              <Heart className="h-4 w-4 fill-current" aria-hidden="true" />
            </span>
            <span className="font-serif text-lg font-bold tracking-tight text-ink sm:text-xl">
              Matrimony
            </span>
          </Link>

          <nav
            aria-label="Công cụ cưới hỏi"
            className="hidden items-center gap-6 text-sm font-medium text-ink-secondary md:flex"
          >
            <Link
              href="/tools/nen-anh"
              className={`inline-flex min-h-[44px] items-center rounded-md px-1.5 transition-colors duration-200 motion-reduce:transition-none hover:text-burgundy ${FOCUS_RING_CLASS}`}
            >
              Nén ảnh cưới
            </Link>
            <Link
              href="/tools/tao-qr-mung-cuoi"
              aria-current="page"
              className={`inline-flex min-h-[44px] items-center rounded-md px-1.5 font-semibold text-burgundy transition-colors duration-200 motion-reduce:transition-none ${FOCUS_RING_CLASS}`}
            >
              Tạo QR bàn tiệc
            </Link>
            <Link
              href="/tools/xem-ngay-cuoi"
              className={`inline-flex min-h-[44px] items-center rounded-md px-1.5 transition-colors duration-200 motion-reduce:transition-none hover:text-burgundy ${FOCUS_RING_CLASS}`}
            >
              Xem ngày cưới
            </Link>
          </nav>

          <Link
            href="/login"
            className={`inline-flex h-11 shrink-0 items-center whitespace-nowrap rounded-full bg-burgundy px-4 text-xs font-semibold text-ivory transition-colors duration-200 motion-reduce:transition-none hover:bg-burgundy-dark sm:px-5 sm:text-sm ${FOCUS_RING_CLASS}`}
          >
            Tạo thiệp miễn phí
          </Link>
        </div>
      </header>

      <main
        id="main-content"
        className="mx-auto max-w-6xl px-4 py-10 pb-[calc(3rem+env(safe-area-inset-bottom))] sm:px-6 sm:py-12 sm:pb-[calc(4rem+env(safe-area-inset-bottom))] print:p-0"
      >
        <div className="mb-8 print:hidden">
          <Link
            href="/"
            className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-full pr-2 text-sm font-medium text-ink-muted transition-colors duration-200 motion-reduce:transition-none hover:text-burgundy ${FOCUS_RING_CLASS}`}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>Về trang chủ</span>
          </Link>
          <h1 className="mt-2 min-w-0 break-words font-serif text-3xl font-bold tracking-[-0.02em] text-ink sm:text-4xl">
            Tạo thẻ QR Mừng cưới để bàn tiệc
          </h1>
          <p className="mt-2 max-w-2xl text-base leading-relaxed text-ink-secondary">
            Tạo standee QR chuẩn EMVCo Napas trực tiếp về tài khoản cô dâu chú rể (0% phí), xuất ảnh PNG 1200×1600 hoặc in ngay tại nhà.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-12 print:block">
          {/* Form Controls */}
          <Card className="p-6 lg:col-span-6 print:hidden">
            <h2 className="font-serif text-xl font-bold text-ink">
              Thông tin tài khoản &amp; Phong cách thẻ
            </h2>

            <div className="mt-5 space-y-5">
              <div>
                <label htmlFor="qr-bank" className="block text-sm font-semibold text-ink">
                  Ngân hàng nhận mừng cưới
                </label>
                <select
                  id="qr-bank"
                  value={bankBin}
                  onChange={(e) => setBankBin(e.target.value)}
                  className={`mt-1.5 h-11 w-full rounded-xl border border-border-strong bg-ivory px-3.5 text-sm text-ink transition-colors duration-200 motion-reduce:transition-none focus:border-burgundy ${FOCUS_RING_CLASS}`}
                >
                  {VIETNAM_BANKS.map((bank) => (
                    <option key={bank.bin} value={bank.bin}>
                      {bank.name} ({bank.shortName})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="qr-account" className="block text-sm font-semibold text-ink">
                    Số tài khoản
                  </label>
                  <input
                    id="qr-account"
                    type="text"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    placeholder="Ví dụ: 1023456789"
                    className={`mt-1.5 h-11 w-full rounded-xl border border-border-strong bg-ivory px-3.5 text-sm tabular-nums text-ink placeholder:text-ink-muted transition-colors duration-200 motion-reduce:transition-none focus:border-burgundy ${FOCUS_RING_CLASS}`}
                  />
                </div>
                <div>
                  <label htmlFor="qr-holder" className="block text-sm font-semibold text-ink">
                    Tên chủ tài khoản
                  </label>
                  <input
                    id="qr-holder"
                    type="text"
                    value={accountHolder}
                    onChange={(e) => setAccountHolder(e.target.value)}
                    placeholder="NGUYEN GIA HUY"
                    className={`mt-1.5 h-11 w-full rounded-xl border border-border-strong bg-ivory px-3.5 text-sm text-ink placeholder:text-ink-muted transition-colors duration-200 motion-reduce:transition-none focus:border-burgundy ${FOCUS_RING_CLASS}`}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="qr-couple" className="block text-sm font-semibold text-ink">
                    Tên cô dâu &amp; chú rể
                  </label>
                  <input
                    id="qr-couple"
                    type="text"
                    value={coupleNames}
                    onChange={(e) => setCoupleNames(e.target.value)}
                    placeholder="Gia Huy & Minh Anh"
                    className={`mt-1.5 h-11 w-full rounded-xl border border-border-strong bg-ivory px-3.5 text-sm text-ink placeholder:text-ink-muted transition-colors duration-200 motion-reduce:transition-none focus:border-burgundy ${FOCUS_RING_CLASS}`}
                  />
                </div>
                <div>
                  <label htmlFor="qr-note" className="block text-sm font-semibold text-ink">
                    Lời nhắn chuyển khoản
                  </label>
                  <input
                    id="qr-note"
                    type="text"
                    maxLength={50}
                    value={transferNote}
                    onChange={(e) => setTransferNote(e.target.value)}
                    placeholder="Mung cuoi..."
                    className={`mt-1.5 h-11 w-full rounded-xl border border-border-strong bg-ivory px-3.5 text-sm text-ink placeholder:text-ink-muted transition-colors duration-200 motion-reduce:transition-none focus:border-burgundy ${FOCUS_RING_CLASS}`}
                  />
                </div>
              </div>

              <fieldset className="border-t border-border pt-5">
                <legend className="text-sm font-semibold text-ink">
                  Chọn phong cách thẻ đặt bàn
                </legend>
                <div className="mt-2.5 grid gap-2.5 sm:grid-cols-3">
                  {(Object.values(STANDEE_STYLES) as StandeeStyleConfig[]).map((st) => {
                    const active = styleId === st.id;
                    return (
                      <button
                        key={st.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setStyleId(st.id)}
                        className={`flex min-h-[44px] cursor-pointer flex-col items-start rounded-xl border p-3 text-left transition-colors duration-200 motion-reduce:transition-none ${FOCUS_RING_CLASS} ${
                          active
                            ? "border-burgundy bg-blush"
                            : "border-border-strong bg-ivory hover:bg-blush-hover"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            aria-hidden="true"
                            className="h-4 w-4 shrink-0 rounded-full border border-border-strong"
                            style={{ backgroundColor: st.outerBg }}
                          />
                          <span className="text-xs font-bold text-ink">{st.name}</span>
                        </div>
                        <span className="mt-1.5 text-xs leading-snug text-ink-muted">
                          {st.desc}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              {qrError ? (
                <p
                  role="alert"
                  className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800"
                >
                  {qrError}
                </p>
              ) : null}

              <div className="flex flex-wrap gap-3 border-t border-border pt-5">
                <button
                  type="button"
                  disabled={!qrDataUrl || exporting}
                  onClick={() => void handleDownloadHighResPng()}
                  className={`inline-flex h-11 min-h-[44px] cursor-pointer items-center gap-2 rounded-full bg-burgundy px-6 text-sm font-semibold text-ivory transition-colors duration-200 motion-reduce:transition-none hover:bg-burgundy-dark disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS_RING_CLASS}`}
                >
                  <Download className="h-4 w-4" aria-hidden="true" />
                  <span>
                    {exporting ? "Đang xuất ảnh PNG..." : "Tải ảnh PNG độ phân giải cao"}
                  </span>
                </button>
                <button
                  type="button"
                  disabled={!qrDataUrl}
                  onClick={() => window.print()}
                  className={`inline-flex h-11 min-h-[44px] cursor-pointer items-center gap-2 rounded-full border border-border-strong bg-ivory px-5 text-sm font-semibold text-ink transition-colors duration-200 motion-reduce:transition-none hover:bg-blush-hover disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS_RING_CLASS}`}
                >
                  <Printer className="h-4 w-4" aria-hidden="true" />
                  <span>In thẻ QR</span>
                </button>
              </div>
            </div>
          </Card>

          {/* Framed Reception Standee Preview */}
          <div className="flex flex-col items-center lg:col-span-6 print:mx-auto print:mt-8 print:w-[420px]">
            <div
              className="w-full max-w-md rounded-2xl p-5 shadow-[var(--shadow-elevated)] print:shadow-none"
              style={{ backgroundColor: activeStyle.outerBg }}
            >
              <div
                className="rounded-xl border-2 p-6 text-center"
                style={{
                  backgroundColor: activeStyle.innerBg,
                  borderColor: activeStyle.borderColor,
                }}
              >
                <p
                  className="text-xs font-semibold uppercase tracking-[0.12em]"
                  style={{ color: activeStyle.accentColor }}
                >
                  Hộp mừng cưới VietQR
                </p>
                <h3
                  className="mt-2 font-serif text-3xl font-bold leading-tight"
                  style={{ color: activeStyle.titleColor }}
                >
                  {coupleNames.trim() || "Cô Dâu & Chú Rể"}
                </h3>

                <div
                  className="mx-auto my-4 h-px w-24"
                  style={{ backgroundColor: activeStyle.borderColor }}
                />

                <div className="mx-auto inline-flex rounded-2xl border border-border bg-white p-4">
                  {qrDataUrl ? (
                    <Image
                      src={qrDataUrl}
                      alt={`Mã VietQR ${selectedBank.shortName} - ${accountHolder}`}
                      width={240}
                      height={240}
                      unoptimized
                      className="h-56 w-56 object-contain"
                    />
                  ) : (
                    <div className="flex h-56 w-56 flex-col items-center justify-center gap-2 text-xs text-ink-muted">
                      <QrCode className="h-8 w-8 text-burgundy" aria-hidden="true" />
                      <span>Nhập số tài khoản hợp lệ để hiển thị QR</span>
                    </div>
                  )}
                </div>

                <div className="mt-4 space-y-1">
                  <p
                    className="text-xs font-semibold"
                    style={{ color: activeStyle.accentColor }}
                  >
                    {selectedBank.name} ({selectedBank.shortName})
                  </p>
                  <p
                    className="text-base font-bold"
                    style={{ color: activeStyle.textColor }}
                  >
                    {(accountHolder.trim() || "CHỦ TÀI KHOẢN").toUpperCase()}
                  </p>
                  <p
                    className="font-mono text-base font-bold tabular-nums"
                    style={{ color: activeStyle.accentColor }}
                  >
                    {accountNumber.trim() || "---"}
                  </p>
                  {transferNote.trim() ? (
                    <p className="pt-1 text-xs" style={{ color: activeStyle.mutedColor }}>
                      Nội dung: {transferNote.trim()}
                    </p>
                  ) : null}
                </div>

                <p className="mt-5 text-xs" style={{ color: activeStyle.mutedColor }}>
                  Quét mã bằng ứng dụng ngân hàng bất kỳ, chuyển khoản trực tiếp 0% phí
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
