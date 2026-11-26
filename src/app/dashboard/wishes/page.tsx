"use client";

import * as React from "react";
import {
  CheckCircle2,
  Download,
  EyeOff,
  MessageSquareHeart,
  Search,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface InvitationSummary {
  id: string;
  title: string;
}

interface WishItem {
  id: string;
  invitationId: string;
  invitationTitle: string;
  guestId: string | null;
  senderName: string;
  content: string;
  isApproved: boolean;
  createdAt: string;
}

const FOCUS_RING =
  "focus-visible:outline-2 focus-visible:outline-burgundy focus-visible:outline-offset-2";

function normalizeVi(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

export default function WishesPage(): React.ReactElement {
  const [invitations, setInvitations] = React.useState<InvitationSummary[]>([]);
  const [selectedInvId, setSelectedInvId] = React.useState<string>("");
  const [wishes, setWishes] = React.useState<WishItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const [approvalFilter, setApprovalFilter] = React.useState<"all" | "approved" | "hidden">("all");
  const [search, setSearch] = React.useState("");

  const loadWishes = React.useCallback(async (invId: string) => {
    setLoading(true);
    setError(null);
    try {
      const url = invId
        ? `/api/wishes?invitationId=${encodeURIComponent(invId)}`
        : "/api/wishes";
      const res = await fetch(url);
      const data = (await res.json().catch(() => ({}))) as {
        wishes?: WishItem[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || "Không thể tải danh sách lời chúc.");
      setWishes(data.wishes ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đã có lỗi xảy ra.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    async function init(): Promise<void> {
      try {
        const res = await fetch("/api/invitations");
        if (res.ok) {
          const json = (await res.json()) as { invitations?: InvitationSummary[] };
          setInvitations(json.invitations ?? []);
        }
      } catch {
        // Ignore invitation list error; /api/wishes still loads all owned wishes.
      }
      await loadWishes("");
    }
    void init();
  }, [loadWishes]);

  const counts = React.useMemo(() => {
    let approved = 0;
    let hidden = 0;
    for (const w of wishes) {
      if (w.isApproved) approved += 1;
      else hidden += 1;
    }
    return { total: wishes.length, approved, hidden };
  }, [wishes]);

  const filteredWishes = React.useMemo(() => {
    const q = normalizeVi(search.trim());
    return wishes.filter((w) => {
      if (approvalFilter === "approved" && !w.isApproved) return false;
      if (approvalFilter === "hidden" && w.isApproved) return false;
      if (!q) return true;
      return normalizeVi(`${w.senderName} ${w.content} ${w.invitationTitle}`).includes(q);
    });
  }, [wishes, approvalFilter, search]);

  async function handleToggleApprove(wish: WishItem): Promise<void> {
    setBusyId(wish.id);
    setError(null);
    setNotice(null);
    const nextApproved = !wish.isApproved;
    try {
      const res = await fetch(`/api/wishes/${wish.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isApproved: nextApproved }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Không thể cập nhật trạng thái lời chúc.");
      setWishes((prev) =>
        prev.map((item) => (item.id === wish.id ? { ...item, isApproved: nextApproved } : item)),
      );
      setNotice(
        nextApproved
          ? `Đã duyệt hiển thị lời chúc của ${wish.senderName}.`
          : `Đã ẩn lời chúc của ${wish.senderName} khỏi thiệp công khai.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cập nhật thất bại.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDeleteWish(wish: WishItem): Promise<void> {
    setBusyId(wish.id);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/wishes/${wish.id}`, { method: "DELETE" });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Không thể xóa lời chúc.");
      setWishes((prev) => prev.filter((item) => item.id !== wish.id));
      setNotice(`Đã xóa lời chúc của ${wish.senderName}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xóa lời chúc thất bại.");
    } finally {
      setBusyId(null);
    }
  }

  const exportUrl = selectedInvId
    ? `/api/wishes?invitationId=${encodeURIComponent(selectedInvId)}&format=csv`
    : "/api/wishes?format=csv";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-ink">Hộp lời chúc</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Kiểm duyệt lời chúc mừng cưới từ khách mời và xuất lưu kỷ niệm dưới dạng CSV.
          </p>
        </div>

        <a
          href={exportUrl}
          className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-border-strong bg-surface px-4 text-xs font-semibold text-ink transition-colors duration-200 hover:bg-blush-hover motion-reduce:transition-none ${FOCUS_RING}`}
        >
          <Download className="h-3.5 w-3.5" aria-hidden="true" />
          Xuất CSV lời chúc
        </a>
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
          className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
        >
          {notice}
        </div>
      ) : null}

      {/* Summary Ledger */}
      <div className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border shadow-[var(--shadow-card)] sm:grid-cols-3">
        <div className="bg-surface p-4">
          <p className="text-xs text-ink-muted">Tổng lời chúc</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-ink">{counts.total}</p>
        </div>
        <div className="bg-surface p-4">
          <p className="text-xs text-ink-muted">Đang hiển thị</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-700">{counts.approved}</p>
        </div>
        <div className="bg-surface p-4">
          <p className="text-xs text-ink-muted">Đang ẩn</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-amber-text">{counts.hidden}</p>
        </div>
      </div>

      <Card className="p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-1 flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
                aria-hidden="true"
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm theo tên người gửi hoặc nội dung lời chúc..."
                aria-label="Tìm lời chúc"
                className={`min-h-[44px] w-full rounded-xl border border-border-strong bg-surface pl-10 pr-3 text-sm text-ink placeholder:text-ink-muted ${FOCUS_RING}`}
              />
            </div>

            {invitations.length > 0 ? (
              <select
                value={selectedInvId}
                aria-label="Lọc theo thiệp cưới"
                onChange={(e) => {
                  const id = e.target.value;
                  setSelectedInvId(id);
                  void loadWishes(id);
                }}
                className={`min-h-[44px] rounded-xl border border-border-strong bg-surface px-3 text-xs font-medium text-ink ${FOCUS_RING}`}
              >
                <option value="">Tất cả thiệp cưới</option>
                {invitations.map((inv) => (
                  <option key={inv.id} value={inv.id}>
                    {inv.title}
                  </option>
                ))}
              </select>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Lọc trạng thái duyệt">
            {(
              [
                { key: "all", label: "Tất cả" },
                { key: "approved", label: "Đã duyệt" },
                { key: "hidden", label: "Đang ẩn" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                type="button"
                aria-pressed={approvalFilter === tab.key}
                onClick={() => setApprovalFilter(tab.key)}
                className={`min-h-[44px] rounded-full px-4 py-2 text-xs font-semibold transition-colors duration-200 motion-reduce:transition-none cursor-pointer ${FOCUS_RING} ${
                  approvalFilter === tab.key
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

      {/* Wishes List */}
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1].map((idx) => (
            <Card key={idx} className="p-5">
              <div className="h-5 w-40 animate-pulse rounded bg-border motion-reduce:animate-none" />
              <div className="mt-3 h-14 w-full animate-pulse rounded bg-blush motion-reduce:animate-none" />
            </Card>
          ))}
        </div>
      ) : filteredWishes.length === 0 ? (
        <Card className="p-10 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blush text-burgundy">
            <MessageSquareHeart className="h-6 w-6" aria-hidden="true" />
          </div>
          <p className="mt-4 font-serif text-lg font-bold text-ink">
            {wishes.length === 0
              ? "Chưa có lời chúc nào được gửi"
              : "Không có lời chúc phù hợp với bộ lọc"}
          </p>
          <p className="mt-1 text-sm text-ink-muted">
            Khi khách mời gửi lời chúc trên thiệp công khai, lời chúc sẽ hiển thị tại đây để bạn kiểm duyệt.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredWishes.map((wish) => {
            const isBusy = busyId === wish.id;
            return (
              <Card key={wish.id} className="flex flex-col justify-between p-5">
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="font-serif text-lg font-bold text-ink">
                        {wish.senderName}
                      </h2>
                      <p className="mt-0.5 text-xs tabular-nums text-ink-muted">
                        {wish.invitationTitle}, {new Date(wish.createdAt).toLocaleString("vi-VN")}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        wish.isApproved
                          ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
                          : "border border-border bg-amber-surface text-amber-text"
                      }`}
                    >
                      {wish.isApproved ? "Đang hiển thị" : "Đang ẩn"}
                    </span>
                  </div>

                  <p className="mt-3 border-t border-border pt-3 text-sm leading-relaxed text-ink">
                    &ldquo;{wish.content}&rdquo;
                  </p>
                </div>

                <div className="mt-4 flex items-center justify-between gap-2 border-t border-border pt-3">
                  <Button
                    type="button"
                    size="sm"
                    variant={wish.isApproved ? "outline" : "secondary"}
                    disabled={isBusy}
                    onClick={() => void handleToggleApprove(wish)}
                    className="min-h-[44px] motion-reduce:transition-none"
                  >
                    {wish.isApproved ? (
                      <>
                        <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
                        Ẩn lời chúc
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700" aria-hidden="true" />
                        Duyệt hiển thị
                      </>
                    )}
                  </Button>

                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={isBusy}
                    onClick={() => void handleDeleteWish(wish)}
                    aria-label={`Xóa lời chúc của ${wish.senderName}`}
                    className="min-h-[44px] text-red-700 hover:bg-red-50 motion-reduce:transition-none"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    Xóa
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
