"use client";

import * as React from "react";
import Link from "next/link";
import { Bus, CheckCircle2, Clock, Download, Search, Users, XCircle } from "lucide-react";
import { Card } from "@/components/ui/card";

interface InvitationSummary {
  id: string;
  title: string;
  slug: string;
}

interface GuestRsvpRow {
  id: string;
  invitationId: string;
  invitationTitle?: string;
  inviteCode: string;
  fullName: string;
  salutation: string;
  guestSide: "groom" | "bride" | "both";
  rsvpStatus: "pending" | "attending" | "declined";
  attendeeCount: number;
  transportation: string;
  note: string;
  rsvpUpdatedAt: string | null;
}

const FOCUS_RING =
  "focus-visible:outline-2 focus-visible:outline-burgundy focus-visible:outline-offset-2";

const SIDE_LABELS: Record<string, string> = {
  groom: "Nhà Trai",
  bride: "Nhà Gái",
  both: "Chung 2 nhà",
};

const TRANSPORT_LABELS: Record<string, string> = {
  self: "Tự túc di chuyển",
  shuttle: "Đi xe đưa đón",
  car: "Ô tô riêng",
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

export default function RsvpPage(): React.ReactElement {
  const [invitations, setInvitations] = React.useState<InvitationSummary[]>([]);
  const [selectedInvId, setSelectedInvId] = React.useState<string>("");
  const [rows, setRows] = React.useState<GuestRsvpRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [sideFilter, setSideFilter] = React.useState("all");
  const [transportFilter, setTransportFilter] = React.useState("all");

  const loadGuestsForSelection = React.useCallback(
    async (invId: string, invList: InvitationSummary[]) => {
      if (invList.length === 0) {
        setRows([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const targetIds = invId === "all" ? invList.map((i) => i.id) : [invId];
        const titleMap = new Map(invList.map((i) => [i.id, i.title]));
        const responses = await Promise.all(
          targetIds.map((id) => fetch(`/api/guests?invitationId=${encodeURIComponent(id)}`)),
        );
        const combined: GuestRsvpRow[] = [];
        for (const res of responses) {
          if (!res.ok) continue;
          const json = (await res.json()) as { guests?: GuestRsvpRow[] };
          for (const g of json.guests ?? []) {
            combined.push({
              ...g,
              invitationTitle: titleMap.get(g.invitationId) ?? "",
            });
          }
        }
        setRows(combined);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Không thể tải phản hồi RSVP.");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

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
          await loadGuestsForSelection(list[0].id, list);
        } else {
          setLoading(false);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Đã có lỗi xảy ra.");
        setLoading(false);
      }
    }
    void init();
  }, [loadGuestsForSelection]);

  const summary = React.useMemo(() => {
    let attending = 0;
    let declined = 0;
    let pending = 0;
    let totalAttendees = 0;
    let groomAttending = 0;
    let brideAttending = 0;
    let bothAttending = 0;
    let shuttleAttendees = 0;

    for (const r of rows) {
      if (r.rsvpStatus === "attending") {
        attending += 1;
        totalAttendees += r.attendeeCount;
        if (r.guestSide === "groom") groomAttending += r.attendeeCount;
        else if (r.guestSide === "bride") brideAttending += r.attendeeCount;
        else bothAttending += r.attendeeCount;

        if (r.transportation === "shuttle") {
          shuttleAttendees += r.attendeeCount;
        }
      } else if (r.rsvpStatus === "declined") {
        declined += 1;
      } else {
        pending += 1;
      }
    }

    return {
      attending,
      declined,
      pending,
      totalAttendees,
      groomAttending,
      brideAttending,
      bothAttending,
      shuttleAttendees,
    };
  }, [rows]);

  const filteredRows = React.useMemo(() => {
    const q = normalizeVi(search.trim());
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.rsvpStatus !== statusFilter) return false;
      if (sideFilter !== "all" && r.guestSide !== sideFilter) return false;
      if (transportFilter !== "all" && r.transportation !== transportFilter) return false;
      if (!q) return true;
      return normalizeVi(`${r.fullName} ${r.salutation} ${r.note}`).includes(q);
    });
  }, [rows, search, statusFilter, sideFilter, transportFilter]);

  async function handleQuickRsvpChange(
    guestId: string,
    rsvpStatus: "pending" | "attending" | "declined",
  ): Promise<void> {
    setError(null);
    try {
      const res = await fetch(`/api/guests/${guestId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rsvpStatus }),
      });
      if (!res.ok) throw new Error("Không thể cập nhật RSVP.");
      setRows((prev) =>
        prev.map((item) => (item.id === guestId ? { ...item, rsvpStatus } : item)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cập nhật RSVP thất bại.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-ink">
            Thống kê Phản hồi RSVP
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            Theo dõi số mâm cỗ dự kiến, phân bổ Nhà Trai / Nhà Gái và nhu cầu xe đưa đón.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {invitations.length > 0 ? (
            <select
              value={selectedInvId}
              aria-label="Chọn thiệp cưới"
              onChange={(e) => {
                const next = e.target.value;
                setSelectedInvId(next);
                void loadGuestsForSelection(next, invitations);
              }}
              className={`min-h-[44px] rounded-xl border border-border-strong bg-surface px-3 text-xs font-medium text-ink ${FOCUS_RING}`}
            >
              <option value="all">Tất cả thiệp cưới</option>
              {invitations.map((inv) => (
                <option key={inv.id} value={inv.id}>
                  {inv.title}
                </option>
              ))}
            </select>
          ) : null}

          {selectedInvId && selectedInvId !== "all" ? (
            <a
              href={`/api/guests/export?invitationId=${encodeURIComponent(selectedInvId)}`}
              className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-border-strong bg-surface px-4 text-xs font-semibold text-ink transition-colors duration-200 hover:bg-blush-hover motion-reduce:transition-none ${FOCUS_RING}`}
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              Xuất CSV RSVP
            </a>
          ) : null}
        </div>
      </div>

      {error ? (
        <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      {invitations.length === 0 && !loading ? (
        <Card className="p-8 text-center">
          <p className="font-serif text-lg font-bold text-ink">Chưa có dữ liệu RSVP</p>
          <p className="mt-1 text-sm text-ink-muted">
            Tạo thiệp cưới và thêm khách mời để bắt đầu nhận phản hồi RSVP từ khách.
          </p>
          <div className="mt-4">
            <Link
              href="/dashboard/invitations?create=1"
              className={`inline-flex min-h-[44px] items-center rounded-full bg-burgundy px-5 text-xs font-semibold text-ivory transition-colors duration-200 hover:bg-burgundy-dark motion-reduce:transition-none ${FOCUS_RING}`}
            >
              Tạo thiệp cưới
            </Link>
          </div>
        </Card>
      ) : (
        <>
          {/* Unified Atelier Ledger */}
          <div className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border shadow-[var(--shadow-card)] sm:grid-cols-2 lg:grid-cols-3">
            <div className="bg-surface p-5">
              <div className="flex items-center justify-between text-xs text-ink-muted">
                <span>Khách xác nhận tham dự</span>
                <CheckCircle2 className="h-4 w-4 text-emerald-700" aria-hidden="true" />
              </div>
              <p className="mt-2 text-2xl font-bold tabular-nums text-emerald-700">
                {summary.attending}
              </p>
            </div>

            <div className="bg-surface p-5">
              <div className="flex items-center justify-between text-xs text-ink-muted">
                <span>Tổng số người đi kèm (đặt bàn)</span>
                <Users className="h-4 w-4 text-burgundy" aria-hidden="true" />
              </div>
              <p className="mt-2 text-2xl font-bold tabular-nums text-ink">
                {summary.totalAttendees}{" "}
                <span className="text-sm font-normal text-ink-muted">khách</span>
              </p>
            </div>

            <div className="bg-surface p-5">
              <div className="flex items-center justify-between text-xs text-ink-muted">
                <span>Chờ phản hồi / Từ chối</span>
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4 text-amber-text" aria-hidden="true" />
                  <XCircle className="h-4 w-4 text-red-600" aria-hidden="true" />
                </div>
              </div>
              <p className="mt-2 text-2xl font-bold tabular-nums text-ink">
                <span className="text-amber-text">{summary.pending}</span>
                <span className="mx-1.5 text-sm font-normal text-ink-muted">/</span>
                <span className="text-red-700">{summary.declined}</span>
              </p>
            </div>

            <div className="bg-surface p-5 sm:col-span-2">
              <p className="text-xs font-medium text-ink-muted">
                Phân bổ khách tham dự theo gia đình
              </p>
              <div className="mt-3 grid grid-cols-3 divide-x divide-border border-t border-border pt-3 text-center">
                <div className="px-2">
                  <p className="text-xs text-ink-muted">Nhà Trai</p>
                  <p className="mt-1 text-lg font-bold tabular-nums text-burgundy">
                    {summary.groomAttending}
                  </p>
                </div>
                <div className="px-2">
                  <p className="text-xs text-ink-muted">Nhà Gái</p>
                  <p className="mt-1 text-lg font-bold tabular-nums text-burgundy">
                    {summary.brideAttending}
                  </p>
                </div>
                <div className="px-2">
                  <p className="text-xs text-ink-muted">Chung 2 nhà</p>
                  <p className="mt-1 text-lg font-bold tabular-nums text-ink">
                    {summary.bothAttending}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-surface p-5">
              <div className="flex items-center justify-between text-xs text-ink-muted">
                <span>Đăng ký xe đưa đón</span>
                <Bus className="h-4 w-4 text-burgundy" aria-hidden="true" />
              </div>
              <p className="mt-2 text-2xl font-bold tabular-nums text-ink">
                {summary.shuttleAttendees}{" "}
                <span className="text-sm font-normal text-ink-muted">người</span>
              </p>
              <p className="mt-1 text-xs text-ink-muted">
                Tính trên các khách đã xác nhận đi xe đưa đón
              </p>
            </div>
          </div>

          {/* Filters */}
          <Card className="p-4">
            <div className="grid gap-3 md:grid-cols-[1fr_160px_160px_170px]">
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
                  aria-hidden="true"
                />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Tìm tên khách hoặc ghi chú RSVP..."
                  aria-label="Tìm phản hồi RSVP"
                  className={`min-h-[44px] w-full rounded-xl border border-border-strong bg-surface pl-10 pr-3 text-sm text-ink placeholder:text-ink-muted ${FOCUS_RING}`}
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                aria-label="Lọc trạng thái RSVP"
                className={`min-h-[44px] rounded-xl border border-border-strong bg-surface px-3 text-xs font-medium text-ink ${FOCUS_RING}`}
              >
                <option value="all">Mọi trạng thái</option>
                <option value="attending">Tham dự</option>
                <option value="pending">Chờ phản hồi</option>
                <option value="declined">Từ chối</option>
              </select>

              <select
                value={sideFilter}
                onChange={(e) => setSideFilter(e.target.value)}
                aria-label="Lọc gia đình"
                className={`min-h-[44px] rounded-xl border border-border-strong bg-surface px-3 text-xs font-medium text-ink ${FOCUS_RING}`}
              >
                <option value="all">Cả 2 gia đình</option>
                <option value="groom">Nhà Trai</option>
                <option value="bride">Nhà Gái</option>
                <option value="both">Chung 2 nhà</option>
              </select>

              <select
                value={transportFilter}
                onChange={(e) => setTransportFilter(e.target.value)}
                aria-label="Lọc phương tiện"
                className={`min-h-[44px] rounded-xl border border-border-strong bg-surface px-3 text-xs font-medium text-ink ${FOCUS_RING}`}
              >
                <option value="all">Mọi phương tiện</option>
                <option value="self">Tự túc di chuyển</option>
                <option value="shuttle">Xe đưa đón</option>
                <option value="car">Ô tô riêng</option>
              </select>
            </div>
          </Card>

          {/* List / Table */}
          <Card className="overflow-hidden">
            {loading ? (
              <div className="p-6 text-center text-sm text-ink-muted">Đang tải dữ liệu RSVP...</div>
            ) : filteredRows.length === 0 ? (
              <div className="p-10 text-center text-sm text-ink-muted">
                Không có khách mời nào phù hợp với bộ lọc.
              </div>
            ) : (
              <>
                {/* Mobile Card Stack */}
                <div className="divide-y divide-border md:hidden">
                  {filteredRows.map((row) => {
                    const badge = RSVP_BADGE[row.rsvpStatus] ?? RSVP_BADGE.pending;
                    return (
                      <div key={row.id} className="space-y-3 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-semibold text-ink">
                              {row.salutation} {row.fullName}
                            </p>
                            <p className="mt-0.5 text-xs text-ink-secondary">
                              {SIDE_LABELS[row.guestSide] ?? row.guestSide} ·{" "}
                              {TRANSPORT_LABELS[row.transportation] ?? row.transportation}
                            </p>
                            {selectedInvId === "all" && row.invitationTitle ? (
                              <p className="mt-0.5 text-xs text-ink-muted">{row.invitationTitle}</p>
                            ) : null}
                          </div>
                          <span
                            className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums ${badge.className}`}
                          >
                            {badge.label}
                            {row.rsvpStatus === "attending" ? ` (${row.attendeeCount})` : ""}
                          </span>
                        </div>
                        {row.note ? (
                          <p className="text-xs text-ink-secondary">{row.note}</p>
                        ) : null}
                        <div>
                          <select
                            value={row.rsvpStatus}
                            aria-label={`Đổi trạng thái RSVP cho ${row.fullName}`}
                            onChange={(e) =>
                              void handleQuickRsvpChange(
                                row.id,
                                e.target.value as "pending" | "attending" | "declined",
                              )
                            }
                            className={`min-h-[44px] w-full rounded-xl border border-border-strong bg-surface px-3 text-xs font-medium text-ink ${FOCUS_RING}`}
                          >
                            <option value="pending">Chờ phản hồi</option>
                            <option value="attending">Tham dự</option>
                            <option value="declined">Từ chối</option>
                          </select>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Desktop Table */}
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full min-w-[740px] border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-border bg-ivory text-xs font-semibold uppercase tracking-wider text-ink-muted">
                        <th className="px-4 py-3">Khách mời</th>
                        <th className="px-3 py-3">Gia đình</th>
                        <th className="px-3 py-3">Trạng thái</th>
                        <th className="px-3 py-3">Số người</th>
                        <th className="px-3 py-3">Di chuyển</th>
                        <th className="px-3 py-3">Ghi chú</th>
                        <th className="px-4 py-3 text-right">Cập nhật nhanh</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredRows.map((row) => {
                        const badge = RSVP_BADGE[row.rsvpStatus] ?? RSVP_BADGE.pending;
                        return (
                          <tr key={row.id} className="hover:bg-ivory">
                            <td className="px-4 py-3">
                              <p className="font-semibold text-ink">
                                {row.salutation} {row.fullName}
                              </p>
                              {selectedInvId === "all" && row.invitationTitle ? (
                                <p className="text-xs text-ink-muted">{row.invitationTitle}</p>
                              ) : null}
                            </td>
                            <td className="px-3 py-3 text-ink-secondary">
                              {SIDE_LABELS[row.guestSide] ?? row.guestSide}
                            </td>
                            <td className="px-3 py-3">
                              <span
                                className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${badge.className}`}
                              >
                                {badge.label}
                              </span>
                            </td>
                            <td className="px-3 py-3 font-semibold tabular-nums text-ink">
                              {row.rsvpStatus === "attending" ? row.attendeeCount : "—"}
                            </td>
                            <td className="px-3 py-3 text-ink-secondary">
                              {TRANSPORT_LABELS[row.transportation] ?? row.transportation}
                            </td>
                            <td className="max-w-xs px-3 py-3 text-ink-secondary">
                              {row.note || <span className="text-ink-muted">—</span>}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <select
                                value={row.rsvpStatus}
                                aria-label={`Đổi trạng thái RSVP cho ${row.fullName}`}
                                onChange={(e) =>
                                  void handleQuickRsvpChange(
                                    row.id,
                                    e.target.value as "pending" | "attending" | "declined",
                                  )
                                }
                                className={`min-h-[44px] rounded-xl border border-border-strong bg-surface px-3 text-xs font-medium text-ink ${FOCUS_RING}`}
                              >
                                <option value="pending">Chờ phản hồi</option>
                                <option value="attending">Tham dự</option>
                                <option value="declined">Từ chối</option>
                              </select>
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
    </div>
  );
}
