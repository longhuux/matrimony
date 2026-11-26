"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CalendarHeart,
  Crown,
  ExternalLink,
  FileImage,
  LayoutDashboard,
  LayoutTemplate,
  MessageSquareHeart,
  MonitorPlay,
  QrCode,
  Search,
  Sparkles,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import { useDialogFocus } from "@/lib/use-dialog-focus";

export interface PaletteInvitationItem {
  id: string;
  title: string;
  slug: string;
  status: string;
}

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invitations: PaletteInvitationItem[];
}

interface CommandAction {
  id: string;
  group: "pages" | "invitations" | "tools";
  label: string;
  hint: string;
  href: string;
  external?: boolean;
  icon: React.ComponentType<{ className?: string }>;
}

const FOCUS_RING =
  "focus-visible:outline-2 focus-visible:outline-burgundy focus-visible:outline-offset-2";

const DASHBOARD_PAGES: readonly CommandAction[] = [
  {
    id: "page-overview",
    group: "pages",
    label: "Tổng quan",
    hint: "Bảng điều khiển chính & chỉ số thiệp",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    id: "page-invitations",
    group: "pages",
    label: "Thiệp cưới của tôi",
    hint: "Tạo mới, nhân bản, phát hành thiệp",
    href: "/dashboard/invitations",
    icon: LayoutTemplate,
  },
  {
    id: "page-profile",
    group: "pages",
    label: "Hồ sơ cưới",
    hint: "Thông tin 2 bên gia đình, lịch âm Can Chi & VietQR",
    href: "/dashboard/wedding-profile",
    icon: CalendarHeart,
  },
  {
    id: "page-guests",
    group: "pages",
    label: "Khách mời & Zalo OG",
    hint: "Nhập CSV, soạn lời mời Zalo, xem OG cá nhân hóa",
    href: "/dashboard/guests",
    icon: Users,
  },
  {
    id: "page-rsvp",
    group: "pages",
    label: "Phản hồi RSVP",
    hint: "Thống kê tham dự, số người đi kèm & xe đưa đón",
    href: "/dashboard/rsvp",
    icon: UserCheck,
  },
  {
    id: "page-wishes",
    group: "pages",
    label: "Hộp lời chúc",
    hint: "Duyệt, ẩn & xuất CSV lời chúc mừng cưới",
    href: "/dashboard/wishes",
    icon: MessageSquareHeart,
  },
  {
    id: "page-ai-magic",
    group: "pages",
    label: "AI Magic Setup",
    hint: "Tạo thiệp hoàn chỉnh 30 giây từ ảnh cưới",
    href: "/dashboard/ai-magic",
    icon: Sparkles,
  },
  {
    id: "page-led-mod",
    group: "pages",
    label: "Màn hình LED Sảnh tiệc",
    hint: "Kiểm duyệt check-in realtime & Lucky Draw",
    href: "/dashboard/led-mod",
    icon: MonitorPlay,
  },
  {
    id: "page-billing",
    group: "pages",
    label: "Gói dịch vụ & Thanh toán",
    hint: "So sánh gói, nâng cấp & lịch sử đơn hàng",
    href: "/dashboard/billing",
    icon: Crown,
  },
];

const FREE_TOOLS: readonly CommandAction[] = [
  {
    id: "tool-compress",
    group: "tools",
    label: "Nén ảnh cưới WebP miễn phí",
    hint: "Xử lý ngay trên trình duyệt, giữ nguyên nét",
    href: "/tools/nen-anh",
    icon: FileImage,
  },
  {
    id: "tool-vietqr",
    group: "tools",
    label: "Tạo thẻ QR Mừng cưới bàn tiệc",
    hint: "In standee VietQR 0% phí chuyển khoản trực tiếp",
    href: "/tools/tao-qr-mung-cuoi",
    icon: QrCode,
  },
  {
    id: "tool-lunar",
    group: "tools",
    label: "Xem ngày cưới & Lịch âm Can Chi",
    hint: "Tra cứu ngày hoàng đạo & âm lịch 2025–2030",
    href: "/tools/xem-ngay-cuoi",
    icon: CalendarHeart,
  },
];

function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();
}

const GROUP_LABELS: Record<CommandAction["group"], string> = {
  pages: "Trang quản lý",
  invitations: "Thiệp cưới của bạn",
  tools: "Công cụ miễn phí",
};

export function CommandPalette({
  open,
  onOpenChange,
  invitations,
}: CommandPaletteProps): React.ReactElement | null {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [activeIndex, setActiveIndex] = React.useState(0);
  const panelRef = React.useRef<HTMLDivElement>(null);

  const handleClose = React.useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  useDialogFocus(open, panelRef, { onClose: handleClose });

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange]);

  React.useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
    }
  }, [open]);

  const allActions = React.useMemo<CommandAction[]>(() => {
    const invActions: CommandAction[] = invitations.flatMap((inv) => [
      {
        id: `inv-edit-${inv.id}`,
        group: "invitations" as const,
        label: `Chỉnh sửa: ${inv.title}`,
        hint: `/editor/${inv.id}`,
        href: `/editor/${inv.id}`,
        icon: LayoutTemplate,
      },
      {
        id: `inv-view-${inv.id}`,
        group: "invitations" as const,
        label: `Xem thiệp công khai: ${inv.title}`,
        hint: `/s/${inv.slug}`,
        href: `/s/${inv.slug}`,
        external: true,
        icon: ExternalLink,
      },
    ]);

    return [...DASHBOARD_PAGES, ...invActions, ...FREE_TOOLS];
  }, [invitations]);

  const filteredActions = React.useMemo(() => {
    const normQuery = normalizeSearch(query);
    if (!normQuery) return allActions;
    return allActions.filter((item) => {
      const hay = normalizeSearch(`${item.label} ${item.hint}`);
      return hay.includes(normQuery);
    });
  }, [allActions, query]);

  React.useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const executeAction = React.useCallback(
    (action: CommandAction) => {
      onOpenChange(false);
      if (action.external) {
        window.open(action.href, "_blank", "noopener,noreferrer");
      } else {
        router.push(action.href);
      }
    },
    [onOpenChange, router],
  );

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>): void => {
    if (filteredActions.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((prev) => (prev + 1) % filteredActions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((prev) => (prev - 1 + filteredActions.length) % filteredActions.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const target = filteredActions[activeIndex];
      if (target) executeAction(target);
    }
  };

  if (!open) return null;

  const grouped: Array<{
    group: CommandAction["group"];
    items: Array<{ action: CommandAction; index: number }>;
  }> = [];
  const groupOrder: CommandAction["group"][] = ["pages", "invitations", "tools"];
  for (const g of groupOrder) {
    const items: Array<{ action: CommandAction; index: number }> = [];
    filteredActions.forEach((action, index) => {
      if (action.group === g) items.push({ action, index });
    });
    if (items.length > 0) {
      grouped.push({ group: g, items });
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-ink/45 px-4 pt-16 backdrop-blur-xs sm:pt-24"
      role="dialog"
      aria-modal="true"
      aria-label="Tìm kiếm nhanh trong Matrimony"
      onClick={handleClose}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-ivory shadow-[var(--shadow-elevated)] outline-none"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-border bg-surface px-4 py-2.5 focus-within:ring-2 focus-within:ring-burgundy/40 focus-within:ring-inset">
          <Search className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden="true" />
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Tìm trang quản lý, thiệp cưới hoặc công cụ miễn phí..."
            aria-label="Tìm kiếm trang, thiệp cưới và công cụ"
            className="min-h-[44px] w-full bg-transparent text-sm text-ink placeholder:text-ink-muted focus:outline-none"
          />
          <button
            type="button"
            onClick={handleClose}
            aria-label="Đóng hộp tìm kiếm"
            className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-ivory text-ink-secondary transition-colors duration-200 hover:bg-blush motion-reduce:transition-none cursor-pointer ${FOCUS_RING}`}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div
          className="max-h-[60dvh] overflow-y-auto p-2"
          role="listbox"
          aria-label="Kết quả tìm kiếm"
        >
          {grouped.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-ink-muted">
              Không tìm thấy mục phù hợp với &ldquo;{query}&rdquo;.
            </div>
          ) : (
            grouped.map((section) => (
              <div key={section.group} className="mb-2 last:mb-0">
                <p className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-ink-muted">
                  {GROUP_LABELS[section.group]}
                </p>
                <div className="space-y-0.5">
                  {section.items.map(({ action, index }) => {
                    const Icon = action.icon;
                    const isActive = index === activeIndex;
                    return (
                      <button
                        key={action.id}
                        type="button"
                        role="option"
                        aria-selected={isActive}
                        onMouseEnter={() => setActiveIndex(index)}
                        onClick={() => executeAction(action)}
                        className={`flex min-h-[44px] w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition-colors duration-200 motion-reduce:transition-none cursor-pointer ${FOCUS_RING} ${
                          isActive
                            ? "bg-blush text-burgundy"
                            : "text-ink hover:bg-blush-hover"
                        }`}
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <span
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                              isActive
                                ? "bg-burgundy text-ivory"
                                : "border border-border bg-surface text-ink-secondary"
                            }`}
                          >
                            <Icon className="h-4 w-4" aria-hidden="true" />
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{action.label}</p>
                            <p className="truncate text-xs text-ink-muted">{action.hint}</p>
                          </div>
                        </div>
                        {action.external ? (
                          <span className="shrink-0 rounded-full bg-amber-surface px-2.5 py-0.5 text-xs font-semibold text-amber-text">
                            Mở tab mới
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex items-center justify-between border-t border-border bg-surface px-4 py-2.5 text-xs text-ink-muted">
          <span>Dùng phím ↑ ↓ để chọn, Enter để mở</span>
          <span>Esc để đóng</span>
        </div>
      </div>
    </div>
  );
}
