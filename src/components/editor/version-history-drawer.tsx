"use client";

import * as React from "react";
import { Clock, HardDriveDownload, History, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDialogFocus } from "@/lib/use-dialog-focus";
import type { InvitationDocumentV2 } from "@/modules/invitation-engine/schema";
import { loadLocalBackups, type LocalBackupEntry } from "@/stores/editor-store";

export interface VersionSnapshotItem {
  id: string;
  invitationId: string;
  version: number;
  source: string;
  docJson: InvitationDocumentV2;
  createdAt: string;
}

export interface VersionHistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  invitationId: string;
  currentVersion: number;
  onRestored: (payload: {
    version: number;
    docJson: InvitationDocumentV2;
    updatedAt: string;
  }) => void;
  onRestoreLocalBackup: (doc: InvitationDocumentV2) => void;
}

const SOURCE_LABELS: Record<string, string> = {
  manual: "Lưu thủ công",
  auto: "Tự động lưu",
  restore: "Đã khôi phục",
  before_restore: "Sao lưu trước khôi phục",
  ai_magic_setup: "AI Magic Setup",
  create: "Khởi tạo thiệp",
};

function formatTimestamp(iso: string): string {
  try {
    return new Intl.DateTimeFormat("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function VersionHistoryDrawer({
  isOpen,
  onClose,
  invitationId,
  currentVersion,
  onRestored,
  onRestoreLocalBackup,
}: VersionHistoryDrawerProps): React.ReactElement | null {
  const [versions, setVersions] = React.useState<VersionSnapshotItem[]>([]);
  const [localBackups, setLocalBackups] = React.useState<LocalBackupEntry[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [restoringId, setRestoringId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const drawerRef = React.useRef<HTMLElement | null>(null);
  useDialogFocus(isOpen, drawerRef, { onClose });

  const fetchVersions = React.useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/invitations/${encodeURIComponent(invitationId)}/versions`);
      const data = (await res.json().catch(() => ({}))) as {
        versions?: VersionSnapshotItem[];
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || "Không thể tải lịch sử phiên bản.");
      }
      setVersions(Array.isArray(data.versions) ? data.versions : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể tải lịch sử phiên bản.");
    } finally {
      setLoading(false);
    }
  }, [invitationId]);

  React.useEffect(() => {
    if (!isOpen) return;
    setLocalBackups(loadLocalBackups(invitationId).slice().reverse());
    void fetchVersions();
  }, [isOpen, invitationId, fetchVersions]);

  if (!isOpen) return null;

  const handleRestoreServerVersion = async (versionId: string): Promise<void> => {
    setRestoringId(versionId);
    setError(null);
    try {
      const res = await fetch(`/api/invitations/${encodeURIComponent(invitationId)}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ versionId }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        invitation?: {
          version: number;
          docJson: InvitationDocumentV2;
          updatedAt: string;
        };
        error?: string;
      };
      if (!res.ok || !data.invitation) {
        throw new Error(data.error || "Không thể khôi phục phiên bản.");
      }
      onRestored(data.invitation);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể khôi phục phiên bản.");
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-ink/40 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-label="Lịch sử phiên bản thiệp"
      onClick={onClose}
    >
      <aside
        ref={drawerRef}
        tabIndex={-1}
        className="flex h-full w-full max-w-md flex-col border-l border-border bg-ivory shadow-[var(--shadow-elevated)] outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border bg-surface px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blush text-burgundy">
              <History className="h-4 w-4" aria-hidden="true" />
            </span>
            <div>
              <h2 className="font-serif text-lg font-bold text-ink">
                Lịch sử phiên bản
              </h2>
              <p className="text-xs text-ink-muted tabular-nums">
                Phiên bản hiện tại: v{currentVersion}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng lịch sử phiên bản"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border bg-surface text-ink-secondary transition-colors duration-200 hover:bg-blush-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-burgundy cursor-pointer motion-reduce:transition-none"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
          {error ? (
            <p
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-800"
            >
              {error}
            </p>
          ) : null}

          <section aria-label="Bản lưu trên máy chủ">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                10 bản lưu gần nhất trên hệ thống
              </h3>
              <button
                type="button"
                onClick={() => void fetchVersions()}
                disabled={loading}
                className="min-h-[36px] rounded-lg px-2 text-xs font-semibold text-burgundy hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-burgundy cursor-pointer"
              >
                Làm mới
              </button>
            </div>

            {loading ? (
              <div className="space-y-2.5">
                {[1, 2, 3].map((item) => (
                  <div
                    key={item}
                    className="h-20 animate-pulse rounded-2xl border border-border bg-surface motion-reduce:animate-none"
                  />
                ))}
              </div>
            ) : versions.length === 0 ? (
              <div className="rounded-2xl border border-border bg-surface p-4 text-center text-xs text-ink-muted">
                Chưa có bản lưu lịch sử nào được ghi nhận.
              </div>
            ) : (
              <div className="space-y-2.5">
                {versions.map((ver) => {
                  const isCurrent = ver.version === currentVersion;
                  const sourceLabel = SOURCE_LABELS[ver.source] ?? ver.source;
                  return (
                    <div
                      key={ver.id}
                      className="rounded-2xl border border-border bg-surface p-4 shadow-[var(--shadow-card)]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-serif text-base font-bold text-ink tabular-nums">
                              Phiên bản v{ver.version}
                            </span>
                            <span className="rounded-full bg-amber-surface px-2.5 py-0.5 text-xs font-semibold text-amber-text">
                              {sourceLabel}
                            </span>
                            {isCurrent ? (
                              <span className="rounded-full bg-blush px-2.5 py-0.5 text-xs font-semibold text-burgundy">
                                Hiện tại
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-muted tabular-nums">
                            <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            {formatTimestamp(ver.createdAt)}
                          </p>
                        </div>

                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={restoringId !== null}
                          onClick={() => void handleRestoreServerVersion(ver.id)}
                        >
                          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                          {restoringId === ver.id ? "Đang khôi phục..." : "Khôi phục"}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {localBackups.length > 0 ? (
            <section aria-label="Bản sao lưu cục bộ trên trình duyệt">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-muted">
                Sao lưu tạm trên trình duyệt (3 bản gần nhất)
              </h3>
              <div className="space-y-2">
                {localBackups.map((backup, idx) => (
                  <div
                    key={`${backup.savedAt}-${idx}`}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface p-3.5"
                  >
                    <div>
                      <p className="text-xs font-semibold text-ink tabular-nums">
                        Bản lưu tạm #{localBackups.length - idx}
                      </p>
                      <p className="text-xs text-ink-muted tabular-nums">
                        {formatTimestamp(backup.savedAt)}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        onRestoreLocalBackup(backup.doc);
                        onClose();
                      }}
                    >
                      <HardDriveDownload className="h-3.5 w-3.5" aria-hidden="true" />
                      Nạp lại
                    </Button>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
