"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarHeart,
  Crown,
  Heart,
  LayoutDashboard,
  LayoutTemplate,
  Menu,
  MessageSquareHeart,
  MonitorPlay,
  Search,
  Sparkles,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import { CommandPalette, type PaletteInvitationItem } from "@/components/dashboard/command-palette";
import { LogoutButton } from "@/components/dashboard/logout-button";
import { SITE_CONFIG } from "@/lib/site-config";
import { useDialogFocus } from "@/lib/use-dialog-focus";
import type { PlanTier } from "@/modules/billing/plans";

export interface AiCreditLedgerItem {
  id: string;
  delta: number;
  balanceAfter: number;
  reason: string;
  refId: string | null;
  createdAt: string;
}

export interface DashboardShellContextValue {
  user: {
    id: string;
    name: string;
    email: string;
    aiCredits: number;
  };
  planSku: PlanTier;
  planName: string;
  aiCreditLedger: AiCreditLedgerItem[];
}

const DashboardContext = React.createContext<DashboardShellContextValue | null>(null);

export function useDashboardContext(): DashboardShellContextValue | null {
  return React.useContext(DashboardContext);
}

interface DashboardShellProps {
  user: {
    id: string;
    name: string;
    email: string;
    aiCredits: number;
  };
  planSku: PlanTier;
  planName: string;
  invitations: PaletteInvitationItem[];
  aiCreditLedger: AiCreditLedgerItem[];
  children: React.ReactNode;
}

const NAV_ITEMS = [
  { href: "/dashboard", label: "Tổng quan", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/invitations", label: "Thiệp cưới của tôi", icon: LayoutTemplate, exact: false },
  { href: "/dashboard/wedding-profile", label: "Hồ sơ cưới", icon: CalendarHeart, exact: false },
  { href: "/dashboard/guests", label: "Khách mời & Zalo OG", icon: Users, exact: false },
  { href: "/dashboard/rsvp", label: "Phản hồi RSVP", icon: UserCheck, exact: false },
  { href: "/dashboard/wishes", label: "Hộp lời chúc", icon: MessageSquareHeart, exact: false },
  { href: "/dashboard/ai-magic", label: "AI Magic Setup", icon: Sparkles, exact: false },
  { href: "/dashboard/led-mod", label: "Màn hình LED Sảnh tiệc", icon: MonitorPlay, exact: false },
  { href: "/dashboard/billing", label: "Gói dịch vụ & Thanh toán", icon: Crown, exact: false },
] as const;

const FOCUS_RING =
  "focus-visible:outline-2 focus-visible:outline-burgundy focus-visible:outline-offset-2";

export function DashboardShell({
  user,
  planSku,
  planName,
  invitations,
  aiCreditLedger,
  children,
}: DashboardShellProps): React.ReactElement {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const drawerRef = React.useRef<HTMLDivElement>(null);

  const closeMobileDrawer = React.useCallback(() => {
    setMobileOpen(false);
  }, []);

  useDialogFocus(mobileOpen, drawerRef, { onClose: closeMobileDrawer });

  React.useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const contextValue = React.useMemo<DashboardShellContextValue>(
    () => ({
      user,
      planSku,
      planName,
      aiCreditLedger,
    }),
    [user, planSku, planName, aiCreditLedger],
  );

  const isNavActive = (href: string, exact: boolean): boolean => {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const renderNavLinks = (onItemClick?: () => void): React.ReactElement => (
    <nav aria-label="Điều hướng bảng điều khiển" className="flex-1 space-y-1 px-3 py-4">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const active = isNavActive(item.href, item.exact);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onItemClick}
            className={`flex min-h-[44px] items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors duration-200 motion-reduce:transition-none ${FOCUS_RING} ${
              active
                ? "bg-blush font-semibold text-burgundy"
                : "text-ink-secondary hover:bg-blush-hover hover:text-ink"
            }`}
          >
            <Icon
              className={`h-4 w-4 shrink-0 ${active ? "text-burgundy" : "text-ink-muted"}`}
              aria-hidden="true"
            />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );

  return (
    <DashboardContext.Provider value={contextValue}>
      <div className="min-h-dvh bg-ivory text-ink">
        <a
          href="#dashboard-main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-burgundy focus:px-4 focus:py-2.5 focus:text-xs focus:font-semibold focus:text-ivory focus:shadow-[var(--shadow-elevated)]"
        >
          Chuyển thẳng tới nội dung chính
        </a>

        {/* Desktop Sidebar */}
        <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col border-r border-border bg-surface lg:flex">
          <div className="flex h-16 items-center gap-2.5 border-b border-border px-5">
            <Link
              href="/"
              className={`flex min-h-[44px] items-center gap-2 rounded-full px-1 py-0.5 ${FOCUS_RING}`}
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-burgundy text-ivory">
                <Heart className="h-4 w-4 fill-current" aria-hidden="true" />
              </span>
              <span className="font-serif text-lg font-bold tracking-tight text-ink">
                {SITE_CONFIG.brandName}
              </span>
            </Link>
          </div>

          <div className="flex flex-1 flex-col overflow-y-auto">
            {renderNavLinks()}

            <div className="mt-auto border-t border-border p-4">
              <div className="rounded-xl border border-border bg-ivory p-3.5">
                <p className="truncate text-xs font-semibold text-ink">
                  {user.name || user.email}
                </p>
                <p className="mt-0.5 truncate text-xs text-ink-muted">{user.email}</p>
                <div className="mt-2.5 flex items-center justify-between gap-2">
                  <span className="rounded-full bg-amber-surface px-2.5 py-0.5 text-xs font-semibold text-amber-text">
                    {planName}
                  </span>
                  <Link
                    href="/dashboard/billing"
                    className={`inline-flex min-h-[44px] items-center text-xs font-semibold text-burgundy hover:underline ${FOCUS_RING}`}
                  >
                    Nâng cấp
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Mobile Drawer */}
        {mobileOpen ? (
          <div
            className="fixed inset-0 z-40 flex lg:hidden"
            role="dialog"
            aria-modal="true"
            aria-label="Menu điều hướng"
          >
            <div
              className="fixed inset-0 bg-ink/40 backdrop-blur-xs"
              onClick={closeMobileDrawer}
            />
            <div
              ref={drawerRef}
              tabIndex={-1}
              className="relative z-10 flex w-72 max-w-[85vw] flex-col border-r border-border bg-surface shadow-[var(--shadow-elevated)] outline-none"
            >
              <div className="flex h-16 items-center justify-between border-b border-border px-4">
                <Link
                  href="/"
                  className={`flex min-h-[44px] items-center gap-2 rounded-full px-1 py-0.5 ${FOCUS_RING}`}
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-burgundy text-ivory">
                    <Heart className="h-4 w-4 fill-current" aria-hidden="true" />
                  </span>
                  <span className="font-serif text-lg font-bold text-ink">
                    {SITE_CONFIG.brandName}
                  </span>
                </Link>
                <button
                  type="button"
                  onClick={closeMobileDrawer}
                  aria-label="Đóng menu"
                  className={`inline-flex h-11 w-11 items-center justify-center rounded-full border border-border bg-surface text-ink-secondary transition-colors duration-200 hover:bg-blush motion-reduce:transition-none cursor-pointer ${FOCUS_RING}`}
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
              <div className="flex flex-1 flex-col overflow-y-auto">
                {renderNavLinks(closeMobileDrawer)}
              </div>
            </div>
          </div>
        ) : null}

        {/* Main Column */}
        <div className="flex min-h-dvh flex-col lg:pl-64">
          <header className="sticky top-0 z-30 border-b border-border bg-ivory/90 backdrop-blur-md">
            <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-3 px-4 py-2 sm:px-6">
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setMobileOpen(true)}
                  aria-label="Mở menu điều hướng"
                  className={`inline-flex h-11 w-11 items-center justify-center rounded-full border border-border-strong bg-surface text-ink transition-colors duration-200 hover:bg-blush-hover motion-reduce:transition-none lg:hidden cursor-pointer ${FOCUS_RING}`}
                >
                  <Menu className="h-4 w-4" aria-hidden="true" />
                </button>

                <Link
                  href="/dashboard"
                  className={`flex min-h-[44px] items-center gap-2 rounded-full px-1 py-0.5 lg:hidden ${FOCUS_RING}`}
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-burgundy text-ivory">
                    <Heart className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                  </span>
                  <span className="font-serif text-base font-bold text-ink">
                    {SITE_CONFIG.brandName}
                  </span>
                </Link>

                <button
                  type="button"
                  onClick={() => setPaletteOpen(true)}
                  className={`inline-flex h-11 items-center gap-2 rounded-full border border-border-strong bg-surface px-3.5 text-xs text-ink-muted transition-colors duration-200 hover:border-burgundy/40 hover:bg-blush-hover hover:text-ink motion-reduce:transition-none sm:w-64 sm:justify-between cursor-pointer ${FOCUS_RING}`}
                >
                  <span className="flex items-center gap-2">
                    <Search className="h-3.5 w-3.5 text-ink-muted" aria-hidden="true" />
                    <span className="hidden sm:inline">Tìm nhanh trang, thiệp...</span>
                    <span className="sm:hidden">Tìm kiếm</span>
                  </span>
                  <kbd className="hidden rounded border border-border bg-ivory px-1.5 py-0.5 font-sans text-xs font-semibold text-ink-muted sm:inline-block">
                    ⌘K
                  </kbd>
                </button>
              </div>

              <div className="flex items-center gap-2.5 sm:gap-3">
                <Link
                  href="/dashboard/ai-magic"
                  className={`hidden min-h-[44px] items-center gap-1.5 rounded-full bg-amber-surface px-3.5 py-2 text-xs font-semibold text-amber-text transition-colors duration-200 hover:bg-blush motion-reduce:transition-none sm:inline-flex ${FOCUS_RING}`}
                >
                  <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="tabular-nums">{user.aiCredits} AI credits</span>
                </Link>

                <Link
                  href="/dashboard/billing"
                  className={`hidden min-h-[44px] items-center rounded-full border border-border bg-blush px-3.5 py-2 text-xs font-semibold text-burgundy transition-colors duration-200 hover:bg-border motion-reduce:transition-none md:inline-flex ${FOCUS_RING}`}
                >
                  Gói {planName}
                </Link>

                <LogoutButton />
              </div>
            </div>
          </header>

          <main
            id="dashboard-main"
            className="mx-auto w-full max-w-6xl flex-1 px-4 pt-8 pb-[calc(2rem+env(safe-area-inset-bottom))] sm:px-6"
          >
            {children}
          </main>
        </div>

        <CommandPalette
          open={paletteOpen}
          onOpenChange={setPaletteOpen}
          invitations={invitations}
        />
      </div>
    </DashboardContext.Provider>
  );
}
