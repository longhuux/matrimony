"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Copy,
  ExternalLink,
  History,
  Image as ImageIcon,
  Layers,
  Monitor,
  Palette,
  PenLine,
  Redo2,
  Save,
  Share2,
  Smartphone,
  Sparkles,
  Undo2,
  X,
} from "lucide-react";
import { InvitationRenderer } from "@/components/invitation/invitation-renderer";
import { Button } from "@/components/ui/button";
import { useDialogFocus } from "@/lib/use-dialog-focus";
import type {
  InvitationDocumentV2,
  WeddingProfileData,
} from "@/modules/invitation-engine/schema";
import {
  saveLocalBackup,
  useEditorStore,
  type InvitationStatus,
} from "@/stores/editor-store";
import { OverlayPanel } from "./overlay-panel";
import { QuickPanel } from "./quick-panel";
import { VersionHistoryDrawer } from "./version-history-drawer";

export interface EditorTemplateOption {
  slug: string;
  name: string;
  description: string;
  category: string;
  tier: "free" | "pro";
  thumbnailUrl?: string;
  defaultDoc: InvitationDocumentV2;
}

export interface EditorProfileOption {
  id: string;
  name: string;
  data: WeddingProfileData;
}

export interface EditorWorkspaceProps {
  initialInvitation: {
    id: string;
    slug: string;
    title: string;
    status: InvitationStatus;
    version: number;
    docJson: InvitationDocumentV2;
    updatedAt: string;
  };
  templates: EditorTemplateOption[];
  profiles: EditorProfileOption[];
  userPlan: {
    tier: string;
    name: string;
    aiCredits: number;
    features: {
      removeWatermark: boolean;
      premiumTemplates: boolean;
      dynamicZaloOg: boolean;
      customMusic: boolean;
    };
  };
}

type EditorTab = "style" | "content" | "media" | "overlay";

const STATUS_BADGE_MAP: Record<
  InvitationStatus,
  { label: string; className: string }
> = {
  draft: {
    label: "Bản nháp",
    className: "bg-amber-surface text-amber-text border-border",
  },
  published: {
    label: "Đang hiển thị",
    className: "bg-emerald-50 text-emerald-800 border-emerald-200",
  },
  paused: {
    label: "Tạm ẩn",
    className: "bg-surface text-ink-muted border-border-strong",
  },
};

function formatSavedTime(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return "";
  }
}

export function EditorWorkspace({
  initialInvitation,
  templates,
  profiles,
  userPlan,
}: EditorWorkspaceProps): React.ReactElement {
  const {
    invitationId,
    slug,
    status,
    title,
    version,
    doc,
    past,
    future,
    isDirty,
    saving,
    lastSavedAt,
    conflict,
    tabConflictWarning,
    init,
    updateDoc,
    undo,
    redo,
    switchTemplate,
    applyProfile,
    updateTitle,
    setSaving,
    markSaved,
    applyServerSnapshot,
    setMeta,
    setConflict,
    setTabConflict,
  } = useEditorStore();

  const [activeTab, setActiveTab] = React.useState<EditorTab>("style");
  const [previewMode, setPreviewMode] = React.useState<"mobile" | "desktop">("mobile");
  const [mobilePane, setMobilePane] = React.useState<"edit" | "preview">("edit");
  const [historyOpen, setHistoryOpen] = React.useState(false);
  const [publishOpen, setPublishOpen] = React.useState(false);
  const [aiCredits, setAiCredits] = React.useState(userPlan.aiCredits);
  const [saveFeedback, setSaveFeedback] = React.useState<string | null>(null);

  // Publish modal local fields
  const [draftSlug, setDraftSlug] = React.useState(initialInvitation.slug);
  const [draftStatus, setDraftStatus] = React.useState<InvitationStatus>(
    initialInvitation.status,
  );
  const [publishing, setPublishing] = React.useState(false);
  const [publishError, setPublishError] = React.useState<string | null>(null);
  const [copiedLink, setCopiedLink] = React.useState(false);

  const tabIdRef = React.useRef<string>(
    `tab_${Math.random().toString(36).slice(2, 10)}`,
  );
  const broadcastRef = React.useRef<BroadcastChannel | null>(null);
  const conflictModalRef = React.useRef<HTMLDivElement | null>(null);
  const publishModalRef = React.useRef<HTMLDivElement | null>(null);

  useDialogFocus(Boolean(conflict), conflictModalRef);
  useDialogFocus(publishOpen, publishModalRef, {
    onClose: () => setPublishOpen(false),
  });

  // Initialize store once for this invitation ID
  React.useEffect(() => {
    init({
      invitationId: initialInvitation.id,
      slug: initialInvitation.slug,
      status: initialInvitation.status,
      title: initialInvitation.title,
      version: initialInvitation.version,
      doc: initialInvitation.docJson,
      lastSavedAt: initialInvitation.updatedAt,
    });
    setDraftSlug(initialInvitation.slug);
    setDraftStatus(initialInvitation.status);
  }, [
    init,
    initialInvitation.id,
    initialInvitation.slug,
    initialInvitation.status,
    initialInvitation.title,
    initialInvitation.version,
    initialInvitation.docJson,
    initialInvitation.updatedAt,
  ]);

  // Warn before leaving when un-synced local edits exist
  const hasUnsavedChanges = isDirty;
  React.useEffect(() => {
    if (!hasUnsavedChanges) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent): void => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Save local backup ring buffer when document becomes dirty (debounced)
  React.useEffect(() => {
    if (!invitationId || !isDirty) return;
    const timer = window.setTimeout(() => {
      saveLocalBackup(invitationId, doc);
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [invitationId, doc, isDirty]);

  const performSave = React.useCallback(
    async (
      source: "manual" | "auto",
      overrideExpectedVersion?: number,
    ): Promise<boolean> => {
      const state = useEditorStore.getState();
      if (!state.invitationId || state.saving) return false;
      const expectedVersion = overrideExpectedVersion ?? state.version;

      setSaving(true);
      setSaveFeedback(null);

      try {
        const res = await fetch(
          `/api/invitations/${encodeURIComponent(state.invitationId)}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: state.title.trim() || "Thiệp cưới",
              docJson: state.doc,
              expectedVersion,
              source,
            }),
          },
        );

        const data = (await res.json().catch(() => ({}))) as {
          invitation?: {
            version: number;
            updatedAt: string;
          };
          code?: string;
          serverVersion?: number;
          serverDoc?: InvitationDocumentV2;
          error?: string;
        };

        if (res.status === 409 && data.code === "VERSION_CONFLICT") {
          if (data.serverVersion && data.serverDoc) {
            setConflict({
              serverVersion: data.serverVersion,
              serverDoc: data.serverDoc,
            });
          } else {
            setSaving(false);
            setSaveFeedback(
              data.error || "Phiên bản đã thay đổi ở tab khác.",
            );
          }
          return false;
        }

        if (!res.ok || !data.invitation) {
          throw new Error(data.error || "Không thể lưu thiệp.");
        }

        const updatedAt =
          data.invitation.updatedAt || new Date().toISOString();
        markSaved(data.invitation.version, updatedAt);
        saveLocalBackup(state.invitationId, state.doc);

        broadcastRef.current?.postMessage({
          type: "saved",
          invitationId: state.invitationId,
          tabId: tabIdRef.current,
          version: data.invitation.version,
          updatedAt,
        });

        if (source === "manual") {
          setSaveFeedback("Đã lưu thành công");
        }
        return true;
      } catch (err) {
        setSaving(false);
        setSaveFeedback(
          err instanceof Error ? err.message : "Lưu thiệp thất bại.",
        );
        return false;
      }
    },
    [markSaved, setConflict, setSaving],
  );

  // 30-second AutoSave timer
  React.useEffect(() => {
    const timer = window.setInterval(() => {
      const state = useEditorStore.getState();
      if (state.isDirty && !state.saving && !state.conflict) {
        void performSave("auto");
      }
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [performSave]);

  // Keyboard shortcuts: Cmd/Ctrl+S, Cmd/Ctrl+Z, Cmd/Ctrl+Shift+Z / Ctrl+Y
  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const hasModifier = event.metaKey || event.ctrlKey;
      if (!hasModifier) return;

      const key = event.key.toLowerCase();
      if (key === "s") {
        event.preventDefault();
        void performSave("manual");
        return;
      }

      const target = event.target as HTMLElement | null;
      const isEditableField =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT" ||
        Boolean(target?.isContentEditable);
      if (isEditableField) return;

      if (key === "z" && !event.shiftKey) {
        event.preventDefault();
        undo();
      } else if ((key === "z" && event.shiftKey) || key === "y") {
        event.preventDefault();
        redo();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [performSave, undo, redo]);

  // BroadcastChannel multi-tab awareness & saved sync
  React.useEffect(() => {
    if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") {
      return;
    }
    const channel = new BroadcastChannel("matrimony-editor");
    broadcastRef.current = channel;

    const handleMessage = (event: MessageEvent): void => {
      const msg = event.data as
        | {
            type?: string;
            invitationId?: string;
            tabId?: string;
            version?: number;
          }
        | undefined;
      if (!msg || msg.invitationId !== initialInvitation.id) return;
      if (msg.tabId === tabIdRef.current) return;

      if (msg.type === "open") {
        setTabConflict(true);
        channel.postMessage({
          type: "open-ack",
          invitationId: initialInvitation.id,
          tabId: tabIdRef.current,
        });
      } else if (msg.type === "open-ack") {
        setTabConflict(true);
      } else if (msg.type === "saved") {
        setTabConflict(true);
        setSaveFeedback(
          `Tab khác vừa lưu phiên bản v${msg.version ?? "?"}. Hãy tải lại nếu cần đồng bộ.`,
        );
      }
    };

    channel.addEventListener("message", handleMessage);
    channel.postMessage({
      type: "open",
      invitationId: initialInvitation.id,
      tabId: tabIdRef.current,
    });

    return () => {
      channel.removeEventListener("message", handleMessage);
      channel.close();
      broadcastRef.current = null;
    };
  }, [initialInvitation.id, setTabConflict]);

  const handleOpenPublishModal = (): void => {
    setDraftSlug(slug);
    setDraftStatus(status);
    setPublishError(null);
    setCopiedLink(false);
    setPublishOpen(true);
  };

  const handlePublishSubmit = async (
    event: React.FormEvent,
  ): Promise<void> => {
    event.preventDefault();
    setPublishing(true);
    setPublishError(null);

    try {
      if (isDirty) {
        const savedOk = await performSave("manual");
        if (!savedOk) {
          throw new Error("Vui lòng lưu hoặc xử lý xung đột trước khi xuất bản.");
        }
      }

      const normalizedSlug = draftSlug.trim().toLowerCase();
      const res = await fetch(
        `/api/invitations/${encodeURIComponent(invitationId)}/publish`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: draftStatus,
            slug: normalizedSlug,
          }),
        },
      );
      const data = (await res.json().catch(() => ({}))) as {
        invitation?: {
          slug: string;
          status: InvitationStatus;
        };
        error?: string;
      };

      if (!res.ok || !data.invitation) {
        throw new Error(data.error || "Không thể cập nhật trạng thái xuất bản.");
      }

      setMeta({
        slug: data.invitation.slug,
        status: data.invitation.status,
      });
      setDraftSlug(data.invitation.slug);
      setDraftStatus(data.invitation.status);
    } catch (err) {
      setPublishError(
        err instanceof Error ? err.message : "Xuất bản thiệp thất bại.",
      );
    } finally {
      setPublishing(false);
    }
  };

  const handleCopyPublicLink = async (): Promise<void> => {
    if (typeof window === "undefined") return;
    const url = `${window.location.origin}/s/${slug}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedLink(true);
      window.setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      setCopiedLink(false);
    }
  };

  const statusMeta = STATUS_BADGE_MAP[status];
  const canUndo = past.length > 0;
  const canRedo = future.length > 0;

  return (
    <div className="flex min-h-dvh flex-col bg-ivory text-ink lg:h-dvh lg:overflow-hidden">
      <a
        href="#editor-canvas"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-full focus:bg-burgundy focus:px-4 focus:py-2 focus:text-xs focus:font-semibold focus:text-ivory focus:shadow-[var(--shadow-elevated)]"
      >
        Chuyển tới khung xem trước thiệp
      </a>

      {/* Top Studio Bar */}
      <header className="sticky top-0 z-30 border-b border-border bg-surface/95 backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 sm:px-5">
          {/* Left group */}
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
            <Link
              href="/dashboard/invitations"
              aria-label="Quay lại danh sách thiệp"
              className="inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-full border border-border bg-surface px-3 text-xs font-semibold text-ink transition-colors duration-200 hover:bg-blush-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-burgundy motion-reduce:transition-none"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Thiệp của tôi</span>
            </Link>

            <input
              type="text"
              aria-label="Tên thiệp cưới"
              value={title}
              onChange={(e) => updateTitle(e.target.value)}
              maxLength={120}
              className="h-10 min-w-[120px] max-w-[260px] flex-1 rounded-xl border border-transparent bg-transparent px-2.5 font-serif text-base font-bold text-ink transition-colors duration-200 hover:border-border focus:border-border-strong focus:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-burgundy motion-reduce:transition-none"
            />

            <span
              className={`hidden rounded-full border px-2.5 py-0.5 text-xs font-semibold md:inline-flex ${statusMeta.className}`}
            >
              {statusMeta.label}
            </span>
          </div>

          {/* Center / Right Controls */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            {/* Undo / Redo */}
            <div className="flex items-center rounded-full border border-border bg-ivory p-0.5">
              <button
                type="button"
                onClick={undo}
                disabled={!canUndo}
                title="Hoàn tác (Ctrl+Z)"
                aria-label="Hoàn tác"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full text-ink transition-colors duration-200 hover:bg-blush focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-burgundy disabled:opacity-35 cursor-pointer motion-reduce:transition-none"
              >
                <Undo2 className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={redo}
                disabled={!canRedo}
                title="Làm lại (Ctrl+Shift+Z)"
                aria-label="Làm lại"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full text-ink transition-colors duration-200 hover:bg-blush focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-burgundy disabled:opacity-35 cursor-pointer motion-reduce:transition-none"
              >
                <Redo2 className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            {/* Version History */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setHistoryOpen(true)}
              className="min-h-[40px]"
            >
              <History className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="hidden tabular-nums md:inline">
                Lịch sử (v{version})
              </span>
            </Button>

            {/* Preview Switcher (Desktop) */}
            <div className="hidden items-center rounded-full border border-border bg-ivory p-0.5 lg:flex">
              <button
                type="button"
                onClick={() => setPreviewMode("mobile")}
                aria-pressed={previewMode === "mobile"}
                className={`inline-flex min-h-[40px] h-10 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-burgundy cursor-pointer motion-reduce:transition-none ${
                  previewMode === "mobile"
                    ? "bg-surface text-burgundy shadow-xs"
                    : "text-ink-muted hover:text-ink"
                }`}
              >
                <Smartphone className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="tabular-nums">390px</span>
              </button>
              <button
                type="button"
                onClick={() => setPreviewMode("desktop")}
                aria-pressed={previewMode === "desktop"}
                className={`inline-flex min-h-[40px] h-10 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-burgundy cursor-pointer motion-reduce:transition-none ${
                  previewMode === "desktop"
                    ? "bg-surface text-burgundy shadow-xs"
                    : "text-ink-muted hover:text-ink"
                }`}
              >
                <Monitor className="h-3.5 w-3.5" aria-hidden="true" />
                Desktop
              </button>
            </div>

            {/* Save Status */}
            <span className="hidden text-xs text-ink-muted tabular-nums xl:inline">
              {saving
                ? "Đang lưu..."
                : isDirty
                  ? "Chưa lưu thay đổi"
                  : lastSavedAt
                    ? `Đã lưu ${formatSavedTime(lastSavedAt)}`
                    : "Đã đồng bộ"}
            </span>

            {/* Manual Save */}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={saving}
              onClick={() => void performSave("manual")}
              className="min-h-[40px]"
            >
              <Save className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{saving ? "Đang lưu..." : isDirty ? "Lưu*" : "Lưu"}</span>
            </Button>

            {/* Publish CTA */}
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleOpenPublishModal}
              className="min-h-[40px]"
            >
              <Share2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Xuất bản / Chia sẻ</span>
            </Button>
          </div>
        </div>

        {/* Multi-tab warning / Save feedback */}
        {tabConflictWarning ? (
          <div
            role="status"
            aria-live="polite"
            className="flex items-center justify-between gap-2 border-t border-border bg-amber-surface px-4 py-1.5 text-xs text-amber-text"
          >
            <span className="flex items-center gap-1.5 font-medium">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              Thiệp này đang được mở ở một tab trình duyệt khác. Hãy lưu trên một tab để tránh ghi đè.
            </span>
            <button
              type="button"
              onClick={() => setTabConflict(false)}
              aria-label="Ẩn thông báo"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-border/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-burgundy cursor-pointer"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        ) : saveFeedback ? (
          <div
            role="status"
            aria-live="polite"
            className="flex items-center justify-between gap-2 border-t border-border bg-blush px-4 py-1.5 text-xs font-medium text-ink-secondary"
          >
            <span className="tabular-nums">{saveFeedback}</span>
            <button
              type="button"
              onClick={() => setSaveFeedback(null)}
              aria-label="Đóng thông báo lưu"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-burgundy cursor-pointer"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        ) : null}
      </header>

      {/* Main Hybrid Split Workspace */}
      <main className="flex min-h-0 flex-1 flex-col lg:grid lg:grid-cols-[440px_1fr] lg:overflow-hidden">
        {/* Left Control Panel */}
        <section
          aria-label="Bảng điều khiển thiết kế"
          className={`flex min-h-0 flex-col border-r border-border bg-surface lg:h-full ${
            mobilePane === "edit" ? "flex-1" : "hidden lg:flex"
          }`}
        >
          {/* 4-Step Tabs */}
          <nav
            aria-label="Các bước chỉnh sửa thiệp"
            className="grid grid-cols-4 gap-1 border-b border-border bg-ivory p-1.5"
          >
            {(
              [
                { id: "style", label: "Mẫu & Nhạc", icon: Palette },
                { id: "content", label: "Nội dung", icon: PenLine },
                { id: "media", label: "Ảnh & AI", icon: ImageIcon },
                { id: "overlay", label: "Pro Overlay", icon: Layers },
              ] as const
            ).map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-[44px] flex-col items-center justify-center gap-1 rounded-xl px-1.5 py-2 text-xs font-semibold transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-burgundy cursor-pointer motion-reduce:transition-none ${
                    active
                      ? "bg-burgundy text-ivory"
                      : "text-ink-secondary hover:bg-blush"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="max-w-full truncate">{tab.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Active Tab Scrollable Body */}
          <div className="flex-1 overflow-y-auto p-4 pb-[calc(6rem+env(safe-area-inset-bottom))] lg:pb-8">
            {activeTab === "overlay" ? (
              <OverlayPanel
                invitationId={invitationId}
                doc={doc}
                onUpdateDoc={updateDoc}
              />
            ) : (
              <QuickPanel
                step={
                  activeTab === "style" ? 1 : activeTab === "content" ? 2 : 3
                }
                invitationId={invitationId}
                doc={doc}
                templates={templates}
                profiles={profiles}
                userPlan={userPlan}
                aiCredits={aiCredits}
                onAiCreditsChange={setAiCredits}
                onUpdateDoc={updateDoc}
                onSwitchTemplate={switchTemplate}
                onApplyProfile={applyProfile}
              />
            )}
          </div>
        </section>

        {/* Right Live Preview Canvas */}
        <section
          id="editor-canvas"
          tabIndex={-1}
          aria-label="Xem trước thiệp trực tiếp"
          className={`min-h-0 flex-1 overflow-y-auto bg-blush/50 p-4 pb-[calc(6rem+env(safe-area-inset-bottom))] outline-none sm:p-6 lg:h-full lg:pb-10 ${
            mobilePane === "preview" ? "block" : "hidden lg:block"
          }`}
        >
          <div
            className={`mx-auto min-h-[680px] overflow-hidden bg-surface transition-[max-width] duration-200 motion-reduce:transition-none ${
              previewMode === "mobile"
                ? "max-w-[390px] rounded-[28px] border-8 border-ink shadow-[var(--shadow-elevated)]"
                : "max-w-4xl rounded-2xl border border-border-strong shadow-[var(--shadow-card)]"
            }`}
          >
            <InvitationRenderer
              doc={doc}
              slug={slug || initialInvitation.slug}
              showWatermark={!userPlan.features.removeWatermark}
              interactive={false}
              previewMode={true}
            />
          </div>
        </section>
      </main>

      {/* Mobile Bottom Tab Bar (Chỉnh sửa / Xem trước) */}
      <div className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-2 gap-2 border-t border-border bg-surface/95 p-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] backdrop-blur-md lg:hidden">
        <button
          type="button"
          onClick={() => setMobilePane("edit")}
          aria-pressed={mobilePane === "edit"}
          className={`flex min-h-[44px] items-center justify-center gap-2 rounded-full text-xs font-semibold transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-burgundy cursor-pointer motion-reduce:transition-none ${
            mobilePane === "edit"
              ? "bg-burgundy text-ivory"
              : "text-ink-secondary hover:bg-blush"
          }`}
        >
          <PenLine className="h-4 w-4" aria-hidden="true" />
          Chỉnh sửa
        </button>
        <button
          type="button"
          onClick={() => setMobilePane("preview")}
          aria-pressed={mobilePane === "preview"}
          className={`flex min-h-[44px] items-center justify-center gap-2 rounded-full text-xs font-semibold transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-burgundy cursor-pointer motion-reduce:transition-none ${
            mobilePane === "preview"
              ? "bg-burgundy text-ivory"
              : "text-ink-secondary hover:bg-blush"
          }`}
        >
          <Smartphone className="h-4 w-4" aria-hidden="true" />
          Xem trước
        </button>
      </div>

      {/* Version History Drawer */}
      <VersionHistoryDrawer
        isOpen={historyOpen}
        onClose={() => setHistoryOpen(false)}
        invitationId={invitationId}
        currentVersion={version}
        onRestored={(restored) => {
          applyServerSnapshot({
            version: restored.version,
            doc: restored.docJson,
            updatedAt: restored.updatedAt,
          });
          setSaveFeedback(`Đã khôi phục phiên bản v${restored.version}.`);
        }}
        onRestoreLocalBackup={(backupDoc) => {
          updateDoc((draft) => {
            draft.theme = backupDoc.theme;
            draft.sections = backupDoc.sections;
            draft.freeElements = backupDoc.freeElements;
            draft.seo = backupDoc.seo;
          });
          setSaveFeedback("Đã nạp bản sao lưu tạm từ trình duyệt.");
        }}
      />

      {/* 409 VERSION_CONFLICT Modal */}
      {conflict ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/45 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-label="Xung đột phiên bản thiệp"
        >
          <div
            ref={conflictModalRef}
            tabIndex={-1}
            className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-[var(--shadow-elevated)] outline-none"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-surface text-amber-text">
                <AlertTriangle className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="font-serif text-lg font-bold text-ink">
                  Phát hiện xung đột phiên bản
                </h2>
                <p className="text-xs text-ink-muted tabular-nums">
                  Bản mới trên máy chủ: v{conflict.serverVersion} (bản hiện tại của bạn: v{version})
                </p>
              </div>
            </div>

            <p className="mt-4 text-sm leading-relaxed text-ink-secondary">
              Thiệp này đã được cập nhật từ một tab hoặc thiết bị khác. Bạn muốn tải bản mới nhất từ hệ thống hay giữ bản đang chỉnh sửa trên màn hình này?
            </p>

            <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  applyServerSnapshot({
                    version: conflict.serverVersion,
                    doc: conflict.serverDoc,
                    updatedAt: new Date().toISOString(),
                  });
                  setSaveFeedback(`Đã tải bản mới nhất v${conflict.serverVersion}.`);
                }}
              >
                Tải bản mới nhất
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                disabled={saving}
                onClick={() => void performSave("manual", conflict.serverVersion)}
              >
                Lưu đè phiên bản hiện tại
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Publish & Share Modal */}
      {publishOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/45 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-label="Xuất bản và chia sẻ thiệp cưới"
          onClick={() => setPublishOpen(false)}
        >
          <div
            ref={publishModalRef}
            tabIndex={-1}
            className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-ivory p-6 shadow-[var(--shadow-elevated)] outline-none"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-border pb-4">
              <div>
                <h2 className="font-serif text-xl font-bold text-ink">
                  Xuất bản &amp; Chia sẻ thiệp cưới
                </h2>
                <p className="text-xs text-ink-muted">
                  Tùy chỉnh đường dẫn, trạng thái hiển thị và ảnh chia sẻ Zalo/Facebook.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPublishOpen(false)}
                aria-label="Đóng hộp thoại xuất bản"
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-ink-secondary transition-colors duration-200 hover:bg-blush-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-burgundy cursor-pointer motion-reduce:transition-none"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <form
              onSubmit={(e) => void handlePublishSubmit(e)}
              className="mt-5 space-y-5"
            >
              {/* Status Selector */}
              <fieldset className="space-y-1.5">
                <legend className="block text-xs font-semibold text-ink-secondary">
                  Trạng thái thiệp
                </legend>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { value: "draft", label: "Bản nháp" },
                      { value: "published", label: "Xuất bản" },
                      { value: "paused", label: "Tạm ẩn" },
                    ] as const
                  ).map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      aria-pressed={draftStatus === item.value}
                      onClick={() => setDraftStatus(item.value)}
                      className={`h-10 rounded-full border text-xs font-semibold transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-burgundy cursor-pointer motion-reduce:transition-none ${
                        draftStatus === item.value
                          ? "border-burgundy bg-burgundy text-ivory"
                          : "border-border-strong bg-surface text-ink hover:bg-blush-hover"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </fieldset>

              {/* Custom Slug */}
              <div className="space-y-1.5">
                <label
                  htmlFor="publish-slug-input"
                  className="block text-xs font-semibold text-ink-secondary"
                >
                  Đường dẫn thiệp công khai
                </label>
                <div className="flex items-center overflow-hidden rounded-xl border border-border-strong bg-surface transition-colors duration-200 focus-within:border-burgundy focus-within:ring-2 focus-within:ring-burgundy/40 motion-reduce:transition-none">
                  <span className="border-r border-border bg-blush/60 px-3 py-2.5 text-xs font-medium text-ink-muted">
                    /s/
                  </span>
                  <input
                    id="publish-slug-input"
                    type="text"
                    required
                    minLength={3}
                    maxLength={50}
                    pattern="[a-z0-9-]{3,50}"
                    value={draftSlug}
                    onChange={(e) => setDraftSlug(e.target.value.toLowerCase())}
                    className="h-10 flex-1 bg-transparent px-3 text-sm text-ink outline-none"
                  />
                </div>
                <p className="text-xs text-ink-muted">
                  Chỉ dùng chữ thường không dấu, số và dấu gạch ngang (3–50 ký tự).
                </p>
              </div>

              {/* SEO / OG Metadata */}
              <div className="space-y-3 rounded-2xl border border-border bg-surface p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-ink">
                    Hiển thị khi gửi qua Zalo / Messenger
                  </span>
                  {userPlan.features.dynamicZaloOg ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-surface px-2.5 py-0.5 text-xs font-semibold text-amber-text">
                      <Sparkles className="h-3 w-3" aria-hidden="true" />
                      Dynamic Zalo OG
                    </span>
                  ) : null}
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="seo-title-input"
                    className="block text-xs font-semibold text-ink-secondary"
                  >
                    Tiêu đề chia sẻ (SEO Title)
                  </label>
                  <input
                    id="seo-title-input"
                    type="text"
                    maxLength={120}
                    value={doc.seo?.title ?? ""}
                    onChange={(e) =>
                      updateDoc((draft) => {
                        if (!draft.seo) {
                          draft.seo = { title: "", description: "", coverPhotoUrl: "" };
                        }
                        draft.seo.title = e.target.value;
                      })
                    }
                    placeholder={title}
                    className="h-10 w-full rounded-xl border border-border-strong bg-surface px-3 text-xs text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-burgundy"
                  />
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="seo-description-input"
                    className="block text-xs font-semibold text-ink-secondary"
                  >
                    Mô tả ngắn (SEO Description)
                  </label>
                  <textarea
                    id="seo-description-input"
                    rows={2}
                    maxLength={260}
                    value={doc.seo?.description ?? ""}
                    onChange={(e) =>
                      updateDoc((draft) => {
                        if (!draft.seo) {
                          draft.seo = { title: "", description: "", coverPhotoUrl: "" };
                        }
                        draft.seo.description = e.target.value;
                      })
                    }
                    placeholder="Trân trọng kính mời bạn đến chung vui cùng chúng mình..."
                    className="w-full rounded-xl border border-border-strong bg-surface p-2.5 text-xs text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-burgundy"
                  />
                </div>

                <div className="space-y-1.5">
                  <span className="block text-xs font-semibold text-ink-secondary">
                    Xem trước thẻ ảnh Zalo OG (`/api/og/{slug}`)
                  </span>
                  <div className="overflow-hidden rounded-xl border border-border bg-ivory">
                    <Image
                      unoptimized
                      src={`/api/og/${encodeURIComponent(slug)}?v=${version}`}
                      alt="Xem trước ảnh chia sẻ Zalo"
                      width={1200}
                      height={630}
                      className="aspect-[1200/630] w-full object-cover"
                    />
                  </div>
                </div>
              </div>

              {publishError ? (
                <p
                  role="alert"
                  className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-800"
                >
                  {publishError}
                </p>
              ) : null}

              {/* Copy & Open Actions */}
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-surface px-3.5 py-2.5">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-xs font-medium text-ink-secondary">
                    /s/{slug}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void handleCopyPublicLink()}
                  >
                    {copiedLink ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-700" aria-hidden="true" />
                        Đã sao chép
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                        Sao chép link
                      </>
                    )}
                  </Button>
                  <Link
                    href={`/s/${encodeURIComponent(slug)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border-strong bg-surface px-3.5 text-xs font-medium text-ink transition-colors duration-200 hover:bg-blush-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-burgundy motion-reduce:transition-none"
                  >
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                    Mở thiệp
                  </Link>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setPublishOpen(false)}
                >
                  Đóng
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  disabled={publishing}
                >
                  {publishing ? "Đang cập nhật..." : "Lưu & Áp dụng xuất bản"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
