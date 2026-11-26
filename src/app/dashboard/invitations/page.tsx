"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Check,
  Copy,
  CopyPlus,
  ExternalLink,
  Eye,
  Heart,
  MonitorPlay,
  PauseCircle,
  Pencil,
  PlayCircle,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useDialogFocus } from "@/lib/use-dialog-focus";

interface InvitationListItem {
  id: string;
  title: string;
  slug: string;
  status: "draft" | "published" | "paused";
  version: number;
  viewCount: number;
  updatedAt: string;
  guestCount: number;
  rsvpCount: number;
  wishCount: number;
}

interface TemplateItem {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  tier: "free" | "pro";
  defaultDoc: {
    theme?: {
      palette?: {
        primary?: string;
        secondary?: string;
        accent?: string;
        background?: string;
      };
    };
  };
}

interface WeddingProfileSummary {
  id: string;
  name: string;
  groomInfo: { shortName: string; fullName: string };
  brideInfo: { shortName: string; fullName: string };
}

const FOCUS_RING =
  "focus-visible:outline-2 focus-visible:outline-burgundy focus-visible:outline-offset-2";

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  published: {
    label: "Đang phát hành",
    className: "border border-emerald-200 bg-emerald-50 text-emerald-800",
  },
  draft: {
    label: "Bản nháp",
    className: "border border-border bg-amber-surface text-amber-text",
  },
  paused: {
    label: "Tạm dừng",
    className: "border border-border bg-blush text-ink-secondary",
  },
};

function normalizeVi(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

function InvitationsPageContent(): React.ReactElement {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [invitations, setInvitations] = React.useState<InvitationListItem[]>([]);
  const [templates, setTemplates] = React.useState<TemplateItem[]>([]);
  const [profiles, setProfiles] = React.useState<WeddingProfileSummary[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<"all" | "published" | "draft" | "paused">("all");
  const [copiedId, setCopiedId] = React.useState<string | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  // Create Modal
  const [createOpen, setCreateOpen] = React.useState(false);
  const [selectedTemplateSlug, setSelectedTemplateSlug] = React.useState("");
  const [selectedProfileId, setSelectedProfileId] = React.useState("");
  const [customTitle, setCustomTitle] = React.useState("");
  const [creating, setCreating] = React.useState(false);
  const createPanelRef = React.useRef<HTMLDivElement>(null);

  // Delete Confirm Modal
  const [deleteTarget, setDeleteTarget] = React.useState<InvitationListItem | null>(null);
  const deletePanelRef = React.useRef<HTMLDivElement>(null);

  const closeCreateModal = React.useCallback(() => setCreateOpen(false), []);
  const closeDeleteModal = React.useCallback(() => setDeleteTarget(null), []);

  useDialogFocus(createOpen, createPanelRef, { onClose: closeCreateModal });
  useDialogFocus(Boolean(deleteTarget), deletePanelRef, { onClose: closeDeleteModal });

  const loadData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [invRes, tplRes, profRes] = await Promise.all([
        fetch("/api/invitations"),
        fetch("/api/templates"),
        fetch("/api/wedding-profiles"),
      ]);
      if (!invRes.ok) {
        const d = (await invRes.json().catch(() => ({}))) as { error?: string };
        throw new Error(d.error || "Không thể tải danh sách thiệp cưới.");
      }
      const invJson = (await invRes.json()) as { invitations: InvitationListItem[] };
      const tplJson = tplRes.ok
        ? ((await tplRes.json()) as { templates: TemplateItem[] })
        : { templates: [] };
      const profJson = profRes.ok
        ? ((await profRes.json()) as { profiles: WeddingProfileSummary[] })
        : { profiles: [] };

      setInvitations(invJson.invitations ?? []);
      setTemplates(tplJson.templates ?? []);
      setProfiles(profJson.profiles ?? []);

      if ((tplJson.templates ?? []).length > 0) {
        setSelectedTemplateSlug((prev) => prev || tplJson.templates[0].slug);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đã có lỗi xảy ra khi tải dữ liệu.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadData();
  }, [loadData]);

  React.useEffect(() => {
    const tplParam = searchParams.get("template");
    const createParam = searchParams.get("create");
    if (tplParam || createParam === "1") {
      if (tplParam) setSelectedTemplateSlug(tplParam);
      setCreateOpen(true);
    }
  }, [searchParams]);

  const filteredInvitations = React.useMemo(() => {
    const q = normalizeVi(searchQuery.trim());
    return invitations.filter((inv) => {
      if (statusFilter !== "all" && inv.status !== statusFilter) return false;
      if (!q) return true;
      return normalizeVi(`${inv.title} ${inv.slug}`).includes(q);
    });
  }, [invitations, searchQuery, statusFilter]);

  async function handleCreate(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (!selectedTemplateSlug) {
      setError("Vui lòng chọn một mẫu thiệp.");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateSlug: selectedTemplateSlug,
          ...(selectedProfileId ? { profileId: selectedProfileId } : {}),
          ...(customTitle.trim() ? { title: customTitle.trim() } : {}),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        invitation?: { id: string };
        error?: string;
      };
      if (!res.ok || !data.invitation) {
        throw new Error(data.error || "Không thể tạo thiệp mới.");
      }
      setCreateOpen(false);
      router.push(`/editor/${data.invitation.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tạo thiệp thất bại.");
    } finally {
      setCreating(false);
    }
  }

  async function handleClone(inv: InvitationListItem): Promise<void> {
    setBusyId(inv.id);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/invitations/${inv.id}/clone`, { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as {
        invitation?: InvitationListItem;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || "Không thể nhân bản thiệp.");
      }
      setNotice(`Đã nhân bản "${inv.title}" thành bản nháp mới.`);
      await loadData();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nhân bản thiệp thất bại.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleTogglePublish(inv: InvitationListItem): Promise<void> {
    setBusyId(inv.id);
    setError(null);
    setNotice(null);
    const nextStatus = inv.status === "published" ? "paused" : "published";
    try {
      const res = await fetch(`/api/invitations/${inv.id}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        invitation?: InvitationListItem;
        error?: string;
      };
      if (!res.ok || !data.invitation) {
        throw new Error(data.error || "Không thể cập nhật trạng thái phát hành.");
      }
      setInvitations((prev) =>
        prev.map((item) => (item.id === inv.id ? { ...item, status: data.invitation!.status } : item)),
      );
      setNotice(
        nextStatus === "published"
          ? `Thiệp "${inv.title}" đã được phát hành công khai.`
          : `Đã tạm dừng hiển thị thiệp "${inv.title}".`,
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cập nhật trạng thái thất bại.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleCopyUrl(inv: InvitationListItem): Promise<void> {
    const publicUrl = `${window.location.origin}/s/${inv.slug}`;
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopiedId(inv.id);
      window.setTimeout(() => setCopiedId((prev) => (prev === inv.id ? null : prev)), 2000);
    } catch {
      setError("Không thể sao chép vào khay nhớ tạm.");
    }
  }

  async function handleConfirmDelete(): Promise<void> {
    if (!deleteTarget) return;
    setBusyId(deleteTarget.id);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/invitations/${deleteTarget.id}`, { method: "DELETE" });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error || "Không thể xóa thiệp.");
      }
      setInvitations((prev) => prev.filter((item) => item.id !== deleteTarget.id));
      setNotice(`Đã xóa thiệp "${deleteTarget.title}".`);
      setDeleteTarget(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xóa thiệp thất bại.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-ink">Thiệp cưới của tôi</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Tạo mới từ mẫu chuẩn, nhân bản 1 chạm, bật/tắt phát hành hoặc mở trình chỉnh sửa Studio.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/dashboard/ai-magic"
            className={`inline-flex min-h-[44px] items-center gap-2 rounded-full border border-border-strong bg-surface px-4 text-xs font-semibold text-ink transition-colors duration-200 hover:bg-blush-hover motion-reduce:transition-none ${FOCUS_RING}`}
          >
            <Sparkles className="h-3.5 w-3.5 text-amber-text" aria-hidden="true" />
            AI Magic 30s
          </Link>
          <Button type="button" onClick={() => setCreateOpen(true)} className="min-h-[44px] motion-reduce:transition-none">
            <Plus className="h-4 w-4" aria-hidden="true" />
            Tạo thiệp mới
          </Button>
        </div>
      </div>

      {error ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          <span>{error}</span>
          <Link
            href="/dashboard/billing"
            className={`inline-flex min-h-[44px] items-center text-xs font-semibold underline ${FOCUS_RING}`}
          >
            Xem các gói nâng cấp
          </Link>
        </div>
      ) : null}

      {notice ? (
        <div
          role="status"
          aria-live="polite"
          className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
        >
          {notice}
        </div>
      ) : null}

      {/* Search & Status Filters */}
      <Card className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
              aria-hidden="true"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm theo tên thiệp hoặc đường dẫn slug..."
              aria-label="Tìm thiệp cưới"
              className={`min-h-[44px] w-full rounded-xl border border-border-strong bg-surface pl-10 pr-3 text-sm text-ink placeholder:text-ink-muted ${FOCUS_RING}`}
            />
          </div>

          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Lọc trạng thái thiệp">
            {(
              [
                { key: "all", label: "Tất cả" },
                { key: "published", label: "Đang phát hành" },
                { key: "draft", label: "Bản nháp" },
                { key: "paused", label: "Tạm dừng" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setStatusFilter(tab.key)}
                className={`min-h-[44px] rounded-full px-4 py-2 text-xs font-semibold transition-colors duration-200 motion-reduce:transition-none cursor-pointer ${FOCUS_RING} ${
                  statusFilter === tab.key
                    ? "bg-burgundy text-ivory"
                    : "border border-border bg-surface text-ink-secondary hover:bg-blush-hover"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Invitations List */}
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1].map((idx) => (
            <Card key={idx} className="p-5">
              <div className="h-5 w-48 animate-pulse rounded bg-border motion-reduce:animate-none" />
              <div className="mt-2 h-3.5 w-32 animate-pulse rounded bg-blush motion-reduce:animate-none" />
              <div className="mt-6 h-11 w-full animate-pulse rounded-full bg-blush motion-reduce:animate-none" />
            </Card>
          ))}
        </div>
      ) : filteredInvitations.length === 0 ? (
        <Card className="p-10 text-center">
          <p className="font-serif text-lg font-bold text-ink">
            {invitations.length === 0
              ? "Chưa có thiệp cưới nào được tạo"
              : "Không có thiệp nào khớp với bộ lọc hiện tại"}
          </p>
          <p className="mt-1 text-sm text-ink-muted">
            {invitations.length === 0
              ? "Nhấn \"Tạo thiệp mới\" để chọn từ bộ sưu tập mẫu thiết kế sẵn."
              : "Thử xóa từ khóa tìm kiếm hoặc chọn trạng thái Tất cả."}
          </p>
        </Card>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {filteredInvitations.map((inv) => {
            const badge = STATUS_BADGES[inv.status] ?? STATUS_BADGES.draft;
            const isBusy = busyId === inv.id;
            return (
              <Card key={inv.id} className="flex flex-col justify-between p-5">
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate font-serif text-xl font-bold text-ink">
                        {inv.title}
                      </h2>
                      <p className="mt-0.5 truncate text-xs tabular-nums text-ink-muted">
                        /s/{inv.slug}, Phiên bản v{inv.version}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${badge.className}`}
                    >
                      {badge.label}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-3 divide-x divide-border border-t border-border pt-3.5 text-center">
                    <div className="px-2">
                      <p className="text-xs text-ink-muted">Lượt xem</p>
                      <p className="mt-1 flex items-center justify-center gap-1 text-sm font-bold tabular-nums text-ink">
                        <Eye className="h-3.5 w-3.5 text-burgundy" aria-hidden="true" />
                        {new Intl.NumberFormat("vi-VN").format(inv.viewCount)}
                      </p>
                    </div>
                    <div className="px-2">
                      <p className="text-xs text-ink-muted">RSVP / Khách</p>
                      <p className="mt-1 flex items-center justify-center gap-1 text-sm font-bold tabular-nums text-ink">
                        <Users className="h-3.5 w-3.5 text-burgundy" aria-hidden="true" />
                        {inv.rsvpCount}/{inv.guestCount}
                      </p>
                    </div>
                    <div className="px-2">
                      <p className="text-xs text-ink-muted">Lời chúc</p>
                      <p className="mt-1 flex items-center justify-center gap-1 text-sm font-bold tabular-nums text-ink">
                        <Heart className="h-3.5 w-3.5 text-burgundy" aria-hidden="true" />
                        {inv.wishCount}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-border pt-4">
                  <Link
                    href={`/editor/${inv.id}`}
                    className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-burgundy px-4 text-xs font-semibold text-ivory transition-colors duration-200 hover:bg-burgundy-dark motion-reduce:transition-none ${FOCUS_RING}`}
                  >
                    <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                    Chỉnh sửa
                  </Link>

                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={isBusy}
                    onClick={() => void handleTogglePublish(inv)}
                    className="min-h-[44px] motion-reduce:transition-none"
                  >
                    {inv.status === "published" ? (
                      <>
                        <PauseCircle className="h-3.5 w-3.5" aria-hidden="true" />
                        Tạm dừng
                      </>
                    ) : (
                      <>
                        <PlayCircle className="h-3.5 w-3.5" aria-hidden="true" />
                        Phát hành
                      </>
                    )}
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void handleCopyUrl(inv)}
                    className="min-h-[44px] motion-reduce:transition-none"
                  >
                    {copiedId === inv.id ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-700" aria-hidden="true" />
                        Đã chép link
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                        Chép link
                      </>
                    )}
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isBusy}
                    onClick={() => void handleClone(inv)}
                    className="min-h-[44px] motion-reduce:transition-none"
                  >
                    <CopyPlus className="h-3.5 w-3.5" aria-hidden="true" />
                    Nhân bản
                  </Button>

                  <Link
                    href={`/s/${inv.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`inline-flex min-h-[44px] items-center gap-1 rounded-full border border-border-strong bg-surface px-3.5 text-xs font-medium text-ink transition-colors duration-200 hover:bg-blush-hover motion-reduce:transition-none ${FOCUS_RING}`}
                  >
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                    Xem
                  </Link>

                  <Link
                    href={`/stage/${inv.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`inline-flex min-h-[44px] items-center gap-1 rounded-full bg-amber-surface px-3.5 text-xs font-semibold text-amber-text transition-colors duration-200 hover:bg-blush motion-reduce:transition-none ${FOCUS_RING}`}
                  >
                    <MonitorPlay className="h-3.5 w-3.5" aria-hidden="true" />
                    LED
                  </Link>

                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => setDeleteTarget(inv)}
                    aria-label={`Xóa thiệp ${inv.title}`}
                    className={`ml-auto inline-flex h-11 w-11 items-center justify-center rounded-full text-red-700 transition-colors duration-200 hover:bg-red-50 disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none cursor-pointer ${FOCUS_RING}`}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal: Tạo thiệp mới */}
      {createOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/45 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-invitation-title"
          onClick={closeCreateModal}
        >
          <div
            ref={createPanelRef}
            tabIndex={-1}
            className="max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-ivory p-6 shadow-[var(--shadow-elevated)] outline-none"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="create-invitation-title" className="font-serif text-2xl font-bold text-ink">
                  Tạo thiệp mới
                </h2>
                <p className="mt-1 text-xs text-ink-muted">
                  Chọn mẫu thiết kế yêu thích và ghép nhanh thông tin từ Hồ sơ cưới (tùy chọn).
                </p>
              </div>
              <button
                type="button"
                onClick={closeCreateModal}
                aria-label="Đóng hộp thoại tạo thiệp"
                className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-ink-secondary transition-colors duration-200 hover:bg-blush motion-reduce:transition-none cursor-pointer ${FOCUS_RING}`}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={(e) => void handleCreate(e)} className="mt-5 space-y-5">
              <div>
                <p
                  id="create-inv-template-label"
                  className="block text-xs font-semibold uppercase tracking-wider text-ink-muted"
                >
                  1. Chọn mẫu thiệp ({templates.length} mẫu)
                </p>
                <div
                  role="group"
                  aria-labelledby="create-inv-template-label"
                  className="mt-2 grid gap-3 sm:grid-cols-2"
                >
                  {templates.map((tpl) => {
                    const active = selectedTemplateSlug === tpl.slug;
                    const palette = tpl.defaultDoc?.theme?.palette;
                    return (
                      <button
                        key={tpl.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setSelectedTemplateSlug(tpl.slug)}
                        className={`flex min-h-[44px] flex-col justify-between rounded-xl border p-3.5 text-left transition-colors duration-200 motion-reduce:transition-none cursor-pointer ${FOCUS_RING} ${
                          active
                            ? "border-2 border-burgundy bg-surface ring-4 ring-burgundy/10"
                            : "border-border bg-surface hover:bg-blush-hover"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-serif text-base font-bold text-ink">
                              {tpl.name}
                            </p>
                            <p className="mt-0.5 line-clamp-2 text-xs text-ink-muted">
                              {tpl.description}
                            </p>
                          </div>
                          <span
                            className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                              tpl.tier === "pro"
                                ? "bg-burgundy text-ivory"
                                : "bg-amber-surface text-amber-text"
                            }`}
                          >
                            {tpl.tier === "pro" ? "Pro" : "Miễn phí"}
                          </span>
                        </div>

                        <div className="mt-3 flex items-center gap-1.5">
                          {[palette?.background, palette?.secondary, palette?.primary, palette?.accent]
                            .filter(Boolean)
                            .map((color, idx) => (
                              <span
                                key={`${tpl.slug}-c-${idx}`}
                                className="h-4 w-4 rounded-full border border-border"
                                style={{ backgroundColor: color }}
                              />
                            ))}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="create-inv-title"
                    className="block text-xs font-semibold text-ink"
                  >
                    2. Tên thiệp cưới (tùy chọn)
                  </label>
                  <input
                    id="create-inv-title"
                    type="text"
                    maxLength={120}
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    placeholder="VD: Thiệp cưới Minh Anh & Gia Huy"
                    className={`mt-1.5 min-h-[44px] w-full rounded-xl border border-border-strong bg-surface px-3 text-sm text-ink placeholder:text-ink-muted ${FOCUS_RING}`}
                  />
                </div>

                <div>
                  <label
                    htmlFor="create-inv-profile"
                    className="block text-xs font-semibold text-ink"
                  >
                    3. Điền tự động từ Hồ sơ cưới
                  </label>
                  <select
                    id="create-inv-profile"
                    value={selectedProfileId}
                    onChange={(e) => setSelectedProfileId(e.target.value)}
                    className={`mt-1.5 min-h-[44px] w-full rounded-xl border border-border-strong bg-surface px-3 text-sm text-ink ${FOCUS_RING}`}
                  >
                    <option value="">-- Không dùng hồ sơ sẵn --</option>
                    {profiles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.groomInfo.shortName} &amp; {p.brideInfo.shortName})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={closeCreateModal}
                  className="min-h-[44px] motion-reduce:transition-none"
                >
                  Hủy
                </Button>
                <Button
                  type="submit"
                  disabled={creating || !selectedTemplateSlug}
                  className="min-h-[44px] motion-reduce:transition-none"
                >
                  {creating ? "Đang khởi tạo..." : "Tạo & Mở trình chỉnh sửa"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* Modal: Xác nhận xóa thiệp */}
      {deleteTarget ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/45 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-invitation-title"
          onClick={closeDeleteModal}
        >
          <div
            ref={deletePanelRef}
            tabIndex={-1}
            className="w-full max-w-md rounded-2xl border border-border bg-ivory p-6 shadow-[var(--shadow-elevated)] outline-none"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="delete-invitation-title" className="font-serif text-xl font-bold text-ink">
              Xóa thiệp cưới?
            </h2>
            <p className="mt-2 text-sm text-ink-secondary">
              Bạn chắc chắn muốn xóa vĩnh viễn thiệp{" "}
              <strong className="text-ink">{deleteTarget.title}</strong>? Toàn bộ khách mời,
              RSVP và lời chúc gắn với thiệp này sẽ bị xóa theo.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={closeDeleteModal}
                className="min-h-[44px] motion-reduce:transition-none"
              >
                Giữ lại
              </Button>
              <Button
                type="button"
                disabled={busyId === deleteTarget.id}
                onClick={() => void handleConfirmDelete()}
                className="min-h-[44px] bg-red-700 text-ivory hover:bg-red-800 motion-reduce:transition-none"
              >
                {busyId === deleteTarget.id ? "Đang xóa..." : "Xác nhận xóa"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function InvitationsPage(): React.ReactElement {
  return (
    <React.Suspense
      fallback={
        <div className="space-y-4">
          <div className="h-8 w-56 animate-pulse rounded bg-border motion-reduce:animate-none" />
          <div className="h-40 w-full animate-pulse rounded-2xl border border-border bg-surface motion-reduce:animate-none" />
        </div>
      }
    >
      <InvitationsPageContent />
    </React.Suspense>
  );
}
