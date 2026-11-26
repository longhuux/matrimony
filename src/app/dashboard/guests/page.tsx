"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Check,
  CheckCheck,
  Copy,
  Download,
  ExternalLink,
  Eye,
  MessageSquare,
  Plus,
  Search,
  Send,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useDialogFocus } from "@/lib/use-dialog-focus";

interface InvitationSummary {
  id: string;
  title: string;
  slug: string;
}

interface GuestRow {
  id: string;
  invitationId: string;
  inviteCode: string;
  fullName: string;
  salutation: string;
  greeting: string;
  groupName: string;
  guestSide: "groom" | "bride" | "both";
  rsvpStatus: "pending" | "attending" | "declined";
  attendeeCount: number;
  transportation: string;
  note: string;
  isSent: boolean;
  viewedAt: string | null;
}

interface GuestStats {
  total: number;
  attending: number;
  declined: number;
  pending: number;
  sent: number;
  totalAttendees: number;
}

const FOCUS_RING =
  "focus-visible:outline-2 focus-visible:outline-burgundy focus-visible:outline-offset-2";

const GROUP_OPTIONS = [
  { value: "gia-dinh", label: "Gia đình & Họ hàng" },
  { value: "ban-be", label: "Bạn bè" },
  { value: "dong-nghiep", label: "Đồng nghiệp" },
  { value: "khac", label: "Khách khác" },
] as const;

const SIDE_LABELS: Record<string, string> = {
  groom: "Nhà Trai",
  bride: "Nhà Gái",
  both: "Chung 2 nhà",
};

const RSVP_BADGE: Record<string, { label: string; className: string }> = {
  attending: {
    label: "Tham dự",
    className: "border border-emerald-200 bg-emerald-50 text-emerald-800",
  },
  declined: {
    label: "Từ chối",
    className: "border border-red-200 bg-red-50 text-red-700",
  },
  pending: {
    label: "Chờ phản hồi",
    className: "border border-border bg-amber-surface text-amber-text",
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

export default function GuestsPage(): React.ReactElement {
  const [invitations, setInvitations] = React.useState<InvitationSummary[]>([]);
  const [selectedInvId, setSelectedInvId] = React.useState<string>("");
  const [guests, setGuests] = React.useState<GuestRow[]>([]);
  const [stats, setStats] = React.useState<GuestStats>({
    total: 0,
    attending: 0,
    declined: 0,
    pending: 0,
    sent: 0,
    totalAttendees: 0,
  });

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  // Filters
  const [search, setSearch] = React.useState("");
  const [groupFilter, setGroupFilter] = React.useState("all");
  const [sideFilter, setSideFilter] = React.useState("all");
  const [rsvpFilter, setRsvpFilter] = React.useState("all");

  // Selection for batch actions
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());

  // Zalo Message Composer
  const [zaloTemplate, setZaloTemplate] = React.useState(
    "Kính mời [XƯNG HÔ] [TÊN KHÁCH] đến chung vui trong ngày trọng đại của chúng mình. [LỜI MỜI] Xem thiệp mời riêng tại: [LINK THIỆP]",
  );
  const [copiedGuestId, setCopiedGuestId] = React.useState<string | null>(null);
  const composerRef = React.useRef<HTMLTextAreaElement>(null);

  // Modals
  const [addOpen, setAddOpen] = React.useState(false);
  const [bulkOpen, setBulkOpen] = React.useState(false);
  const [ogPreviewGuest, setOgPreviewGuest] = React.useState<GuestRow | null>(null);

  const addPanelRef = React.useRef<HTMLDivElement>(null);
  const bulkPanelRef = React.useRef<HTMLDivElement>(null);
  const ogPanelRef = React.useRef<HTMLDivElement>(null);

  const closeAddModal = React.useCallback(() => setAddOpen(false), []);
  const closeBulkModal = React.useCallback(() => setBulkOpen(false), []);
  const closeOgModal = React.useCallback(() => setOgPreviewGuest(null), []);

  useDialogFocus(addOpen, addPanelRef, { onClose: closeAddModal });
  useDialogFocus(bulkOpen, bulkPanelRef, { onClose: closeBulkModal });
  useDialogFocus(Boolean(ogPreviewGuest), ogPanelRef, { onClose: closeOgModal });

  // Add Guest Form
  const [newFullName, setNewFullName] = React.useState("");
  const [newSalutation, setNewSalutation] = React.useState("Bạn");
  const [newGroupName, setNewGroupName] = React.useState("ban-be");
  const [newSide, setNewSide] = React.useState<"groom" | "bride" | "both">("groom");
  const [newGreeting, setNewGreeting] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  // Bulk CSV Form
  const [csvText, setCsvText] = React.useState("");

  const loadGuests = React.useCallback(async (invitationId: string) => {
    if (!invitationId) {
      setGuests([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/guests?invitationId=${encodeURIComponent(invitationId)}`);
      const data = (await res.json().catch(() => ({}))) as {
        guests?: GuestRow[];
        stats?: GuestStats;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || "Không thể tải danh sách khách mời.");
      }
      setGuests(data.guests ?? []);
      if (data.stats) setStats(data.stats);
      setSelectedIds(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đã có lỗi xảy ra.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    async function init(): Promise<void> {
      setLoading(true);
      try {
        const res = await fetch("/api/invitations");
        const data = (await res.json().catch(() => ({}))) as {
          invitations?: InvitationSummary[];
          error?: string;
        };
        if (!res.ok) throw new Error(data.error || "Không thể tải danh sách thiệp.");
        const list = data.invitations ?? [];
        setInvitations(list);
        if (list.length > 0) {
          setSelectedInvId(list[0].id);
          await loadGuests(list[0].id);
        } else {
          setLoading(false);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Không thể tải dữ liệu.");
        setLoading(false);
      }
    }
    void init();
  }, [loadGuests]);

  const selectedInvitation = React.useMemo(
    () => invitations.find((i) => i.id === selectedInvId) ?? null,
    [invitations, selectedInvId],
  );

  // Accent-insensitive Vietnamese search + filters
  const filteredGuests = React.useMemo(() => {
    const normQ = normalizeVi(search.trim());
    return guests.filter((g) => {
      if (groupFilter !== "all" && g.groupName !== groupFilter) return false;
      if (sideFilter !== "all" && g.guestSide !== sideFilter) return false;
      if (rsvpFilter !== "all" && g.rsvpStatus !== rsvpFilter) return false;
      if (!normQ) return true;
      const hay = normalizeVi(`${g.fullName} ${g.salutation} ${g.inviteCode} ${g.greeting}`);
      return hay.includes(normQ);
    });
  }, [guests, search, groupFilter, sideFilter, rsvpFilter]);

  function composeZaloMessage(guest: GuestRow): string {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const inviteLink = `${origin}/invite/${guest.inviteCode}`;
    return zaloTemplate
      .replaceAll("[TÊN KHÁCH]", guest.fullName)
      .replaceAll("[XƯNG HÔ]", guest.salutation)
      .replaceAll("[LINK THIỆP]", inviteLink)
      .replaceAll("[LỜI MỜI]", guest.greeting || "")
      .replace(/\s{2,}/g, " ")
      .trim();
  }

  function insertToken(token: string): void {
    const el = composerRef.current;
    if (!el) {
      setZaloTemplate((prev) => `${prev} ${token}`);
      return;
    }
    const start = el.selectionStart ?? zaloTemplate.length;
    const end = el.selectionEnd ?? zaloTemplate.length;
    const next = `${zaloTemplate.slice(0, start)}${token}${zaloTemplate.slice(end)}`;
    setZaloTemplate(next);
    window.setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    }, 0);
  }

  async function handleCopyZaloMessage(guest: GuestRow): Promise<void> {
    try {
      await navigator.clipboard.writeText(composeZaloMessage(guest));
      setCopiedGuestId(guest.id);
      window.setTimeout(
        () => setCopiedGuestId((prev) => (prev === guest.id ? null : prev)),
        2000,
      );
    } catch {
      setError("Không thể sao chép lời mời.");
    }
  }

  async function handleAddGuest(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (!selectedInvId) return;
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/guests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invitationId: selectedInvId,
          fullName: newFullName,
          salutation: newSalutation,
          groupName: newGroupName,
          guestSide: newSide,
          greeting: newGreeting,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Không thể thêm khách mời.");
      setAddOpen(false);
      setNewFullName("");
      setNewGreeting("");
      setNotice("Đã thêm khách mời mới và sinh mã Zalo OG riêng.");
      await loadGuests(selectedInvId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Thêm khách mời thất bại.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleBulkImport(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (!selectedInvId || !csvText.trim()) return;
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/guests/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invitationId: selectedInvId,
          csvText: csvText.trim(),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        insertedCount?: number;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || "Không thể nhập danh sách CSV.");
      setBulkOpen(false);
      setCsvText("");
      setNotice(`Đã nhập thành công ${data.insertedCount ?? 0} khách mời từ CSV.`);
      await loadGuests(selectedInvId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nhập CSV thất bại.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCsvFileChange(event: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setCsvText(text);
  }

  async function handleToggleSent(guest: GuestRow): Promise<void> {
    setError(null);
    try {
      const res = await fetch(`/api/guests/${guest.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isSent: !guest.isSent }),
      });
      if (!res.ok) throw new Error("Không thể cập nhật trạng thái gửi.");
      await loadGuests(selectedInvId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cập nhật thất bại.");
    }
  }

  async function handleDeleteSingle(guest: GuestRow): Promise<void> {
    setError(null);
    try {
      const res = await fetch(`/api/guests/${guest.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Không thể xóa khách mời.");
      setNotice(`Đã xóa khách mời "${guest.fullName}".`);
      await loadGuests(selectedInvId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xóa khách mời thất bại.");
    }
  }

  async function handleBatchMarkSent(isSent: boolean): Promise<void> {
    if (selectedIds.size === 0) return;
    setError(null);
    try {
      const res = await fetch("/api/guests/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invitationId: selectedInvId,
          guestIds: Array.from(selectedIds),
          isSent,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { updatedCount?: number; error?: string };
      if (!res.ok) throw new Error(data.error || "Không thể cập nhật hàng loạt.");
      setNotice(`Đã cập nhật trạng thái cho ${data.updatedCount ?? 0} khách mời.`);
      await loadGuests(selectedInvId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cập nhật hàng loạt thất bại.");
    }
  }

  async function handleBatchDelete(): Promise<void> {
    if (selectedIds.size === 0) return;
    setError(null);
    try {
      const res = await fetch("/api/guests/bulk", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invitationId: selectedInvId,
          guestIds: Array.from(selectedIds),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { deletedCount?: number; error?: string };
      if (!res.ok) throw new Error(data.error || "Không thể xóa hàng loạt.");
      setNotice(`Đã xóa ${data.deletedCount ?? 0} khách mời đã chọn.`);
      await loadGuests(selectedInvId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xóa hàng loạt thất bại.");
    }
  }

  const allFilteredSelected =
    filteredGuests.length > 0 && filteredGuests.every((g) => selectedIds.has(g.id));

  function toggleSelectAll(): void {
    if (allFilteredSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredGuests.map((g) => g.id)));
    }
  }

  function toggleOne(id: string): void {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const sampleGuest: GuestRow = filteredGuests[0] ?? {
    id: "sample",
    invitationId: selectedInvId,
    inviteCode: "ABC12345",
    fullName: "Nguyễn Văn An",
    salutation: "Anh",
    greeting: "Rất hân hạnh được đón tiếp anh cùng gia đình!",
    groupName: "ban-be",
    guestSide: "groom",
    rsvpStatus: "pending",
    attendeeCount: 1,
    transportation: "self",
    note: "",
    isSent: false,
    viewedAt: null,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-ink">
            Khách mời &amp; Zalo OG Cá nhân hóa
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            Quản lý danh sách khách mời, nhập/xuất CSV an toàn, soạn lời mời Zalo và xem trước ảnh OG từng khách.
          </p>
        </div>

        {invitations.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setBulkOpen(true)}
              className="min-h-[44px] motion-reduce:transition-none"
            >
              <Upload className="h-3.5 w-3.5" aria-hidden="true" />
              Nhập CSV
            </Button>
            {selectedInvId ? (
              <a
                href={`/api/guests/export?invitationId=${encodeURIComponent(selectedInvId)}`}
                className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-border-strong bg-surface px-4 text-xs font-medium text-ink transition-colors duration-200 hover:bg-blush-hover motion-reduce:transition-none ${FOCUS_RING}`}
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                Xuất CSV an toàn
              </a>
            ) : null}
            <Button
              type="button"
              size="sm"
              onClick={() => setAddOpen(true)}
              className="min-h-[44px] motion-reduce:transition-none"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              Thêm khách mời
            </Button>
          </div>
        ) : null}
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

      {invitations.length === 0 && !loading ? (
        <Card className="p-8 text-center">
          <p className="font-serif text-lg font-bold text-ink">
            Bạn cần tạo ít nhất một thiệp cưới trước khi thêm khách mời
          </p>
          <p className="mt-1 text-sm text-ink-muted">
            Mỗi khách mời sẽ được cấp một đường dẫn /invite/[code] gắn với thiệp cưới của bạn.
          </p>
          <div className="mt-5">
            <Link
              href="/dashboard/invitations?create=1"
              className={`inline-flex min-h-[44px] items-center gap-2 rounded-full bg-burgundy px-5 text-xs font-semibold text-ivory transition-colors duration-200 hover:bg-burgundy-dark motion-reduce:transition-none ${FOCUS_RING}`}
            >
              Tạo thiệp cưới ngay
            </Link>
          </div>
        </Card>
      ) : (
        <>
          {/* Invitation Selector & Stats Bar */}
          <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
            <Card className="p-4">
              <label
                htmlFor="guest-inv-select"
                className="block text-xs font-semibold uppercase tracking-wider text-ink-muted"
              >
                Chọn thiệp cưới
              </label>
              <select
                id="guest-inv-select"
                value={selectedInvId}
                onChange={(e) => {
                  const id = e.target.value;
                  setSelectedInvId(id);
                  void loadGuests(id);
                }}
                className={`mt-2 min-h-[44px] w-full rounded-xl border border-border-strong bg-surface px-3 text-sm font-medium text-ink ${FOCUS_RING}`}
              >
                {invitations.map((inv) => (
                  <option key={inv.id} value={inv.id}>
                    {inv.title}
                  </option>
                ))}
              </select>
            </Card>

            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border shadow-[var(--shadow-card)] sm:grid-cols-4">
              <div className="bg-surface p-4">
                <p className="text-xs text-ink-muted">Tổng khách mời</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-ink">{stats.total}</p>
              </div>
              <div className="bg-surface p-4">
                <p className="text-xs text-ink-muted">Đã gửi thiệp</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-burgundy">{stats.sent}</p>
              </div>
              <div className="bg-surface p-4">
                <p className="text-xs text-ink-muted">Xác nhận tham dự</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-700">
                  {stats.attending}
                </p>
              </div>
              <div className="bg-surface p-4">
                <p className="text-xs text-ink-muted">Chưa phản hồi</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-amber-text">
                  {stats.pending}
                </p>
              </div>
            </div>
          </div>

          {/* Zalo Personalized Message Composer */}
          <Card className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <MessageSquare className="h-5 w-5 text-burgundy" aria-hidden="true" />
                <div>
                  <h2 className="font-serif text-lg font-bold text-ink">
                    Soạn mẫu tin nhắn Zalo cá nhân hóa
                  </h2>
                  <p className="text-xs text-ink-muted">
                    Chạm nút &ldquo;Chép lời mời&rdquo; ở từng khách bên dưới để dán gửi Zalo ngay.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {["[TÊN KHÁCH]", "[XƯNG HÔ]", "[LINK THIỆP]", "[LỜI MỜI]"].map((token) => (
                  <button
                    key={token}
                    type="button"
                    onClick={() => insertToken(token)}
                    className={`min-h-[44px] rounded-full border border-border bg-amber-surface px-3 py-1.5 text-xs font-semibold text-amber-text transition-colors duration-200 hover:bg-blush motion-reduce:transition-none cursor-pointer ${FOCUS_RING}`}
                  >
                    + {token}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 grid gap-4 border-t border-border pt-4 md:grid-cols-2">
              <textarea
                ref={composerRef}
                rows={3}
                value={zaloTemplate}
                onChange={(e) => setZaloTemplate(e.target.value)}
                aria-label="Mẫu tin nhắn Zalo cá nhân hóa"
                className={`w-full rounded-xl border border-border-strong bg-surface p-3 text-xs leading-relaxed text-ink ${FOCUS_RING}`}
              />
              <div className="border-t border-border pt-3 md:border-l md:border-t-0 md:pl-4 md:pt-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                  Xem trước cho: {sampleGuest.salutation} {sampleGuest.fullName}
                </p>
                <p className="mt-1.5 text-xs leading-relaxed text-ink">
                  {composeZaloMessage(sampleGuest)}
                </p>
              </div>
            </div>
          </Card>

          {/* Search, Filters & Batch Bar */}
          <Card className="space-y-3 p-4">
            <div className="grid gap-3 md:grid-cols-[1fr_160px_150px_160px]">
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
                  aria-hidden="true"
                />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Tìm nhanh không dấu (VD: nguyen van an, ma moi)..."
                  aria-label="Tìm khách mời không dấu"
                  className={`min-h-[44px] w-full rounded-xl border border-border-strong bg-surface pl-10 pr-3 text-sm text-ink placeholder:text-ink-muted ${FOCUS_RING}`}
                />
              </div>

              <select
                value={groupFilter}
                onChange={(e) => setGroupFilter(e.target.value)}
                aria-label="Lọc theo nhóm"
                className={`min-h-[44px] rounded-xl border border-border-strong bg-surface px-3 text-xs font-medium text-ink ${FOCUS_RING}`}
              >
                <option value="all">Tất cả nhóm</option>
                {GROUP_OPTIONS.map((g) => (
                  <option key={g.value} value={g.value}>
                    {g.label}
                  </option>
                ))}
              </select>

              <select
                value={sideFilter}
                onChange={(e) => setSideFilter(e.target.value)}
                aria-label="Lọc theo gia đình"
                className={`min-h-[44px] rounded-xl border border-border-strong bg-surface px-3 text-xs font-medium text-ink ${FOCUS_RING}`}
              >
                <option value="all">Cả 2 gia đình</option>
                <option value="groom">Nhà Trai</option>
                <option value="bride">Nhà Gái</option>
                <option value="both">Chung 2 nhà</option>
              </select>

              <select
                value={rsvpFilter}
                onChange={(e) => setRsvpFilter(e.target.value)}
                aria-label="Lọc theo trạng thái RSVP"
                className={`min-h-[44px] rounded-xl border border-border-strong bg-surface px-3 text-xs font-medium text-ink ${FOCUS_RING}`}
              >
                <option value="all">Mọi trạng thái</option>
                <option value="attending">Tham dự</option>
                <option value="pending">Chờ phản hồi</option>
                <option value="declined">Từ chối</option>
              </select>
            </div>

            {selectedIds.size > 0 ? (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
                <span className="text-xs font-semibold tabular-nums text-burgundy">
                  Đã chọn {selectedIds.size} khách mời
                </span>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void handleBatchMarkSent(true)}
                    className="min-h-[44px] motion-reduce:transition-none"
                  >
                    <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />
                    Đánh dấu đã gửi
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void handleBatchMarkSent(false)}
                    className="min-h-[44px] motion-reduce:transition-none"
                  >
                    Đánh dấu chưa gửi
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => void handleBatchDelete()}
                    className="min-h-[44px] bg-red-700 text-ivory hover:bg-red-800 motion-reduce:transition-none"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    Xóa đã chọn
                  </Button>
                </div>
              </div>
            ) : null}
          </Card>

          {/* Guest List (Mobile Card Stack + Desktop Table) */}
          <Card className="overflow-hidden">
            {loading ? (
              <div className="p-6 text-center text-sm text-ink-muted">
                Đang tải danh sách khách mời...
              </div>
            ) : filteredGuests.length === 0 ? (
              <div className="p-10 text-center text-sm text-ink-muted">
                {guests.length === 0
                  ? "Chưa có khách mời nào trong thiệp này. Hãy thêm khách mời hoặc nhập từ file CSV."
                  : "Không tìm thấy khách mời phù hợp với bộ lọc."}
              </div>
            ) : (
              <>
                {/* Mobile Card Stack (390px friendly) */}
                <div className="divide-y divide-border md:hidden">
                  <div className="flex items-center justify-between bg-ivory px-4 py-3">
                    <label className="flex min-h-[44px] items-center gap-2.5 text-xs font-semibold text-ink-secondary cursor-pointer">
                      <input
                        type="checkbox"
                        checked={allFilteredSelected}
                        onChange={toggleSelectAll}
                        aria-label="Chọn tất cả khách mời đang hiển thị"
                        className="h-4 w-4 rounded border-border-strong accent-burgundy"
                      />
                      <span>Chọn tất cả ({filteredGuests.length})</span>
                    </label>
                  </div>
                  {filteredGuests.map((guest) => {
                    const rsvp = RSVP_BADGE[guest.rsvpStatus] ?? RSVP_BADGE.pending;
                    const isChecked = selectedIds.has(guest.id);
                    return (
                      <div key={guest.id} className="space-y-3 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <label className="flex min-w-0 items-start gap-2.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleOne(guest.id)}
                              aria-label={`Chọn ${guest.fullName}`}
                              className="mt-1 h-4 w-4 shrink-0 rounded border-border-strong accent-burgundy"
                            />
                            <div className="min-w-0">
                              <p className="font-semibold text-ink">
                                {guest.salutation} {guest.fullName}
                              </p>
                              <p className="mt-0.5 text-xs text-ink-muted">
                                Mã: <span className="font-mono">{guest.inviteCode}</span>
                                {guest.viewedAt ? ", Đã mở thiệp" : ""}
                              </p>
                              <p className="mt-0.5 text-xs text-ink-secondary">
                                {SIDE_LABELS[guest.guestSide] ?? guest.guestSide}, {guest.groupName}
                              </p>
                            </div>
                          </label>
                          <span
                            className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums ${rsvp.className}`}
                          >
                            {rsvp.label}
                            {guest.rsvpStatus === "attending" ? ` (${guest.attendeeCount})` : ""}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => void handleToggleSent(guest)}
                            className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-colors duration-200 motion-reduce:transition-none cursor-pointer ${FOCUS_RING} ${
                              guest.isSent
                                ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
                                : "border border-border bg-blush text-ink-secondary"
                            }`}
                          >
                            <Send className="h-3.5 w-3.5" aria-hidden="true" />
                            {guest.isSent ? "Đã gửi" : "Chưa gửi"}
                          </button>

                          <button
                            type="button"
                            onClick={() => void handleCopyZaloMessage(guest)}
                            className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-burgundy px-3.5 text-xs font-semibold text-ivory transition-colors duration-200 hover:bg-burgundy-dark motion-reduce:transition-none cursor-pointer ${FOCUS_RING}`}
                          >
                            {copiedGuestId === guest.id ? (
                              <>
                                <Check className="h-3.5 w-3.5" aria-hidden="true" />
                                Đã chép
                              </>
                            ) : (
                              <>
                                <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                                Chép lời mời
                              </>
                            )}
                          </button>

                          {selectedInvitation ? (
                            <button
                              type="button"
                              onClick={() => setOgPreviewGuest(guest)}
                              className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-border-strong bg-surface px-3 text-xs font-medium text-ink transition-colors duration-200 hover:bg-blush-hover motion-reduce:transition-none cursor-pointer ${FOCUS_RING}`}
                            >
                              <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                              OG Zalo
                            </button>
                          ) : null}

                          <Link
                            href={`/invite/${guest.inviteCode}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`Mở thiệp cá nhân của ${guest.fullName}`}
                            className={`inline-flex h-11 w-11 items-center justify-center rounded-full border border-border-strong bg-surface text-ink-secondary transition-colors duration-200 hover:bg-blush-hover motion-reduce:transition-none ${FOCUS_RING}`}
                          >
                            <ExternalLink className="h-4 w-4" aria-hidden="true" />
                          </Link>

                          <button
                            type="button"
                            onClick={() => void handleDeleteSingle(guest)}
                            aria-label={`Xóa ${guest.fullName}`}
                            className={`ml-auto inline-flex h-11 w-11 items-center justify-center rounded-full text-red-700 transition-colors duration-200 hover:bg-red-50 motion-reduce:transition-none cursor-pointer ${FOCUS_RING}`}
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Desktop Table */}
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full min-w-[780px] border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-border bg-ivory text-xs font-semibold uppercase tracking-wider text-ink-muted">
                        <th className="w-10 px-4 py-3">
                          <input
                            type="checkbox"
                            checked={allFilteredSelected}
                            onChange={toggleSelectAll}
                            aria-label="Chọn tất cả khách mời đang hiển thị"
                            className="h-4 w-4 rounded border-border-strong accent-burgundy"
                          />
                        </th>
                        <th className="px-3 py-3">Khách mời</th>
                        <th className="px-3 py-3">Gia đình / Nhóm</th>
                        <th className="px-3 py-3">RSVP</th>
                        <th className="px-3 py-3">Đã gửi</th>
                        <th className="px-4 py-3 text-right">Thao tác Zalo &amp; OG</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredGuests.map((guest) => {
                        const rsvp = RSVP_BADGE[guest.rsvpStatus] ?? RSVP_BADGE.pending;
                        const isChecked = selectedIds.has(guest.id);
                        return (
                          <tr key={guest.id} className="hover:bg-ivory">
                            <td className="px-4 py-3">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleOne(guest.id)}
                                aria-label={`Chọn ${guest.fullName}`}
                                className="h-4 w-4 rounded border-border-strong accent-burgundy"
                              />
                            </td>
                            <td className="px-3 py-3">
                              <p className="font-semibold text-ink">
                                {guest.salutation} {guest.fullName}
                              </p>
                              <p className="mt-0.5 text-xs text-ink-muted">
                                Mã: <span className="font-mono">{guest.inviteCode}</span>
                                {guest.viewedAt ? ", Đã mở thiệp" : ""}
                              </p>
                            </td>
                            <td className="px-3 py-3 text-ink-secondary">
                              <p className="font-medium">
                                {SIDE_LABELS[guest.guestSide] ?? guest.guestSide}
                              </p>
                              <p className="text-xs text-ink-muted">{guest.groupName}</p>
                            </td>
                            <td className="px-3 py-3">
                              <span
                                className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums ${rsvp.className}`}
                              >
                                {rsvp.label}
                                {guest.rsvpStatus === "attending" ? ` (${guest.attendeeCount})` : ""}
                              </span>
                            </td>
                            <td className="px-3 py-3">
                              <button
                                type="button"
                                onClick={() => void handleToggleSent(guest)}
                                className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-colors duration-200 motion-reduce:transition-none cursor-pointer ${FOCUS_RING} ${
                                  guest.isSent
                                    ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
                                    : "border border-border bg-blush text-ink-secondary"
                                }`}
                              >
                                <Send className="h-3 w-3" aria-hidden="true" />
                                {guest.isSent ? "Đã gửi" : "Chưa gửi"}
                              </button>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => void handleCopyZaloMessage(guest)}
                                  className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-burgundy px-3.5 text-xs font-semibold text-ivory transition-colors duration-200 hover:bg-burgundy-dark motion-reduce:transition-none cursor-pointer ${FOCUS_RING}`}
                                >
                                  {copiedGuestId === guest.id ? (
                                    <>
                                      <Check className="h-3.5 w-3.5" aria-hidden="true" />
                                      Đã chép
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                                      Chép lời mời
                                    </>
                                  )}
                                </button>

                                {selectedInvitation ? (
                                  <button
                                    type="button"
                                    onClick={() => setOgPreviewGuest(guest)}
                                    className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-border-strong bg-surface px-3 text-xs font-medium text-ink transition-colors duration-200 hover:bg-blush-hover motion-reduce:transition-none cursor-pointer ${FOCUS_RING}`}
                                  >
                                    <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                                    OG Zalo
                                  </button>
                                ) : null}

                                <Link
                                  href={`/invite/${guest.inviteCode}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  aria-label={`Mở thiệp cá nhân của ${guest.fullName}`}
                                  className={`inline-flex h-11 w-11 items-center justify-center rounded-full border border-border-strong bg-surface text-ink-secondary transition-colors duration-200 hover:bg-blush-hover motion-reduce:transition-none ${FOCUS_RING}`}
                                >
                                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                                </Link>

                                <button
                                  type="button"
                                  onClick={() => void handleDeleteSingle(guest)}
                                  aria-label={`Xóa ${guest.fullName}`}
                                  className={`inline-flex h-11 w-11 items-center justify-center rounded-full text-red-700 transition-colors duration-200 hover:bg-red-50 motion-reduce:transition-none cursor-pointer ${FOCUS_RING}`}
                                >
                                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                                </button>
                              </div>
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
        </>
      )}

      {/* Modal: Add Single Guest */}
      {addOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/45 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-guest-title"
          onClick={closeAddModal}
        >
          <div
            ref={addPanelRef}
            tabIndex={-1}
            className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-2xl border border-border bg-ivory p-6 shadow-[var(--shadow-elevated)] outline-none"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3">
              <h2 id="add-guest-title" className="font-serif text-xl font-bold text-ink">
                Thêm khách mời mới
              </h2>
              <button
                type="button"
                onClick={closeAddModal}
                aria-label="Đóng"
                className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-ink-secondary transition-colors duration-200 hover:bg-blush motion-reduce:transition-none cursor-pointer ${FOCUS_RING}`}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={(e) => void handleAddGuest(e)} className="mt-4 space-y-3.5">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label htmlFor="add-guest-salutation" className="block text-xs font-semibold text-ink">
                    Xưng hô
                  </label>
                  <input
                    id="add-guest-salutation"
                    type="text"
                    maxLength={40}
                    value={newSalutation}
                    onChange={(e) => setNewSalutation(e.target.value)}
                    placeholder="Anh / Chị / Bạn"
                    className={`mt-1 min-h-[44px] w-full rounded-xl border border-border-strong bg-surface px-3 text-sm text-ink ${FOCUS_RING}`}
                  />
                </div>
                <div className="col-span-2">
                  <label htmlFor="add-guest-fullname" className="block text-xs font-semibold text-ink">
                    Họ và tên *
                  </label>
                  <input
                    id="add-guest-fullname"
                    type="text"
                    required
                    maxLength={100}
                    value={newFullName}
                    onChange={(e) => setNewFullName(e.target.value)}
                    placeholder="Nguyễn Văn An"
                    className={`mt-1 min-h-[44px] w-full rounded-xl border border-border-strong bg-surface px-3 text-sm text-ink ${FOCUS_RING}`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="add-guest-side" className="block text-xs font-semibold text-ink">
                    Gia đình
                  </label>
                  <select
                    id="add-guest-side"
                    value={newSide}
                    onChange={(e) => setNewSide(e.target.value as "groom" | "bride" | "both")}
                    className={`mt-1 min-h-[44px] w-full rounded-xl border border-border-strong bg-surface px-3 text-sm text-ink ${FOCUS_RING}`}
                  >
                    <option value="groom">Nhà Trai</option>
                    <option value="bride">Nhà Gái</option>
                    <option value="both">Chung 2 nhà</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="add-guest-group" className="block text-xs font-semibold text-ink">
                    Nhóm khách
                  </label>
                  <select
                    id="add-guest-group"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    className={`mt-1 min-h-[44px] w-full rounded-xl border border-border-strong bg-surface px-3 text-sm text-ink ${FOCUS_RING}`}
                  >
                    {GROUP_OPTIONS.map((g) => (
                      <option key={g.value} value={g.value}>
                        {g.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="add-guest-greeting" className="block text-xs font-semibold text-ink">
                  Lời mời riêng (tùy chọn)
                </label>
                <textarea
                  id="add-guest-greeting"
                  rows={2}
                  maxLength={300}
                  value={newGreeting}
                  onChange={(e) => setNewGreeting(e.target.value)}
                  placeholder="Rất mong được đón tiếp bạn cùng gia đình đến chung vui!"
                  className={`mt-1 w-full rounded-xl border border-border-strong bg-surface p-3 text-sm text-ink ${FOCUS_RING}`}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={closeAddModal}
                  className="min-h-[44px] motion-reduce:transition-none"
                >
                  Hủy
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="min-h-[44px] motion-reduce:transition-none"
                >
                  {submitting ? "Đang lưu..." : "Thêm khách mời"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* Modal: Bulk CSV Import */}
      {bulkOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/45 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="bulk-csv-title"
          onClick={closeBulkModal}
        >
          <div
            ref={bulkPanelRef}
            tabIndex={-1}
            className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-ivory p-6 shadow-[var(--shadow-elevated)] outline-none"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3">
              <h2 id="bulk-csv-title" className="font-serif text-xl font-bold text-ink">
                Nhập hàng loạt từ CSV
              </h2>
              <button
                type="button"
                onClick={closeBulkModal}
                aria-label="Đóng"
                className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-ink-secondary transition-colors duration-200 hover:bg-blush motion-reduce:transition-none cursor-pointer ${FOCUS_RING}`}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={(e) => void handleBulkImport(e)} className="mt-4 space-y-4">
              <div className="rounded-xl border border-border bg-surface p-3 text-xs text-ink-secondary">
                <p className="font-semibold text-ink">Định dạng cột hỗ trợ (tối đa 500 dòng):</p>
                <p className="mt-1 font-mono text-xs text-ink-muted">
                  Họ tên, Xưng hô, Nhóm, Nhà, Lời mời
                </p>
                <p className="mt-1 text-xs text-ink-muted">
                  VD: Nguyễn Văn An, Anh, ban-be, Nhà Trai, Rất mong anh tới dự!
                </p>
              </div>

              <div>
                <label htmlFor="bulk-csv-file" className="block text-xs font-semibold text-ink">
                  Tải tệp .csv từ máy tính (tùy chọn)
                </label>
                <input
                  id="bulk-csv-file"
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e) => void handleCsvFileChange(e)}
                  className={`mt-1.5 block w-full text-xs text-ink-secondary file:mr-3 file:min-h-[44px] file:rounded-full file:border file:border-border-strong file:bg-surface file:px-4 file:py-2 file:text-xs file:font-semibold file:text-ink hover:file:bg-blush-hover ${FOCUS_RING}`}
                />
              </div>

              <div>
                <label htmlFor="bulk-csv-text" className="block text-xs font-semibold text-ink">
                  Hoặc dán trực tiếp nội dung CSV / Excel
                </label>
                <textarea
                  id="bulk-csv-text"
                  rows={6}
                  required
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                  placeholder={`Họ tên, Xưng hô, Nhóm, Nhà, Lời mời\nTrần Thị Bình, Chị, dong-nghiep, Nhà Gái, Hân hạnh đón tiếp chị`}
                  className={`mt-1 w-full rounded-xl border border-border-strong bg-surface p-3 font-mono text-xs text-ink ${FOCUS_RING}`}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={closeBulkModal}
                  className="min-h-[44px] motion-reduce:transition-none"
                >
                  Hủy
                </Button>
                <Button
                  type="submit"
                  disabled={submitting || !csvText.trim()}
                  className="min-h-[44px] motion-reduce:transition-none"
                >
                  {submitting ? "Đang nhập..." : "Nhập danh sách khách"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* Modal: Dynamic Zalo OG Preview */}
      {ogPreviewGuest && selectedInvitation ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="og-preview-title"
          onClick={closeOgModal}
        >
          <div
            ref={ogPanelRef}
            tabIndex={-1}
            className="max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-ivory p-6 shadow-[var(--shadow-elevated)] outline-none"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="og-preview-title" className="font-serif text-xl font-bold text-ink">
                  Preview Dynamic Zalo OG — {ogPreviewGuest.salutation} {ogPreviewGuest.fullName}
                </h2>
                <p className="mt-1 text-xs text-ink-muted">
                  Ảnh này tự động hiển thị khi bạn gửi link{" "}
                  <span className="font-mono">/invite/{ogPreviewGuest.inviteCode}</span> qua Zalo hoặc Facebook.
                </p>
              </div>
              <button
                type="button"
                onClick={closeOgModal}
                aria-label="Đóng"
                className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-ink-secondary transition-colors duration-200 hover:bg-blush motion-reduce:transition-none cursor-pointer ${FOCUS_RING}`}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="mt-4 overflow-hidden rounded-xl border border-border bg-surface">
              <Image
                src={`/api/og/${encodeURIComponent(selectedInvitation.slug)}?guest=${encodeURIComponent(ogPreviewGuest.inviteCode)}`}
                alt={`Preview Zalo OG cho ${ogPreviewGuest.fullName}`}
                width={1200}
                height={630}
                unoptimized
                className="aspect-[1200/630] w-full object-cover"
              />
            </div>

            <div className="mt-4 flex flex-wrap justify-end gap-2.5">
              <a
                href={`/api/og/${encodeURIComponent(selectedInvitation.slug)}?guest=${encodeURIComponent(ogPreviewGuest.inviteCode)}`}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-border-strong bg-surface px-4 text-xs font-semibold text-ink transition-colors duration-200 hover:bg-blush-hover motion-reduce:transition-none ${FOCUS_RING}`}
              >
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                Mở ảnh OG gốc
              </a>
              <Button
                type="button"
                size="sm"
                onClick={closeOgModal}
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
