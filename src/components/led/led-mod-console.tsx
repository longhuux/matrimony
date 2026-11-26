"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Check,
  Crown,
  Download,
  ExternalLink,
  EyeOff,
  Loader2,
  MonitorPlay,
  Plus,
  Printer,
  QrCode,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  Ticket,
  Trash2,
  Trophy,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type {
  LedCheckinCard,
  LedCheckinCounts,
  LedThemeMode,
} from "@/modules/led-realtime";
import { renderQrDataUrl } from "@/modules/vietqr/qr-render";

export interface LedModInvitationItem {
  id: string;
  slug: string;
  title: string;
  status: "draft" | "published" | "paused";
}

export interface LedModSessionItem {
  id: string;
  invitationId: string;
  stageCode: string;
  themeMode: LedThemeMode | string;
  autoApprove: boolean;
  blockedWords: string[];
  luckyDrawState: {
    winnerTicket?: string;
    winnerName?: string;
    drawnAt?: string;
  };
  isActive: boolean;
}

export interface LedModInitialFeed {
  pending: LedCheckinCard[];
  approved: LedCheckinCard[];
  rejected: LedCheckinCard[];
  counts: LedCheckinCounts;
}

export interface LedModConsoleProps {
  invitations: LedModInvitationItem[];
  initialSessions: LedModSessionItem[];
  initialSelectedInvitationId: string | null;
  initialFeed: LedModInitialFeed;
  planFeatures: {
    effectivePlan: string;
    planName: string;
    ledLuckyDraw: boolean;
    ledCheckinLimit: number;
  };
  publicOrigin: string;
}

type ModTab = "pending" | "approved" | "rejected";

const THEME_OPTIONS: Array<{ id: LedThemeMode; label: string; swatchClass: string }> = [
  { id: "aurora", label: "Aurora", swatchClass: "bg-gold" },
  { id: "velvet", label: "Velvet", swatchClass: "bg-burgundy" },
  { id: "starlight", label: "Starlight", swatchClass: "bg-stage-accent" },
  { id: "crimson", label: "Crimson", swatchClass: "bg-burgundy-dark" },
];

function normalizeTheme(raw: string | undefined): LedThemeMode {
  if (raw === "aurora" || raw === "velvet" || raw === "starlight" || raw === "crimson") {
    return raw;
  }
  return "aurora";
}

export function LedModConsole({
  invitations,
  initialSessions,
  initialSelectedInvitationId,
  initialFeed,
  planFeatures,
  publicOrigin,
}: LedModConsoleProps): React.ReactElement {
  const [selectedInvitationId, setSelectedInvitationId] = React.useState<string | null>(
    initialSelectedInvitationId,
  );
  const [sessions, setSessions] = React.useState<LedModSessionItem[]>(initialSessions);

  const [pending, setPending] = React.useState<LedCheckinCard[]>(initialFeed.pending);
  const [approved, setApproved] = React.useState<LedCheckinCard[]>(initialFeed.approved);
  const [rejected, setRejected] = React.useState<LedCheckinCard[]>(initialFeed.rejected);
  const [counts, setCounts] = React.useState<LedCheckinCounts>(initialFeed.counts);

  const [activeTab, setActiveTab] = React.useState<ModTab>("pending");
  const [activating, setActivating] = React.useState(false);
  const [savingSettings, setSavingSettings] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const [moderatingId, setModeratingId] = React.useState<string | null>(null);
  const [spinningLuckyDraw, setSpinningLuckyDraw] = React.useState(false);

  const [newBlockedWord, setNewBlockedWord] = React.useState("");
  const [statusNotice, setStatusNotice] = React.useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const [qrDataUrl, setQrDataUrl] = React.useState<string>("");

  const selectedInvitation = React.useMemo(
    () => invitations.find((inv) => inv.id === selectedInvitationId) ?? null,
    [invitations, selectedInvitationId],
  );

  const currentSession = React.useMemo(
    () =>
      selectedInvitation
        ? sessions.find((s) => s.invitationId === selectedInvitation.id) ?? null
        : null,
    [sessions, selectedInvitation],
  );

  const currentSessionId = currentSession?.id ?? null;
  const selectedSlug = selectedInvitation?.slug ?? null;
  const checkinPath = selectedSlug ? `/checkin/${encodeURIComponent(selectedSlug)}` : "";
  const stagePath = selectedSlug ? `/stage/${encodeURIComponent(selectedSlug)}` : "";
  const fullCheckinUrl = selectedSlug ? `${publicOrigin.replace(/\/+$/, "")}${checkinPath}` : "";

  const loadModerationFeed = React.useCallback(async (slug: string, silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const res = await fetch(`/api/led/${encodeURIComponent(slug)}/feed?scope=mod`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = (await res.json()) as {
        session?: Partial<LedModSessionItem>;
        pending?: LedCheckinCard[];
        approved?: LedCheckinCard[];
        rejected?: LedCheckinCard[];
        counts?: LedCheckinCounts;
      };
      if (Array.isArray(data.pending)) setPending(data.pending);
      if (Array.isArray(data.approved)) setApproved(data.approved);
      if (Array.isArray(data.rejected)) setRejected(data.rejected);
      if (data.counts) setCounts(data.counts);
      if (data.session) {
        setSessions((prev) =>
          prev.map((s) =>
            s.invitationId === selectedInvitationId
              ? {
                  ...s,
                  themeMode: data.session?.themeMode ?? s.themeMode,
                  autoApprove: data.session?.autoApprove ?? s.autoApprove,
                  isActive: data.session?.isActive ?? s.isActive,
                  luckyDrawState: data.session?.luckyDrawState ?? s.luckyDrawState,
                }
              : s,
          ),
        );
      }
    } catch {
      // Ignore transient refresh failure
    } finally {
      if (!silent) setRefreshing(false);
    }
  }, [selectedInvitationId]);

  // Generate QR data URL for Biển QR Bàn Tiệc
  React.useEffect(() => {
    if (!fullCheckinUrl) {
      setQrDataUrl("");
      return;
    }
    let cancelled = false;
    void renderQrDataUrl(fullCheckinUrl, 320).then((url) => {
      if (!cancelled) setQrDataUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [fullCheckinUrl]);

  // Reload moderation feed when switching invitation
  const skipInitialFetchRef = React.useRef(true);
  React.useEffect(() => {
    if (skipInitialFetchRef.current) {
      skipInitialFetchRef.current = false;
      return;
    }
    if (selectedSlug && currentSessionId) {
      void loadModerationFeed(selectedSlug);
    } else {
      setPending([]);
      setApproved([]);
      setRejected([]);
      setCounts({ pending: 0, approved: 0, rejected: 0, total: 0 });
    }
  }, [selectedSlug, currentSessionId, loadModerationFeed]);

  // Listen to SSE + 5s scope=mod feed refresh so new guest check-ins appear immediately
  React.useEffect(() => {
    if (!selectedSlug || !currentSessionId) return;

    const es = new EventSource(`/api/led/${encodeURIComponent(selectedSlug)}/stream`);
    const triggerSilentRefresh = (): void => {
      void loadModerationFeed(selectedSlug, true);
    };

    es.addEventListener("checkin_approved", triggerSilentRefresh);
    es.addEventListener("checkin_removed", triggerSilentRefresh);
    es.addEventListener("lucky_draw", triggerSilentRefresh);
    es.addEventListener("theme_changed", triggerSilentRefresh);

    const pollTimer = window.setInterval(() => {
      void loadModerationFeed(selectedSlug, true);
    }, 5000);

    return () => {
      es.close();
      window.clearInterval(pollTimer);
    };
  }, [selectedSlug, currentSessionId, loadModerationFeed]);

  const handleActivateLed = async (): Promise<void> => {
    if (!selectedInvitation) return;
    setActivating(true);
    setStatusNotice(null);
    try {
      const res = await fetch("/api/led/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invitationId: selectedInvitation.id }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        session?: LedModSessionItem;
        error?: string;
      };
      if (!res.ok || !data.session) {
        throw new Error(data.error || "Không thể kích hoạt màn hình LED.");
      }
      setSessions((prev) => {
        const filtered = prev.filter((s) => s.invitationId !== data.session!.invitationId);
        return [data.session!, ...filtered];
      });
      setStatusNotice({
        type: "success",
        text: `Đã kích hoạt Màn hình LED (${data.session.stageCode}) sẵn sàng cho sảnh tiệc!`,
      });
      await loadModerationFeed(selectedInvitation.slug, true);
    } catch (err) {
      setStatusNotice({
        type: "error",
        text: err instanceof Error ? err.message : "Không thể kích hoạt màn hình LED.",
      });
    } finally {
      setActivating(false);
    }
  };

  const patchSession = async (
    updates: Partial<{
      themeMode: LedThemeMode;
      autoApprove: boolean;
      blockedWords: string[];
      isActive: boolean;
    }>,
    successText: string,
  ): Promise<void> => {
    if (!currentSession) return;
    setSavingSettings(true);
    setStatusNotice(null);
    try {
      const res = await fetch("/api/led/sessions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: currentSession.id,
          ...updates,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        session?: LedModSessionItem;
        error?: string;
      };
      if (!res.ok || !data.session) {
        throw new Error(data.error || "Không thể cập nhật cấu hình LED.");
      }
      setSessions((prev) =>
        prev.map((s) => (s.id === data.session!.id ? data.session! : s)),
      );
      setStatusNotice({ type: "success", text: successText });
    } catch (err) {
      setStatusNotice({
        type: "error",
        text: err instanceof Error ? err.message : "Không thể cập nhật cấu hình LED.",
      });
    } finally {
      setSavingSettings(false);
    }
  };

  const handleAddBlockedWord = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    if (!currentSession) return;
    const term = newBlockedWord.trim();
    if (!term) return;
    if (currentSession.blockedWords.includes(term)) {
      setNewBlockedWord("");
      return;
    }
    const nextWords = [...currentSession.blockedWords, term];
    setNewBlockedWord("");
    await patchSession({ blockedWords: nextWords }, `Đã thêm từ khóa chặn "${term}".`);
  };

  const handleRemoveBlockedWord = async (word: string): Promise<void> => {
    if (!currentSession) return;
    const nextWords = currentSession.blockedWords.filter((w) => w !== word);
    await patchSession({ blockedWords: nextWords }, `Đã xóa từ khóa "${word}".`);
  };

  const handleModerate = async (
    checkinId: string,
    status: "approved" | "rejected",
  ): Promise<void> => {
    if (!selectedSlug) return;
    setModeratingId(checkinId);
    setStatusNotice(null);
    try {
      const res = await fetch(`/api/led/${encodeURIComponent(selectedSlug)}/moderate`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkinId, status }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        checkin?: LedCheckinCard;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || "Không thể cập nhật trạng thái check-in.");
      }
      await loadModerationFeed(selectedSlug, true);
      setStatusNotice({
        type: "success",
        text:
          status === "approved"
            ? "Đã duyệt lên màn hình LED!"
            : "Đã ẩn thẻ check-in khỏi màn hình LED.",
      });
    } catch (err) {
      setStatusNotice({
        type: "error",
        text: err instanceof Error ? err.message : "Có lỗi xảy ra khi duyệt.",
      });
    } finally {
      setModeratingId(null);
    }
  };

  const handleLuckyDraw = async (): Promise<void> => {
    if (!selectedSlug || !currentSession) return;
    setSpinningLuckyDraw(true);
    setStatusNotice(null);
    try {
      const res = await fetch(`/api/led/${encodeURIComponent(selectedSlug)}/lucky-draw`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          previousWinnerTicket: currentSession.luckyDrawState?.winnerTicket,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        winner?: {
          ticketNumber: string;
          guestName: string;
          drawnAt: string;
        };
        luckyDrawState?: LedModSessionItem["luckyDrawState"];
        error?: string;
      };
      if (!res.ok || !data.winner) {
        throw new Error(data.error || "Không thể quay số Lucky Draw lúc này.");
      }
      setSessions((prev) =>
        prev.map((s) =>
          s.id === currentSession.id
            ? {
                ...s,
                luckyDrawState: data.luckyDrawState ?? {
                  winnerTicket: data.winner!.ticketNumber,
                  winnerName: data.winner!.guestName,
                  drawnAt: data.winner!.drawnAt,
                },
              }
            : s,
        ),
      );
      setStatusNotice({
        type: "success",
        text: `Đã phát kết quả Lucky Draw lên màn hình LED: ${data.winner.ticketNumber} — ${data.winner.guestName}!`,
      });
    } catch (err) {
      setStatusNotice({
        type: "error",
        text: err instanceof Error ? err.message : "Không thể quay số Lucky Draw.",
      });
    } finally {
      setSpinningLuckyDraw(false);
    }
  };

  if (invitations.length === 0) {
    return (
      <Card className="p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blush text-burgundy">
          <MonitorPlay className="h-5 w-5" aria-hidden="true" />
        </div>
        <h2 className="mt-4 font-serif text-2xl font-bold text-ink">
          Bạn chưa có thiệp cưới nào
        </h2>
        <p className="mt-2 text-sm text-ink-secondary">
          Hãy tạo thiệp cưới đầu tiên trước khi kích hoạt Màn hình LED Check-in Sảnh Tiệc.
        </p>
        <div className="mt-6">
          <Link
            href="/dashboard/invitations"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-burgundy px-6 text-sm font-semibold text-ivory transition-colors duration-200 hover:bg-burgundy-dark focus-visible:outline-2 focus-visible:outline-burgundy focus-visible:outline-offset-2 motion-reduce:transition-none"
          >
            Tạo thiệp cưới ngay
          </Link>
        </div>
      </Card>
    );
  }

  const queueItems =
    activeTab === "pending" ? pending : activeTab === "approved" ? approved : rejected;

  return (
    <div className="space-y-6">
      {/* Invitation Selector Bar */}
      <Card className="p-5 print:hidden">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex-1">
            <label
              htmlFor="led-invitation-select"
              className="block text-xs font-semibold uppercase tracking-[0.04em] text-ink-secondary"
            >
              Chọn thiệp cưới điều khiển LED
            </label>
            <select
              id="led-invitation-select"
              value={selectedInvitationId ?? ""}
              onChange={(e) => {
                setSelectedInvitationId(e.target.value);
                setStatusNotice(null);
              }}
              className="mt-1.5 h-11 w-full max-w-md rounded-xl border border-border-strong bg-surface px-3 text-sm font-medium text-ink focus-visible:border-burgundy focus-visible:outline-2 focus-visible:outline-burgundy focus-visible:outline-offset-2"
            >
              {invitations.map((inv) => (
                <option key={inv.id} value={inv.id}>
                  {inv.title} ({inv.status === "published" ? "Đã phát hành" : "Bản nháp"})
                </option>
              ))}
            </select>
          </div>

          {selectedInvitation && currentSession ? (
            <div className="flex flex-wrap items-center gap-2.5">
              <Link
                href={stagePath}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full bg-stage-surface px-5 text-xs font-semibold text-stage-text transition-opacity duration-200 hover:opacity-90 focus-visible:outline-2 focus-visible:outline-burgundy focus-visible:outline-offset-2 motion-reduce:transition-none"
              >
                <MonitorPlay className="h-4 w-4 text-stage-accent" aria-hidden="true" />
                Mở Màn hình LED 16:9
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
              <Link
                href={checkinPath}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full border border-border-strong bg-surface px-4 text-xs font-semibold text-ink transition-colors duration-200 hover:bg-blush-hover focus-visible:outline-2 focus-visible:outline-burgundy focus-visible:outline-offset-2 motion-reduce:transition-none"
              >
                <QrCode className="h-4 w-4 text-burgundy" aria-hidden="true" />
                Trang Check-in khách
              </Link>
            </div>
          ) : null}
        </div>

        {statusNotice ? (
          <div
            role={statusNotice.type === "error" ? "alert" : "status"}
            aria-live="polite"
            className={`mt-4 rounded-xl border px-4 py-2.5 text-xs font-medium ${
              statusNotice.type === "error"
                ? "border-red-300 bg-red-50 text-red-900"
                : "border-emerald-300 bg-emerald-50 text-emerald-900"
            }`}
          >
            {statusNotice.text}
          </div>
        ) : null}
      </Card>

      {/* Activate LED Session Card if none exists */}
      {selectedInvitation && !currentSession ? (
        <Card className="p-8 text-center print:hidden">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blush text-burgundy">
            <Sparkles className="h-6 w-6" aria-hidden="true" />
          </div>
          <h2 className="mt-4 font-serif text-2xl font-bold text-ink">
            Kích hoạt Màn hình LED cho {selectedInvitation.title}
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-ink-secondary">
            Tạo mã sân khấu riêng để khách mời quét QR gửi ảnh &amp; lời chúc bay lên màn hình lớn
            realtime, kèm bảng kiểm duyệt MC 1 chạm.
          </p>
          {selectedInvitation.status !== "published" ? (
            <p className="mt-3 inline-block rounded-full bg-amber-surface px-3.5 py-1 text-xs font-medium text-amber-text">
              Lưu ý: Thiệp đang ở trạng thái bản nháp — hãy phát hành thiệp để khách có thể truy
              cập trang Check-in.
            </p>
          ) : null}
          <div className="mt-6">
            <Button type="button" size="lg" onClick={handleActivateLed} disabled={activating}>
              {activating ? (
                <>
                  <Loader2
                    className="h-4 w-4 animate-spin motion-reduce:animate-none"
                    aria-hidden="true"
                  />
                  Đang kích hoạt...
                </>
              ) : (
                <>
                  <MonitorPlay className="h-4 w-4" aria-hidden="true" />
                  Kích hoạt Màn hình LED
                </>
              )}
            </Button>
          </div>
        </Card>
      ) : null}

      {selectedInvitation && currentSession ? (
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Left 8 cols: Moderation Queue + 1-Tap Controls */}
          <div className="space-y-6 lg:col-span-8 print:hidden">
            {/* 1-Tap Stage Controls */}
            <Card className="p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-text">
                    Mã sân khấu: {currentSession.stageCode}
                  </span>
                  <h2 className="mt-0.5 font-serif text-xl font-bold text-ink">
                    Cài đặt Sân khấu 1 Chạm
                  </h2>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="md"
                    variant={currentSession.isActive ? "secondary" : "primary"}
                    disabled={savingSettings}
                    onClick={() =>
                      patchSession(
                        { isActive: !currentSession.isActive },
                        !currentSession.isActive
                          ? "Đã mở nhận Check-in mới từ khách mời."
                          : "Đã tạm khóa nhận Check-in mới.",
                      )
                    }
                  >
                    {currentSession.isActive ? "Đang mở Check-in" : "Mở lại Check-in"}
                  </Button>
                </div>
              </div>

              <div className="mt-4 grid gap-5 sm:grid-cols-2">
                {/* Theme Selector */}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.04em] text-ink-secondary">
                    Giao diện Màn hình LED
                  </p>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {THEME_OPTIONS.map((opt) => {
                      const active = normalizeTheme(currentSession.themeMode) === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          disabled={savingSettings}
                          onClick={() =>
                            patchSession(
                              { themeMode: opt.id },
                              `Đã chuyển giao diện LED sang ${opt.label}.`,
                            )
                          }
                          className={`flex min-h-[44px] items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors duration-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-burgundy focus-visible:outline-offset-2 motion-reduce:transition-none ${
                            active
                              ? "border-burgundy bg-blush text-burgundy"
                              : "border-border bg-surface text-ink hover:bg-blush-hover"
                          }`}
                        >
                          <span
                            className={`h-3.5 w-3.5 rounded-full border border-ink/15 ${opt.swatchClass}`}
                            aria-hidden="true"
                          />
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Auto-Approve Toggle */}
                <div className="flex flex-col justify-between rounded-2xl border border-border bg-ivory p-4">
                  <div>
                    <div className="flex items-center justify-between gap-3">
                      <label
                        htmlFor="led-auto-approve-switch"
                        className="cursor-pointer text-sm font-semibold text-ink"
                      >
                        Tự động duyệt (Auto-Approve)
                      </label>
                      <button
                        id="led-auto-approve-switch"
                        type="button"
                        role="switch"
                        aria-checked={currentSession.autoApprove}
                        disabled={savingSettings}
                        onClick={() =>
                          patchSession(
                            { autoApprove: !currentSession.autoApprove },
                            !currentSession.autoApprove
                              ? "Đã bật Tự động duyệt lời chúc hợp lệ."
                              : "Đã chuyển sang chế độ MC duyệt thủ công.",
                          )
                        }
                        className="inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-end rounded-full cursor-pointer focus-visible:outline-2 focus-visible:outline-burgundy focus-visible:outline-offset-2"
                      >
                        <span
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 motion-reduce:transition-none ${
                            currentSession.autoApprove ? "bg-burgundy" : "bg-border-strong"
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-surface transition-transform duration-200 motion-reduce:transition-none ${
                              currentSession.autoApprove ? "translate-x-6" : "translate-x-1"
                            }`}
                          />
                        </span>
                      </button>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-ink-secondary">
                      Khi bật, ảnh và lời chúc không chứa từ khóa chặn sẽ bay thẳng lên màn hình LED
                      mà không cần bấm duyệt tay.
                    </p>
                  </div>
                </div>
              </div>

              {/* Blocked Words Editor */}
              <div className="mt-5 border-t border-border pt-4">
                <label
                  htmlFor="led-blocked-word-input"
                  className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.04em] text-ink-secondary"
                >
                  <ShieldAlert className="h-3.5 w-3.5 text-burgundy" aria-hidden="true" />
                  <span>
                    Từ khóa chặn bổ sung (
                    <span className="tabular-nums">{currentSession.blockedWords.length}</span>)
                  </span>
                </label>
                <form onSubmit={handleAddBlockedWord} className="mt-2 flex gap-2">
                  <input
                    id="led-blocked-word-input"
                    type="text"
                    value={newBlockedWord}
                    onChange={(e) => setNewBlockedWord(e.target.value)}
                    maxLength={60}
                    placeholder="Thêm từ khóa nhạy cảm cần giữ lại chờ duyệt..."
                    className="h-11 flex-1 rounded-xl border border-border-strong bg-surface px-3 text-sm text-ink placeholder:text-ink-muted focus-visible:border-burgundy focus-visible:outline-2 focus-visible:outline-burgundy focus-visible:outline-offset-2"
                  />
                  <Button
                    type="submit"
                    size="md"
                    variant="secondary"
                    disabled={savingSettings}
                    className="min-h-[44px]"
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Thêm
                  </Button>
                </form>

                {currentSession.blockedWords.length > 0 ? (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {currentSession.blockedWords.map((word) => (
                      <span
                        key={word}
                        className="inline-flex items-center gap-1 rounded-full border border-border bg-blush pl-3 pr-1 py-1 text-xs font-medium text-ink"
                      >
                        {word}
                        <button
                          type="button"
                          onClick={() => handleRemoveBlockedWord(word)}
                          aria-label={`Xóa từ khóa ${word}`}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-full text-ink-muted transition-colors duration-200 hover:text-burgundy cursor-pointer focus-visible:outline-2 focus-visible:outline-burgundy focus-visible:outline-offset-2 motion-reduce:transition-none"
                        >
                          <X className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            </Card>

            {/* Tabbed Moderation Queue */}
            <Card className="p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2" role="tablist" aria-label="Hàng đợi duyệt LED">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === "pending"}
                    onClick={() => setActiveTab("pending")}
                    className={`min-h-[44px] rounded-full px-4 text-xs font-semibold tabular-nums transition-colors duration-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-burgundy focus-visible:outline-offset-2 motion-reduce:transition-none ${
                      activeTab === "pending"
                        ? "bg-burgundy text-ivory"
                        : "bg-blush text-ink hover:bg-border"
                    }`}
                  >
                    Chờ duyệt ({counts.pending})
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === "approved"}
                    onClick={() => setActiveTab("approved")}
                    className={`min-h-[44px] rounded-full px-4 text-xs font-semibold tabular-nums transition-colors duration-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-burgundy focus-visible:outline-offset-2 motion-reduce:transition-none ${
                      activeTab === "approved"
                        ? "bg-burgundy text-ivory"
                        : "bg-blush text-ink hover:bg-border"
                    }`}
                  >
                    Đang chiếu trên LED ({counts.approved})
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === "rejected"}
                    onClick={() => setActiveTab("rejected")}
                    className={`min-h-[44px] rounded-full px-4 text-xs font-semibold tabular-nums transition-colors duration-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-burgundy focus-visible:outline-offset-2 motion-reduce:transition-none ${
                      activeTab === "rejected"
                        ? "bg-burgundy text-ivory"
                        : "bg-blush text-ink hover:bg-border"
                    }`}
                  >
                    Đã ẩn ({counts.rejected})
                  </button>
                </div>

                <Button
                  type="button"
                  size="md"
                  variant="outline"
                  disabled={refreshing}
                  onClick={() => selectedSlug && loadModerationFeed(selectedSlug)}
                  className="min-h-[44px]"
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 ${
                      refreshing ? "animate-spin motion-reduce:animate-none" : ""
                    }`}
                    aria-hidden="true"
                  />
                  Làm mới
                </Button>
              </div>

              <div className="mt-5 space-y-3">
                {queueItems.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border-strong bg-ivory p-8 text-center text-sm text-ink-muted">
                    {activeTab === "pending"
                      ? "Chưa có check-in nào đang chờ duyệt."
                      : activeTab === "approved"
                        ? "Chưa có thẻ check-in nào đang chiếu trên màn hình LED."
                        : "Chưa có thẻ check-in nào bị ẩn."}
                  </div>
                ) : (
                  queueItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex flex-col gap-4 rounded-2xl border border-border bg-ivory p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex items-start gap-3.5">
                        {item.photoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={item.photoUrl}
                            alt={item.guestName}
                            decoding="async"
                            className="h-20 w-20 shrink-0 rounded-xl border border-border object-cover"
                          />
                        ) : (
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blush text-xs font-bold tabular-nums text-burgundy">
                            {item.ticketNumber}
                          </div>
                        )}

                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-ink">{item.guestName}</span>
                            <span className="rounded-full bg-amber-surface px-2.5 py-0.5 text-xs font-bold tabular-nums text-amber-text">
                              {item.ticketNumber}
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-ink-secondary">
                            {item.message || "(Chỉ gửi ảnh kỷ niệm)"}
                          </p>
                          <p className="mt-1 text-xs tabular-nums text-ink-muted">
                            {new Date(item.createdAt).toLocaleTimeString("vi-VN", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                      </div>

                      <div className="flex shrink-0 flex-wrap items-center gap-2">
                        {activeTab === "pending" ? (
                          <>
                            <Button
                              type="button"
                              size="md"
                              className="min-h-[44px]"
                              disabled={moderatingId === item.id}
                              onClick={() => handleModerate(item.id, "approved")}
                            >
                              <Check className="h-4 w-4" aria-hidden="true" />
                              Duyệt lên LED
                            </Button>
                            <Button
                              type="button"
                              size="md"
                              variant="outline"
                              className="min-h-[44px]"
                              disabled={moderatingId === item.id}
                              onClick={() => handleModerate(item.id, "rejected")}
                            >
                              <Trash2 className="h-4 w-4" aria-hidden="true" />
                              Từ chối
                            </Button>
                          </>
                        ) : null}

                        {activeTab === "approved" ? (
                          <Button
                            type="button"
                            size="md"
                            variant="outline"
                            className="min-h-[44px]"
                            disabled={moderatingId === item.id}
                            onClick={() => handleModerate(item.id, "rejected")}
                          >
                            <EyeOff className="h-4 w-4 text-burgundy" aria-hidden="true" />
                            Ẩn khẩn cấp
                          </Button>
                        ) : null}

                        {activeTab === "rejected" ? (
                          <Button
                            type="button"
                            size="md"
                            variant="secondary"
                            className="min-h-[44px]"
                            disabled={moderatingId === item.id}
                            onClick={() => handleModerate(item.id, "approved")}
                          >
                            <RotateCcw className="h-4 w-4" aria-hidden="true" />
                            Chiếu lại lên LED
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>

          {/* Right 4 cols: Lucky Draw + Printable Biển QR Bàn Tiệc */}
          <div className="space-y-6 lg:col-span-4">
            {/* Lucky Draw Panel */}
            <Card className="border-gold/60 p-5 sm:p-6 print:hidden">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-surface px-3 py-1 text-xs font-semibold text-amber-text">
                  <Trophy className="h-3.5 w-3.5" aria-hidden="true" />
                  Minigame Sân Khấu
                </span>
                <span className="text-xs font-medium tabular-nums text-ink-muted">
                  {counts.approved} vé hợp lệ
                </span>
              </div>

              <h2 className="mt-3 font-serif text-xl font-bold text-ink">
                Quay số Lucky Draw
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-ink-secondary">
                Chọn ngẫu nhiên 1 khách mời đã được duyệt lên màn hình LED và phát hiệu ứng chúc
                mừng trực tiếp lên sân khấu.
              </p>

              {currentSession.luckyDrawState?.winnerTicket ? (
                <div className="mt-4 rounded-2xl border border-gold bg-amber-surface p-4 text-center">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-text">
                    Người trúng thưởng gần nhất
                  </p>
                  <p className="mt-1 font-serif text-3xl font-bold tabular-nums text-burgundy">
                    {currentSession.luckyDrawState.winnerTicket}
                  </p>
                  <p className="text-sm font-semibold text-ink">
                    {currentSession.luckyDrawState.winnerName}
                  </p>
                </div>
              ) : null}

              {planFeatures.ledLuckyDraw ? (
                <div className="mt-5">
                  <Button
                    type="button"
                    size="lg"
                    className="min-h-[44px] w-full"
                    disabled={spinningLuckyDraw || counts.approved === 0}
                    onClick={handleLuckyDraw}
                  >
                    {spinningLuckyDraw ? (
                      <>
                        <Loader2
                          className="h-4 w-4 animate-spin motion-reduce:animate-none"
                          aria-hidden="true"
                        />
                        Đang quay số...
                      </>
                    ) : (
                      <>
                        <Ticket className="h-4 w-4" aria-hidden="true" />
                        Quay số Lucky Draw
                      </>
                    )}
                  </Button>
                  {counts.approved === 0 ? (
                    <p className="mt-2 text-center text-xs text-ink-muted">
                      Cần ít nhất 1 check-in đã duyệt để bắt đầu quay số.
                    </p>
                  ) : null}
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-border bg-blush p-4">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-burgundy">
                    <Crown className="h-4 w-4" aria-hidden="true" />
                    Nâng cấp để mở khóa Lucky Draw
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-ink-secondary">
                    Gói <strong>{planFeatures.planName}</strong> hiện chưa bao gồm Quay số Lucky
                    Draw. Nâng cấp lên gói <strong>Combo Full Đám Cưới</strong> (249.000đ) hoặc{" "}
                    <strong>Pilot Studio</strong> để sử dụng không giới hạn.
                  </p>
                  <Link
                    href="/dashboard/billing"
                    className="mt-3 inline-flex min-h-[44px] items-center justify-center rounded-full bg-burgundy px-4 text-xs font-semibold text-ivory transition-colors duration-200 hover:bg-burgundy-dark focus-visible:outline-2 focus-visible:outline-burgundy focus-visible:outline-offset-2 motion-reduce:transition-none"
                  >
                    Nâng cấp gói ngay
                  </Link>
                </div>
              )}
            </Card>

            {/* Printable Biển QR Bàn Tiệc Card */}
            <Card className="p-5 sm:p-6 print:border-gold print:shadow-none">
              <div className="flex items-center justify-between print:hidden">
                <h2 className="font-serif text-xl font-bold text-ink">
                  Biển QR Bàn Tiệc
                </h2>
                <span className="rounded-full bg-blush px-2.5 py-0.5 text-xs font-semibold text-burgundy">
                  Sẵn sàng in
                </span>
              </div>

              {/* Standee Frame */}
              <div className="mt-4 rounded-2xl border-2 border-gold bg-ivory p-5 text-center">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-burgundy">
                  Check-in Màn Hình LED
                </p>
                <h3 className="mt-1.5 font-serif text-xl font-bold text-ink">
                  {selectedInvitation.title}
                </h3>

                <div className="mx-auto mt-4 inline-block rounded-2xl border border-border bg-white p-3">
                  {qrDataUrl ? (
                    <Image
                      unoptimized
                      src={qrDataUrl}
                      alt={`QR Check-in ${selectedInvitation.title}`}
                      width={176}
                      height={176}
                      className="h-44 w-44"
                    />
                  ) : (
                    <div className="flex h-44 w-44 items-center justify-center text-xs text-ink-muted">
                      Đang tạo mã QR...
                    </div>
                  )}
                </div>

                <p className="mt-3 text-xs font-medium text-ink-secondary">
                  Quét mã QR bằng Camera hoặc Zalo để gửi ảnh &amp; lời chúc lên sân khấu và nhận số
                  may mắn!
                </p>
                <p className="mt-1.5 text-xs font-semibold text-amber-text">
                  Mã sân khấu: {currentSession.stageCode}
                </p>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 print:hidden">
                <Button
                  type="button"
                  size="md"
                  variant="secondary"
                  className="min-h-[44px]"
                  onClick={() => window.print()}
                >
                  <Printer className="h-4 w-4" aria-hidden="true" />
                  In biển QR
                </Button>
                {qrDataUrl ? (
                  <a
                    href={qrDataUrl}
                    download={`qr-led-${selectedInvitation.slug}.png`}
                    className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-full border border-border-strong bg-surface px-4 text-xs font-medium text-ink transition-colors duration-200 hover:bg-blush-hover focus-visible:outline-2 focus-visible:outline-burgundy focus-visible:outline-offset-2 motion-reduce:transition-none"
                  >
                    <Download className="h-4 w-4" aria-hidden="true" />
                    Tải ảnh QR
                  </a>
                ) : null}
              </div>

              <div className="mt-3 space-y-1 text-xs text-ink-muted print:hidden">
                <p className="truncate">
                  Link Check-in:{" "}
                  <Link
                    href={checkinPath}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-burgundy hover:underline focus-visible:outline-2 focus-visible:outline-burgundy focus-visible:outline-offset-2 rounded"
                  >
                    {checkinPath}
                  </Link>
                </p>
                <p className="truncate">
                  Link Sân khấu LED:{" "}
                  <Link
                    href={stagePath}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-burgundy hover:underline focus-visible:outline-2 focus-visible:outline-burgundy focus-visible:outline-offset-2 rounded"
                  >
                    {stagePath}
                  </Link>
                </p>
              </div>
            </Card>
          </div>
        </div>
      ) : null}
    </div>
  );
}
