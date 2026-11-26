"use client";

import * as React from "react";
import Image from "next/image";
import {
  CalendarHeart,
  CreditCard,
  Plus,
  QrCode,
  Save,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { isoDateToLunar } from "@/modules/invitation-engine/lunar";
import type { WeddingProfileData } from "@/modules/invitation-engine/schema";
import { buildVietQrPayload, VIETNAM_BANKS } from "@/modules/vietqr";
import { renderQrDataUrl } from "@/modules/vietqr/qr-render";

interface ProfileApiRecord {
  id: string;
  name: string;
  groomInfo: WeddingProfileData["groom"];
  brideInfo: WeddingProfileData["bride"];
  events: WeddingProfileData["events"];
  bankAccounts: WeddingProfileData["bankAccounts"];
  photoKeys: string[];
  updatedAt: string;
}

const FOCUS_RING =
  "focus-visible:outline-2 focus-visible:outline-burgundy focus-visible:outline-offset-2";

const CEREMONY_OPTIONS = [
  { value: "an_hoi", label: "Lễ Ăn Hỏi" },
  { value: "vu_quy", label: "Lễ Vu Quy" },
  { value: "thanh_hon", label: "Lễ Thành Hôn" },
  { value: "tan_hon", label: "Lễ Tân Hôn" },
  { value: "tiec_cuoi", label: "Tiệc Cưới" },
  { value: "bao_hy", label: "Lễ Báo Hỷ" },
  { value: "other", label: "Sự kiện khác" },
] as const;

type CeremonyType = (typeof CEREMONY_OPTIONS)[number]["value"];

function createEmptyFormState(): {
  id: string | null;
  name: string;
  groom: WeddingProfileData["groom"];
  bride: WeddingProfileData["bride"];
  events: WeddingProfileData["events"];
  bankAccounts: WeddingProfileData["bankAccounts"];
} {
  return {
    id: null,
    name: "Hồ sơ cưới mới",
    groom: {
      fullName: "",
      shortName: "",
      phone: "",
      fatherName: "",
      motherName: "",
      homeAddress: "",
      homeMapUrl: "",
    },
    bride: {
      fullName: "",
      shortName: "",
      phone: "",
      fatherName: "",
      motherName: "",
      homeAddress: "",
      homeMapUrl: "",
    },
    events: [
      {
        id: `ev-${Date.now()}`,
        type: "thanh_hon",
        title: "Lễ Thành Hôn & Tiệc Cưới",
        date: "2026-12-20",
        welcomeTime: "10:30",
        time: "11:30",
        venueName: "",
        venueAddress: "",
        venueMapUrl: "",
      },
    ],
    bankAccounts: [],
  };
}

function BankQrPreview({
  account,
  coupleHint,
}: {
  account: WeddingProfileData["bankAccounts"][number];
  coupleHint: string;
}): React.ReactElement {
  const [qrUrl, setQrUrl] = React.useState("");
  const [qrErr, setQrErr] = React.useState("");

  React.useEffect(() => {
    let cancelled = false;
    async function gen(): Promise<void> {
      try {
        const payload = buildVietQrPayload({
          bankBin: account.bankBin,
          accountNumber: account.accountNumber,
          description: `Mung cuoi ${coupleHint || "Co dau Chu re"}`,
        });
        const url = await renderQrDataUrl(payload, 220);
        if (!cancelled) {
          setQrUrl(url);
          setQrErr("");
        }
      } catch (err) {
        if (!cancelled) {
          setQrUrl("");
          setQrErr(
            err instanceof Error
              ? err.message
              : "Nhập đúng số tài khoản (4–30 ký tự chữ/số) để xem trước QR.",
          );
        }
      }
    }
    void gen();
    return () => {
      cancelled = true;
    };
  }, [account.bankBin, account.accountNumber, coupleHint]);

  return (
    <div className="flex flex-col items-center justify-center rounded-xl bg-ivory p-3 text-center">
      {qrUrl ? (
        <Image
          src={qrUrl}
          alt={`VietQR ${account.bankShortName} - ${account.accountHolder || account.accountNumber}`}
          width={220}
          height={220}
          unoptimized
          className="h-36 w-36 rounded-lg border border-border bg-surface object-contain p-1"
        />
      ) : (
        <div className="flex h-36 w-36 flex-col items-center justify-center rounded-lg border border-dashed border-border-strong bg-surface p-3 text-xs text-ink-muted">
          <QrCode className="mb-1.5 h-6 w-6 text-burgundy/60" aria-hidden="true" />
          <span>{qrErr || "Đang tạo QR..."}</span>
        </div>
      )}
      <p className="mt-2 text-xs font-semibold text-burgundy">
        VietQR 0% phí, {account.bankShortName}
      </p>
      <p className="text-xs text-ink-secondary">{account.accountHolder || "Chủ tài khoản"}</p>
    </div>
  );
}

export default function WeddingProfilePage(): React.ReactElement {
  const [profiles, setProfiles] = React.useState<ProfileApiRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  const [form, setForm] = React.useState(createEmptyFormState);

  const applyRecordToForm = React.useCallback((rec: ProfileApiRecord) => {
    setForm({
      id: rec.id,
      name: rec.name,
      groom: {
        fullName: rec.groomInfo.fullName ?? "",
        shortName: rec.groomInfo.shortName ?? "",
        phone: rec.groomInfo.phone ?? "",
        fatherName: rec.groomInfo.fatherName ?? "",
        motherName: rec.groomInfo.motherName ?? "",
        homeAddress: rec.groomInfo.homeAddress ?? "",
        homeMapUrl: rec.groomInfo.homeMapUrl ?? "",
      },
      bride: {
        fullName: rec.brideInfo.fullName ?? "",
        shortName: rec.brideInfo.shortName ?? "",
        phone: rec.brideInfo.phone ?? "",
        fatherName: rec.brideInfo.fatherName ?? "",
        motherName: rec.brideInfo.motherName ?? "",
        homeAddress: rec.brideInfo.homeAddress ?? "",
        homeMapUrl: rec.brideInfo.homeMapUrl ?? "",
      },
      events: rec.events ?? [],
      bankAccounts: rec.bankAccounts ?? [],
    });
  }, []);

  const loadProfiles = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/wedding-profiles");
      const data = (await res.json().catch(() => ({}))) as {
        profiles?: ProfileApiRecord[];
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || "Không thể tải danh sách hồ sơ cưới.");
      }
      const list = data.profiles ?? [];
      setProfiles(list);
      if (list.length > 0) {
        applyRecordToForm(list[0]);
      } else {
        setForm(createEmptyFormState());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đã có lỗi xảy ra.");
    } finally {
      setLoading(false);
    }
  }, [applyRecordToForm]);

  React.useEffect(() => {
    void loadProfiles();
  }, [loadProfiles]);

  async function handleSave(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);

    const payload = {
      name: form.name.trim(),
      groom: form.groom,
      bride: form.bride,
      events: form.events,
      bankAccounts: form.bankAccounts,
      photoKeys: [],
    };

    try {
      const url = form.id ? `/api/wedding-profiles/${form.id}` : "/api/wedding-profiles";
      const method = form.id ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as {
        profile?: ProfileApiRecord;
        error?: string;
      };
      if (!res.ok || !data.profile) {
        throw new Error(data.error || "Không thể lưu hồ sơ cưới. Vui lòng kiểm tra thông tin bắt buộc.");
      }
      const saved = data.profile;
      setProfiles((prev) => {
        const exists = prev.some((item) => item.id === saved.id);
        return exists ? prev.map((item) => (item.id === saved.id ? saved : item)) : [saved, ...prev];
      });
      applyRecordToForm(saved);
      setNotice("Đã lưu Hồ sơ cưới thành công. Bạn có thể dùng hồ sơ này để tự điền vào mọi mẫu thiệp.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lưu hồ sơ thất bại.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteProfile(): Promise<void> {
    if (!form.id) return;
    setDeleting(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/wedding-profiles/${form.id}`, { method: "DELETE" });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error || "Không thể xóa hồ sơ cưới.");
      }
      const remaining = profiles.filter((p) => p.id !== form.id);
      setProfiles(remaining);
      if (remaining.length > 0) {
        applyRecordToForm(remaining[0]);
      } else {
        setForm(createEmptyFormState());
      }
      setNotice("Đã xóa hồ sơ cưới.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xóa hồ sơ thất bại.");
    } finally {
      setDeleting(false);
    }
  }

  function addEvent(): void {
    if (form.events.length >= 8) return;
    setForm((prev) => ({
      ...prev,
      events: [
        ...prev.events,
        {
          id: `ev-${Date.now()}-${prev.events.length}`,
          type: "vu_quy",
          title: "Lễ Vu Quy",
          date: "2026-12-20",
          welcomeTime: "09:00",
          time: "09:30",
          venueName: "",
          venueAddress: "",
          venueMapUrl: "",
        },
      ],
    }));
  }

  function updateEvent(index: number, patch: Partial<WeddingProfileData["events"][number]>): void {
    setForm((prev) => ({
      ...prev,
      events: prev.events.map((ev, idx) => (idx === index ? { ...ev, ...patch } : ev)),
    }));
  }

  function removeEvent(index: number): void {
    setForm((prev) => ({
      ...prev,
      events: prev.events.filter((_, idx) => idx !== index),
    }));
  }

  function addBankAccount(side: "groom" | "bride"): void {
    if (form.bankAccounts.length >= 4) return;
    const defaultBank = VIETNAM_BANKS[0];
    setForm((prev) => ({
      ...prev,
      bankAccounts: [
        ...prev.bankAccounts,
        {
          side,
          bankBin: defaultBank.bin,
          bankShortName: defaultBank.shortName,
          accountNumber: "",
          accountHolder: "",
        },
      ],
    }));
  }

  function updateBankAccount(
    index: number,
    patch: Partial<WeddingProfileData["bankAccounts"][number]>,
  ): void {
    setForm((prev) => ({
      ...prev,
      bankAccounts: prev.bankAccounts.map((acc, idx) => (idx === index ? { ...acc, ...patch } : acc)),
    }));
  }

  function removeBankAccount(index: number): void {
    setForm((prev) => ({
      ...prev,
      bankAccounts: prev.bankAccounts.filter((_, idx) => idx !== index),
    }));
  }

  const coupleHint = `${form.groom.shortName || "Chu re"} ${form.bride.shortName || "Co dau"}`.trim();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-ink">
            Hồ sơ cưới &amp; Lịch âm Can Chi
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            Nhập thông tin hai bên gia đình, nhiều nghi lễ và tài khoản VietQR một lần — tái sử dụng cho mọi thiệp cưới.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setNotice(null);
              setError(null);
              setForm(createEmptyFormState());
            }}
            className="min-h-[44px] motion-reduce:transition-none"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Tạo hồ sơ mới
          </Button>
          {form.id ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={deleting}
              onClick={() => void handleDeleteProfile()}
              className="min-h-[44px] text-red-700 hover:bg-red-50 motion-reduce:transition-none"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Xóa hồ sơ
            </Button>
          ) : null}
        </div>
      </div>

      {/* Profile Selector Pills */}
      {!loading && profiles.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Chọn hồ sơ cưới">
          {profiles.map((p) => {
            const active = form.id === p.id;
            return (
              <button
                key={p.id}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  setNotice(null);
                  setError(null);
                  applyRecordToForm(p);
                }}
                className={`min-h-[44px] rounded-full px-4 py-2 text-xs font-semibold transition-colors duration-200 motion-reduce:transition-none cursor-pointer ${FOCUS_RING} ${
                  active
                    ? "bg-burgundy text-ivory"
                    : "border border-border bg-surface text-ink-secondary hover:bg-blush-hover"
                }`}
              >
                {p.name}
              </button>
            );
          })}
        </div>
      ) : null}

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

      {loading ? (
        <Card className="p-8">
          <div className="h-6 w-48 animate-pulse rounded bg-border motion-reduce:animate-none" />
          <div className="mt-4 h-36 w-full animate-pulse rounded-xl bg-blush motion-reduce:animate-none" />
        </Card>
      ) : (
        <form onSubmit={(e) => void handleSave(e)} className="space-y-6">
          {/* Profile Name */}
          <Card className="p-5">
            <label htmlFor="profile-name" className="block text-xs font-semibold text-ink">
              Tên gọi hồ sơ (lưu tối đa 5 hồ sơ/tài khoản) *
            </label>
            <input
              id="profile-name"
              type="text"
              required
              maxLength={80}
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="VD: Đám cưới Minh Anh & Gia Huy"
              className={`mt-1.5 min-h-[44px] w-full rounded-xl border border-border-strong bg-surface px-3 text-sm text-ink ${FOCUS_RING}`}
            />
          </Card>

          {/* Groom & Bride Dual-Family Forms */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="p-5">
              <h2 className="font-serif text-xl font-bold text-ink">Thông tin Nhà Trai</h2>
              <p className="mt-0.5 text-xs text-ink-muted">Chú rể &amp; Song thân Nhà Trai</p>
              <div className="mt-4 space-y-3 border-t border-border pt-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="groom-full-name" className="block text-xs font-semibold text-ink">
                      Họ tên Chú rể *
                    </label>
                    <input
                      id="groom-full-name"
                      type="text"
                      required
                      maxLength={80}
                      value={form.groom.fullName}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          groom: { ...prev.groom, fullName: e.target.value },
                        }))
                      }
                      placeholder="Nguyễn Gia Huy"
                      className={`mt-1 min-h-[44px] w-full rounded-xl border border-border-strong bg-surface px-3 text-sm text-ink ${FOCUS_RING}`}
                    />
                  </div>
                  <div>
                    <label htmlFor="groom-short-name" className="block text-xs font-semibold text-ink">
                      Tên ngắn hiển thị *
                    </label>
                    <input
                      id="groom-short-name"
                      type="text"
                      required
                      maxLength={40}
                      value={form.groom.shortName}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          groom: { ...prev.groom, shortName: e.target.value },
                        }))
                      }
                      placeholder="Gia Huy"
                      className={`mt-1 min-h-[44px] w-full rounded-xl border border-border-strong bg-surface px-3 text-sm text-ink ${FOCUS_RING}`}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="groom-phone" className="block text-xs font-semibold text-ink">
                    Số điện thoại
                  </label>
                  <input
                    id="groom-phone"
                    type="tel"
                    maxLength={20}
                    value={form.groom.phone ?? ""}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        groom: { ...prev.groom, phone: e.target.value },
                      }))
                    }
                    placeholder="0901 234 567"
                    className={`mt-1 min-h-[44px] w-full rounded-xl border border-border-strong bg-surface px-3 text-sm tabular-nums text-ink ${FOCUS_RING}`}
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="groom-father" className="block text-xs font-semibold text-ink">
                      Họ tên Bố
                    </label>
                    <input
                      id="groom-father"
                      type="text"
                      maxLength={80}
                      value={form.groom.fatherName ?? ""}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          groom: { ...prev.groom, fatherName: e.target.value },
                        }))
                      }
                      placeholder="Ông Nguyễn Văn Minh"
                      className={`mt-1 min-h-[44px] w-full rounded-xl border border-border-strong bg-surface px-3 text-sm text-ink ${FOCUS_RING}`}
                    />
                  </div>
                  <div>
                    <label htmlFor="groom-mother" className="block text-xs font-semibold text-ink">
                      Họ tên Mẹ
                    </label>
                    <input
                      id="groom-mother"
                      type="text"
                      maxLength={80}
                      value={form.groom.motherName ?? ""}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          groom: { ...prev.groom, motherName: e.target.value },
                        }))
                      }
                      placeholder="Bà Trần Thị Lan"
                      className={`mt-1 min-h-[44px] w-full rounded-xl border border-border-strong bg-surface px-3 text-sm text-ink ${FOCUS_RING}`}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="groom-address" className="block text-xs font-semibold text-ink">
                    Địa chỉ tư gia
                  </label>
                  <input
                    id="groom-address"
                    type="text"
                    maxLength={200}
                    value={form.groom.homeAddress ?? ""}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        groom: { ...prev.groom, homeAddress: e.target.value },
                      }))
                    }
                    placeholder="Số 12 Nguyễn Huệ, Quận 1, TP.HCM"
                    className={`mt-1 min-h-[44px] w-full rounded-xl border border-border-strong bg-surface px-3 text-sm text-ink ${FOCUS_RING}`}
                  />
                </div>

                <div>
                  <label htmlFor="groom-map" className="block text-xs font-semibold text-ink">
                    Link Google Maps tư gia (tùy chọn)
                  </label>
                  <input
                    id="groom-map"
                    type="url"
                    maxLength={500}
                    value={form.groom.homeMapUrl ?? ""}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        groom: { ...prev.groom, homeMapUrl: e.target.value },
                      }))
                    }
                    placeholder="https://maps.google.com/..."
                    className={`mt-1 min-h-[44px] w-full rounded-xl border border-border-strong bg-surface px-3 text-sm text-ink ${FOCUS_RING}`}
                  />
                </div>
              </div>
            </Card>

            <Card className="p-5">
              <h2 className="font-serif text-xl font-bold text-ink">Thông tin Nhà Gái</h2>
              <p className="mt-0.5 text-xs text-ink-muted">Cô dâu &amp; Song thân Nhà Gái</p>
              <div className="mt-4 space-y-3 border-t border-border pt-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="bride-full-name" className="block text-xs font-semibold text-ink">
                      Họ tên Cô dâu *
                    </label>
                    <input
                      id="bride-full-name"
                      type="text"
                      required
                      maxLength={80}
                      value={form.bride.fullName}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          bride: { ...prev.bride, fullName: e.target.value },
                        }))
                      }
                      placeholder="Lê Minh Anh"
                      className={`mt-1 min-h-[44px] w-full rounded-xl border border-border-strong bg-surface px-3 text-sm text-ink ${FOCUS_RING}`}
                    />
                  </div>
                  <div>
                    <label htmlFor="bride-short-name" className="block text-xs font-semibold text-ink">
                      Tên ngắn hiển thị *
                    </label>
                    <input
                      id="bride-short-name"
                      type="text"
                      required
                      maxLength={40}
                      value={form.bride.shortName}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          bride: { ...prev.bride, shortName: e.target.value },
                        }))
                      }
                      placeholder="Minh Anh"
                      className={`mt-1 min-h-[44px] w-full rounded-xl border border-border-strong bg-surface px-3 text-sm text-ink ${FOCUS_RING}`}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="bride-phone" className="block text-xs font-semibold text-ink">
                    Số điện thoại
                  </label>
                  <input
                    id="bride-phone"
                    type="tel"
                    maxLength={20}
                    value={form.bride.phone ?? ""}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        bride: { ...prev.bride, phone: e.target.value },
                      }))
                    }
                    placeholder="0909 888 777"
                    className={`mt-1 min-h-[44px] w-full rounded-xl border border-border-strong bg-surface px-3 text-sm tabular-nums text-ink ${FOCUS_RING}`}
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="bride-father" className="block text-xs font-semibold text-ink">
                      Họ tên Bố
                    </label>
                    <input
                      id="bride-father"
                      type="text"
                      maxLength={80}
                      value={form.bride.fatherName ?? ""}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          bride: { ...prev.bride, fatherName: e.target.value },
                        }))
                      }
                      placeholder="Ông Lê Hoàng Nam"
                      className={`mt-1 min-h-[44px] w-full rounded-xl border border-border-strong bg-surface px-3 text-sm text-ink ${FOCUS_RING}`}
                    />
                  </div>
                  <div>
                    <label htmlFor="bride-mother" className="block text-xs font-semibold text-ink">
                      Họ tên Mẹ
                    </label>
                    <input
                      id="bride-mother"
                      type="text"
                      maxLength={80}
                      value={form.bride.motherName ?? ""}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          bride: { ...prev.bride, motherName: e.target.value },
                        }))
                      }
                      placeholder="Bà Phạm Thu Hà"
                      className={`mt-1 min-h-[44px] w-full rounded-xl border border-border-strong bg-surface px-3 text-sm text-ink ${FOCUS_RING}`}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="bride-address" className="block text-xs font-semibold text-ink">
                    Địa chỉ tư gia
                  </label>
                  <input
                    id="bride-address"
                    type="text"
                    maxLength={200}
                    value={form.bride.homeAddress ?? ""}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        bride: { ...prev.bride, homeAddress: e.target.value },
                      }))
                    }
                    placeholder="Số 45 Hai Bà Trưng, Hoàn Kiếm, Hà Nội"
                    className={`mt-1 min-h-[44px] w-full rounded-xl border border-border-strong bg-surface px-3 text-sm text-ink ${FOCUS_RING}`}
                  />
                </div>

                <div>
                  <label htmlFor="bride-map" className="block text-xs font-semibold text-ink">
                    Link Google Maps tư gia (tùy chọn)
                  </label>
                  <input
                    id="bride-map"
                    type="url"
                    maxLength={500}
                    value={form.bride.homeMapUrl ?? ""}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        bride: { ...prev.bride, homeMapUrl: e.target.value },
                      }))
                    }
                    placeholder="https://maps.google.com/..."
                    className={`mt-1 min-h-[44px] w-full rounded-xl border border-border-strong bg-surface px-3 text-sm text-ink ${FOCUS_RING}`}
                  />
                </div>
              </div>
            </Card>
          </div>

          {/* Multi-Ceremony Manager with Live Lunar Can Chi */}
          <Card className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <CalendarHeart className="h-5 w-5 text-burgundy" aria-hidden="true" />
                <div>
                  <h2 className="font-serif text-xl font-bold text-ink">
                    Lịch trình các Nghi lễ (<span className="tabular-nums">{form.events.length}/8</span>)
                  </h2>
                  <p className="text-xs text-ink-muted">
                    Tự động quy đổi ngày Âm lịch &amp; Can Chi chuẩn xác bên cạnh mỗi ngày dương lịch.
                  </p>
                </div>
              </div>

              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={form.events.length >= 8}
                onClick={addEvent}
                className="min-h-[44px] motion-reduce:transition-none"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                Thêm nghi lễ
              </Button>
            </div>

            <div className="mt-5 divide-y divide-border border-t border-border">
              {form.events.map((ev, index) => {
                const lunar = isoDateToLunar(ev.date);
                return (
                  <div key={ev.id} className="py-5 first:pt-5 last:pb-0">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wider tabular-nums text-burgundy">
                        Sự kiện #{index + 1}
                      </span>
                      <div className="flex flex-wrap items-center gap-2">
                        {lunar ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-surface px-3 py-1 text-xs font-semibold tabular-nums text-amber-text">
                            <Sparkles className="h-3 w-3" aria-hidden="true" />
                            Âm lịch: {lunar.formatted}, Ngày {lunar.canChiDay}, Tháng {lunar.canChiMonth}
                          </span>
                        ) : (
                          <span className="rounded-full bg-red-50 px-3 py-1 text-xs text-red-700">
                            Ngày chưa hợp lệ
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => removeEvent(index)}
                          aria-label={`Xóa sự kiện ${ev.title}`}
                          className={`inline-flex h-11 w-11 items-center justify-center rounded-full text-red-700 transition-colors duration-200 hover:bg-red-50 motion-reduce:transition-none cursor-pointer ${FOCUS_RING}`}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <div>
                        <label
                          htmlFor={`event-${index}-type`}
                          className="block text-xs font-semibold text-ink"
                        >
                          Loại nghi lễ
                        </label>
                        <select
                          id={`event-${index}-type`}
                          value={ev.type}
                          onChange={(e) =>
                            updateEvent(index, { type: e.target.value as CeremonyType })
                          }
                          className={`mt-1 min-h-[44px] w-full rounded-xl border border-border-strong bg-surface px-3 text-sm text-ink ${FOCUS_RING}`}
                        >
                          {CEREMONY_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label
                          htmlFor={`event-${index}-title`}
                          className="block text-xs font-semibold text-ink"
                        >
                          Tiêu đề hiển thị *
                        </label>
                        <input
                          id={`event-${index}-title`}
                          type="text"
                          required
                          maxLength={100}
                          value={ev.title}
                          onChange={(e) => updateEvent(index, { title: e.target.value })}
                          placeholder="Lễ Thành Hôn"
                          className={`mt-1 min-h-[44px] w-full rounded-xl border border-border-strong bg-surface px-3 text-sm text-ink ${FOCUS_RING}`}
                        />
                      </div>

                      <div>
                        <label
                          htmlFor={`event-${index}-date`}
                          className="block text-xs font-semibold text-ink"
                        >
                          Ngày dương lịch *
                        </label>
                        <input
                          id={`event-${index}-date`}
                          type="date"
                          required
                          value={ev.date}
                          onChange={(e) => updateEvent(index, { date: e.target.value })}
                          className={`mt-1 min-h-[44px] w-full rounded-xl border border-border-strong bg-surface px-3 text-sm tabular-nums text-ink ${FOCUS_RING}`}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label
                            htmlFor={`event-${index}-welcome`}
                            className="block text-xs font-semibold text-ink"
                          >
                            Đón khách
                          </label>
                          <input
                            id={`event-${index}-welcome`}
                            type="text"
                            maxLength={20}
                            value={ev.welcomeTime ?? ""}
                            onChange={(e) => updateEvent(index, { welcomeTime: e.target.value })}
                            placeholder="10:30"
                            className={`mt-1 min-h-[44px] w-full rounded-xl border border-border-strong bg-surface px-3 text-sm tabular-nums text-ink ${FOCUS_RING}`}
                          />
                        </div>
                        <div>
                          <label
                            htmlFor={`event-${index}-time`}
                            className="block text-xs font-semibold text-ink"
                          >
                            Khai tiệc
                          </label>
                          <input
                            id={`event-${index}-time`}
                            type="text"
                            maxLength={20}
                            value={ev.time}
                            onChange={(e) => updateEvent(index, { time: e.target.value })}
                            placeholder="11:30"
                            className={`mt-1 min-h-[44px] w-full rounded-xl border border-border-strong bg-surface px-3 text-sm tabular-nums text-ink ${FOCUS_RING}`}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                      <div>
                        <label
                          htmlFor={`event-${index}-venue-name`}
                          className="block text-xs font-semibold text-ink"
                        >
                          Tên địa điểm / Nhà hàng
                        </label>
                        <input
                          id={`event-${index}-venue-name`}
                          type="text"
                          maxLength={120}
                          value={ev.venueName}
                          onChange={(e) => updateEvent(index, { venueName: e.target.value })}
                          placeholder="Trung tâm Hội nghị White Palace"
                          className={`mt-1 min-h-[44px] w-full rounded-xl border border-border-strong bg-surface px-3 text-sm text-ink ${FOCUS_RING}`}
                        />
                      </div>
                      <div>
                        <label
                          htmlFor={`event-${index}-venue-address`}
                          className="block text-xs font-semibold text-ink"
                        >
                          Địa chỉ chi tiết
                        </label>
                        <input
                          id={`event-${index}-venue-address`}
                          type="text"
                          maxLength={220}
                          value={ev.venueAddress}
                          onChange={(e) => updateEvent(index, { venueAddress: e.target.value })}
                          placeholder="194 Hoàng Văn Thụ, Phú Nhuận, TP.HCM"
                          className={`mt-1 min-h-[44px] w-full rounded-xl border border-border-strong bg-surface px-3 text-sm text-ink ${FOCUS_RING}`}
                        />
                      </div>
                      <div>
                        <label
                          htmlFor={`event-${index}-venue-map`}
                          className="block text-xs font-semibold text-ink"
                        >
                          Link Google Maps (tùy chọn)
                        </label>
                        <input
                          id={`event-${index}-venue-map`}
                          type="url"
                          maxLength={500}
                          value={ev.venueMapUrl ?? ""}
                          onChange={(e) => updateEvent(index, { venueMapUrl: e.target.value })}
                          placeholder="https://maps.google.com/..."
                          className={`mt-1 min-h-[44px] w-full rounded-xl border border-border-strong bg-surface px-3 text-sm text-ink ${FOCUS_RING}`}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Dual-side VietQR Bank Accounts */}
          <Card className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <CreditCard className="h-5 w-5 text-burgundy" aria-hidden="true" />
                <div>
                  <h2 className="font-serif text-xl font-bold text-ink">
                    Tài khoản Mừng cưới VietQR 0% phí (<span className="tabular-nums">{form.bankAccounts.length}/4</span>)
                  </h2>
                  <p className="text-xs text-ink-muted">
                    Khách mời quét QR chuyển thẳng vào tài khoản Nhà Trai / Nhà Gái, xem trước QR chuẩn Napas ngay bên dưới.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={form.bankAccounts.length >= 4}
                  onClick={() => addBankAccount("groom")}
                  className="min-h-[44px] motion-reduce:transition-none"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  Thêm TK Nhà Trai
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={form.bankAccounts.length >= 4}
                  onClick={() => addBankAccount("bride")}
                  className="min-h-[44px] motion-reduce:transition-none"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  Thêm TK Nhà Gái
                </Button>
              </div>
            </div>

            {form.bankAccounts.length === 0 ? (
              <p className="mt-4 border-t border-border pt-6 text-center text-xs text-ink-muted">
                Chưa có tài khoản ngân hàng nào. Nhấn &ldquo;Thêm TK Nhà Trai&rdquo; hoặc &ldquo;Thêm TK Nhà Gái&rdquo; để kích hoạt hộp mừng cưới VietQR.
              </p>
            ) : (
              <div className="mt-5 divide-y divide-border border-t border-border">
                {form.bankAccounts.map((acc, index) => (
                  <div
                    key={`bank-${index}`}
                    className="grid gap-5 py-5 first:pt-5 last:pb-0 lg:grid-cols-[1fr_200px]"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="rounded-full bg-blush px-3 py-1 text-xs font-semibold text-burgundy">
                          {acc.side === "groom" ? "Nhà Trai" : "Nhà Gái"}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeBankAccount(index)}
                          aria-label="Xóa tài khoản ngân hàng"
                          className={`inline-flex h-11 w-11 items-center justify-center rounded-full text-red-700 transition-colors duration-200 hover:bg-red-50 motion-reduce:transition-none cursor-pointer ${FOCUS_RING}`}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <label
                            htmlFor={`bank-${index}-side`}
                            className="block text-xs font-semibold text-ink"
                          >
                            Gia đình
                          </label>
                          <select
                            id={`bank-${index}-side`}
                            value={acc.side}
                            onChange={(e) =>
                              updateBankAccount(index, {
                                side: e.target.value as "groom" | "bride",
                              })
                            }
                            className={`mt-1 min-h-[44px] w-full rounded-xl border border-border-strong bg-surface px-3 text-xs text-ink ${FOCUS_RING}`}
                          >
                            <option value="groom">Nhà Trai</option>
                            <option value="bride">Nhà Gái</option>
                          </select>
                        </div>

                        <div>
                          <label
                            htmlFor={`bank-${index}-bin`}
                            className="block text-xs font-semibold text-ink"
                          >
                            Ngân hàng (Napas VietQR)
                          </label>
                          <select
                            id={`bank-${index}-bin`}
                            value={acc.bankBin}
                            onChange={(e) => {
                              const selected = VIETNAM_BANKS.find((b) => b.bin === e.target.value);
                              if (selected) {
                                updateBankAccount(index, {
                                  bankBin: selected.bin,
                                  bankShortName: selected.shortName,
                                });
                              }
                            }}
                            className={`mt-1 min-h-[44px] w-full rounded-xl border border-border-strong bg-surface px-3 text-xs text-ink ${FOCUS_RING}`}
                          >
                            {VIETNAM_BANKS.map((bank) => (
                              <option key={bank.bin} value={bank.bin}>
                                {bank.shortName} — {bank.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <label
                            htmlFor={`bank-${index}-number`}
                            className="block text-xs font-semibold text-ink"
                          >
                            Số tài khoản *
                          </label>
                          <input
                            id={`bank-${index}-number`}
                            type="text"
                            required
                            pattern="[a-zA-Z0-9]{4,30}"
                            value={acc.accountNumber}
                            onChange={(e) =>
                              updateBankAccount(index, {
                                accountNumber: e.target.value.replace(/[^a-zA-Z0-9]/g, ""),
                              })
                            }
                            placeholder="0123456789"
                            className={`mt-1 min-h-[44px] w-full rounded-xl border border-border-strong bg-surface px-3 font-mono text-xs tabular-nums text-ink ${FOCUS_RING}`}
                          />
                        </div>

                        <div>
                          <label
                            htmlFor={`bank-${index}-holder`}
                            className="block text-xs font-semibold text-ink"
                          >
                            Tên chủ tài khoản *
                          </label>
                          <input
                            id={`bank-${index}-holder`}
                            type="text"
                            required
                            maxLength={80}
                            value={acc.accountHolder}
                            onChange={(e) =>
                              updateBankAccount(index, { accountHolder: e.target.value })
                            }
                            placeholder="NGUYEN GIA HUY"
                            className={`mt-1 min-h-[44px] w-full rounded-xl border border-border-strong bg-surface px-3 text-xs uppercase text-ink ${FOCUS_RING}`}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="lg:border-l lg:border-border lg:pl-5">
                      <BankQrPreview account={acc} coupleHint={coupleHint} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <div className="flex justify-end">
            <Button type="submit" size="lg" disabled={saving} className="min-h-[44px] motion-reduce:transition-none">
              <Save className="h-4 w-4" aria-hidden="true" />
              {saving ? "Đang lưu hồ sơ..." : form.id ? "Cập nhật Hồ sơ cưới" : "Lưu Hồ sơ cưới mới"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
