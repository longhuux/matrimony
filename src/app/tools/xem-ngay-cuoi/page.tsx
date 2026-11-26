"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Clock,
  Heart,
  Sparkles,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { isoDateToLunar, type LunarDateInfo } from "@/modules/invitation-engine/lunar";

const FOCUS_RING_CLASS =
  "focus-visible:outline-2 focus-visible:outline-burgundy focus-visible:outline-offset-2";

const WEEKDAY_NAMES = [
  "Chủ Nhật",
  "Thứ Hai",
  "Thứ Ba",
  "Thứ Tư",
  "Thứ Năm",
  "Thứ Sáu",
  "Thứ Bảy",
] as const;

const CALENDAR_HEADERS = [
  "Thứ 2",
  "Thứ 3",
  "Thứ 4",
  "Thứ 5",
  "Thứ 6",
  "Thứ 7",
  "Chủ Nhật",
] as const;

const YEARS = [2025, 2026, 2027, 2028, 2029, 2030] as const;
const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

const HOANG_DAO_BY_CHI_PAIR: Record<
  string,
  readonly { chi: string; range: string }[]
> = {
  "Tý-Ngọ": [
    { chi: "Tý", range: "23:00 – 01:00" },
    { chi: "Sửu", range: "01:00 – 03:00" },
    { chi: "Mão", range: "05:00 – 07:00" },
    { chi: "Ngọ", range: "11:00 – 13:00" },
    { chi: "Thân", range: "15:00 – 17:00" },
    { chi: "Dậu", range: "17:00 – 19:00" },
  ],
  "Sửu-Mùi": [
    { chi: "Dần", range: "03:00 – 05:00" },
    { chi: "Mão", range: "05:00 – 07:00" },
    { chi: "Tỵ", range: "09:00 – 11:00" },
    { chi: "Thân", range: "15:00 – 17:00" },
    { chi: "Tuất", range: "19:00 – 21:00" },
    { chi: "Hợi", range: "21:00 – 23:00" },
  ],
  "Dần-Thân": [
    { chi: "Tý", range: "23:00 – 01:00" },
    { chi: "Sửu", range: "01:00 – 03:00" },
    { chi: "Thìn", range: "07:00 – 09:00" },
    { chi: "Tỵ", range: "09:00 – 11:00" },
    { chi: "Mùi", range: "13:00 – 15:00" },
    { chi: "Tuất", range: "19:00 – 21:00" },
  ],
  "Mão-Dậu": [
    { chi: "Tý", range: "23:00 – 01:00" },
    { chi: "Dần", range: "03:00 – 05:00" },
    { chi: "Mão", range: "05:00 – 07:00" },
    { chi: "Ngọ", range: "11:00 – 13:00" },
    { chi: "Mùi", range: "13:00 – 15:00" },
    { chi: "Dậu", range: "17:00 – 19:00" },
  ],
  "Thìn-Tuất": [
    { chi: "Dần", range: "03:00 – 05:00" },
    { chi: "Thìn", range: "07:00 – 09:00" },
    { chi: "Tỵ", range: "09:00 – 11:00" },
    { chi: "Thân", range: "15:00 – 17:00" },
    { chi: "Dậu", range: "17:00 – 19:00" },
    { chi: "Hợi", range: "21:00 – 23:00" },
  ],
  "Tỵ-Hợi": [
    { chi: "Sửu", range: "01:00 – 03:00" },
    { chi: "Thìn", range: "07:00 – 09:00" },
    { chi: "Ngọ", range: "11:00 – 13:00" },
    { chi: "Mùi", range: "13:00 – 15:00" },
    { chi: "Tuất", range: "19:00 – 21:00" },
    { chi: "Hợi", range: "21:00 – 23:00" },
  ],
};

function getHoangDaoHours(canChiDay: string): readonly { chi: string; range: string }[] {
  const chi = canChiDay.split(" ")[1] ?? "Tý";
  for (const [pair, hours] of Object.entries(HOANG_DAO_BY_CHI_PAIR)) {
    if (pair.split("-").includes(chi)) {
      return hours;
    }
  }
  return HOANG_DAO_BY_CHI_PAIR["Tý-Ngọ"];
}

function getGuestConvenienceNote(isoDate: string, lunar: LunarDateInfo): {
  label: string;
  detail: string;
  isPreferred: boolean;
} {
  const [y, m, d] = isoDate.split("-").map(Number);
  const utcDate = new Date(Date.UTC(y, m - 1, d));
  const weekday = utcDate.getUTCDay();
  const solarKey = `${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  if (lunar.month === 1 && !lunar.isLeap && lunar.day >= 1 && lunar.day <= 3) {
    return {
      label: "Dịp Tết Nguyên Đán",
      detail: "Trùng kỳ nghỉ Tết truyền thống, khách mời thường bận thăm hỏi gia đình.",
      isPreferred: false,
    };
  }
  if (lunar.month === 3 && !lunar.isLeap && lunar.day === 10) {
    return {
      label: "Ngày nghỉ Lễ Giỗ Tổ Hùng Vương",
      detail: "Ngày nghỉ lễ toàn quốc, thuận tiện cho khách ở xa sắp xếp thời gian.",
      isPreferred: true,
    };
  }
  if (solarKey === "01-01" || solarKey === "04-30" || solarKey === "05-01" || solarKey === "09-02") {
    return {
      label: "Ngày nghỉ Lễ Dương lịch",
      detail: "Trùng kỳ nghỉ lễ, nên gửi thiệp sớm để khách chủ động lịch trình.",
      isPreferred: true,
    };
  }
  if (weekday === 0 || weekday === 6) {
    return {
      label: "Cuối tuần, rất thuận tiện cho khách mời",
      detail: `${WEEKDAY_NAMES[weekday]} giúp phần lớn bạn bè và đồng nghiệp dễ sắp xếp tham dự đủ cả tiệc.`,
      isPreferred: true,
    };
  }
  return {
    label: "Ngày trong tuần",
    detail: "Nên tổ chức tiệc buổi tối (sau 18:00) hoặc lễ gia tiên gọn nhẹ trong gia đình.",
    isPreferred: false,
  };
}

function toIsoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function getMonthDaysCount(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export default function XemNgayCuoiPage(): React.ReactElement {
  const [activeTab, setActiveTab] = React.useState<"single" | "calendar">("single");
  const [selectedIsoDate, setSelectedIsoDate] = React.useState<string>("2026-11-28");
  const [calYear, setCalYear] = React.useState<number>(2026);
  const [calMonth, setCalMonth] = React.useState<number>(11);

  const singleTabRef = React.useRef<HTMLButtonElement | null>(null);
  const calendarTabRef = React.useRef<HTMLButtonElement | null>(null);

  const selectedLunar = React.useMemo(() => isoDateToLunar(selectedIsoDate), [selectedIsoDate]);

  const selectedMeta = React.useMemo(() => {
    if (!selectedLunar) return null;
    const [y, m, d] = selectedIsoDate.split("-").map(Number);
    const utcDate = new Date(Date.UTC(y, m - 1, d));
    const weekday = WEEKDAY_NAMES[utcDate.getUTCDay()];
    const hours = getHoangDaoHours(selectedLunar.canChiDay);
    const convenience = getGuestConvenienceNote(selectedIsoDate, selectedLunar);
    return { y, m, d, weekday, hours, convenience };
  }, [selectedIsoDate, selectedLunar]);

  const calendarCells = React.useMemo(() => {
    const daysCount = getMonthDaysCount(calYear, calMonth);
    const firstUtcDay = new Date(Date.UTC(calYear, calMonth - 1, 1)).getUTCDay();
    // Monday-first index: Mon=0..Sun=6
    const leadingBlanks = (firstUtcDay + 6) % 7;

    const cells: Array<
      | { kind: "empty"; key: string }
      | {
          kind: "day";
          key: string;
          iso: string;
          solarDay: number;
          isWeekend: boolean;
          lunar: LunarDateInfo;
        }
    > = [];

    for (let i = 0; i < leadingBlanks; i += 1) {
      cells.push({ kind: "empty", key: `blank-${i}` });
    }

    for (let day = 1; day <= daysCount; day += 1) {
      const iso = toIsoDate(calYear, calMonth, day);
      const lunar = isoDateToLunar(iso);
      const utcDay = new Date(Date.UTC(calYear, calMonth - 1, day)).getUTCDay();
      if (lunar) {
        cells.push({
          kind: "day",
          key: iso,
          iso,
          solarDay: day,
          isWeekend: utcDay === 0 || utcDay === 6,
          lunar,
        });
      }
    }
    return cells;
  }, [calYear, calMonth]);

  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>): void => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    if (activeTab === "single") {
      setActiveTab("calendar");
      calendarTabRef.current?.focus();
    } else {
      setActiveTab("single");
      singleTabRef.current?.focus();
    }
  };

  return (
    <div className="min-h-dvh bg-ivory text-ink">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:inline-flex focus:min-h-[44px] focus:items-center focus:rounded-full focus:bg-burgundy focus:px-5 focus:text-sm focus:font-semibold focus:text-ivory"
      >
        Chuyển thẳng tới nội dung chính
      </a>

      <header className="sticky top-0 z-30 h-[72px] border-b border-border bg-ivory/95 backdrop-blur-md">
        <div className="mx-auto flex h-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link
            href="/"
            className={`flex min-w-0 shrink-0 items-center gap-2 rounded-full py-1 sm:gap-2.5 ${FOCUS_RING_CLASS}`}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-burgundy text-ivory">
              <Heart className="h-4 w-4 fill-current" aria-hidden="true" />
            </span>
            <span className="font-serif text-lg font-bold tracking-tight text-ink sm:text-xl">
              Matrimony
            </span>
          </Link>

          <nav
            aria-label="Công cụ cưới hỏi"
            className="hidden items-center gap-6 text-sm font-medium text-ink-secondary md:flex"
          >
            <Link
              href="/tools/nen-anh"
              className={`inline-flex min-h-[44px] items-center rounded-md px-1.5 transition-colors duration-200 motion-reduce:transition-none hover:text-burgundy ${FOCUS_RING_CLASS}`}
            >
              Nén ảnh cưới
            </Link>
            <Link
              href="/tools/tao-qr-mung-cuoi"
              className={`inline-flex min-h-[44px] items-center rounded-md px-1.5 transition-colors duration-200 motion-reduce:transition-none hover:text-burgundy ${FOCUS_RING_CLASS}`}
            >
              Tạo QR bàn tiệc
            </Link>
            <Link
              href="/tools/xem-ngay-cuoi"
              aria-current="page"
              className={`inline-flex min-h-[44px] items-center rounded-md px-1.5 font-semibold text-burgundy transition-colors duration-200 motion-reduce:transition-none ${FOCUS_RING_CLASS}`}
            >
              Xem ngày cưới
            </Link>
          </nav>

          <Link
            href="/login"
            className={`inline-flex h-11 shrink-0 items-center whitespace-nowrap rounded-full bg-burgundy px-4 text-xs font-semibold text-ivory transition-colors duration-200 motion-reduce:transition-none hover:bg-burgundy-dark sm:px-5 sm:text-sm ${FOCUS_RING_CLASS}`}
          >
            Tạo thiệp miễn phí
          </Link>
        </div>
      </header>

      <main
        id="main-content"
        className="mx-auto max-w-6xl px-4 py-10 pb-[calc(3rem+env(safe-area-inset-bottom))] sm:px-6 sm:py-12 sm:pb-[calc(4rem+env(safe-area-inset-bottom))]"
      >
        <div className="mb-8">
          <Link
            href="/"
            className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-full pr-2 text-sm font-medium text-ink-muted transition-colors duration-200 motion-reduce:transition-none hover:text-burgundy ${FOCUS_RING_CLASS}`}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>Về trang chủ</span>
          </Link>
          <h1 className="mt-2 min-w-0 break-words font-serif text-3xl font-bold tracking-[-0.02em] text-ink sm:text-4xl">
            Tra cứu Ngày cưới &amp; Lịch Âm Can Chi
          </h1>
          <p className="mt-2 max-w-2xl text-base leading-relaxed text-ink-secondary">
            Quy đổi chuẩn xác theo múi giờ Việt Nam (UTC+7), nhận diện tháng nhuận, Can Chi và khung giờ Hoàng Đạo tham khảo cho lễ ăn hỏi, thành hôn.
          </p>
        </div>

        {/* Mode Tabs */}
        <div
          className="mb-7 inline-flex rounded-full border border-border bg-blush p-1"
          role="tablist"
          aria-label="Chế độ xem ngày cưới"
        >
          <button
            ref={singleTabRef}
            id="tab-single"
            type="button"
            role="tab"
            aria-selected={activeTab === "single"}
            aria-controls="panel-single"
            tabIndex={activeTab === "single" ? 0 : -1}
            onClick={() => setActiveTab("single")}
            onKeyDown={handleTabKeyDown}
            className={`h-11 min-h-[44px] cursor-pointer rounded-full px-5 text-sm font-semibold transition-colors duration-200 motion-reduce:transition-none ${FOCUS_RING_CLASS} ${
              activeTab === "single"
                ? "bg-burgundy text-ivory"
                : "text-ink-secondary hover:text-ink"
            }`}
          >
            Tra cứu ngày cụ thể
          </button>
          <button
            ref={calendarTabRef}
            id="tab-calendar"
            type="button"
            role="tab"
            aria-selected={activeTab === "calendar"}
            aria-controls="panel-calendar"
            tabIndex={activeTab === "calendar" ? 0 : -1}
            onClick={() => setActiveTab("calendar")}
            onKeyDown={handleTabKeyDown}
            className={`h-11 min-h-[44px] cursor-pointer rounded-full px-5 text-sm font-semibold transition-colors duration-200 motion-reduce:transition-none ${FOCUS_RING_CLASS} ${
              activeTab === "calendar"
                ? "bg-burgundy text-ivory"
                : "text-ink-secondary hover:text-ink"
            }`}
          >
            Lịch tháng Cưới Hỏi
          </button>
        </div>

        {activeTab === "single" ? (
          <div
            id="panel-single"
            role="tabpanel"
            aria-labelledby="tab-single"
            className="grid gap-6 lg:grid-cols-12"
          >
            {/* Single-layer summary card with hairline dividers */}
            <Card className="h-fit p-6 lg:col-span-5">
              <label htmlFor="solar-date-input" className="block text-sm font-semibold text-ink">
                Chọn ngày Dương lịch dự kiến
              </label>
              <input
                id="solar-date-input"
                type="date"
                value={selectedIsoDate}
                onChange={(e) => setSelectedIsoDate(e.target.value)}
                className={`mt-2 h-11 w-full rounded-xl border border-border-strong bg-ivory px-3.5 text-sm tabular-nums text-ink transition-colors duration-200 motion-reduce:transition-none focus:border-burgundy ${FOCUS_RING_CLASS}`}
              />

              {selectedMeta && selectedLunar ? (
                <div className="mt-6">
                  <div className="border-t border-border pt-5">
                    <p className="text-xs font-semibold text-ink-muted">Dương lịch</p>
                    <p className="mt-1 font-serif text-xl font-bold tabular-nums text-ink">
                      {selectedMeta.weekday}, ngày {selectedMeta.d}/{selectedMeta.m}/{selectedMeta.y}
                    </p>
                  </div>

                  <div className="mt-5 border-t border-border pt-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-ink-muted">Âm lịch Việt Nam</p>
                      <span className="rounded-full border border-border bg-amber-surface px-2.5 py-0.5 text-xs font-semibold text-amber-text">
                        {selectedLunar.isLeap ? "Tháng nhuận" : "Tháng thường"}
                      </span>
                    </div>
                    <p className="mt-1.5 font-serif text-xl font-bold tabular-nums text-burgundy">
                      {selectedLunar.formatted}
                    </p>
                    <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-border pt-3.5 text-xs">
                      <div>
                        <dt className="text-ink-muted">Năm</dt>
                        <dd className="mt-0.5 font-semibold text-ink">
                          {selectedLunar.canChiYear}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-ink-muted">Tháng</dt>
                        <dd className="mt-0.5 font-semibold text-ink">
                          {selectedLunar.canChiMonth}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-ink-muted">Ngày</dt>
                        <dd className="mt-0.5 font-semibold text-ink">
                          {selectedLunar.canChiDay}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  <div className="mt-6 border-t border-border pt-5">
                    <Link
                      href="/login"
                      className={`inline-flex h-11 min-h-[44px] w-full items-center justify-center gap-2 rounded-full bg-burgundy px-6 text-sm font-semibold text-ivory transition-colors duration-200 motion-reduce:transition-none hover:bg-burgundy-dark ${FOCUS_RING_CLASS}`}
                    >
                      <span>Tạo thiệp cho ngày này</span>
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  </div>
                </div>
              ) : (
                <p
                  role="alert"
                  className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800"
                >
                  Vui lòng chọn ngày Dương lịch hợp lệ.
                </p>
              )}
            </Card>

            <div className="space-y-6 lg:col-span-7">
              {selectedMeta && selectedLunar ? (
                <>
                  <Card className="p-6">
                    <div className="flex items-start gap-3.5">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blush text-burgundy">
                        <CalendarDays className="h-5 w-5" aria-hidden="true" />
                      </div>
                      <div>
                        <span
                          className={`inline-block rounded-full border px-3 py-0.5 text-xs font-semibold ${
                            selectedMeta.convenience.isPreferred
                              ? "border-border bg-amber-surface text-amber-text"
                              : "border-border bg-blush text-ink-secondary"
                          }`}
                        >
                          Độ thuận tiện cho khách mời
                        </span>
                        <h2 className="mt-2 font-serif text-xl font-bold text-ink">
                          {selectedMeta.convenience.label}
                        </h2>
                        <p className="mt-1.5 text-sm leading-relaxed text-ink-secondary">
                          {selectedMeta.convenience.detail}
                        </p>
                      </div>
                    </div>
                  </Card>

                  <Card className="p-6">
                    <div className="flex items-center gap-2.5">
                      <Clock className="h-5 w-5 shrink-0 text-burgundy" aria-hidden="true" />
                      <h2 className="font-serif text-xl font-bold text-ink">
                        Khung giờ Hoàng Đạo tham khảo (Ngày {selectedLunar.canChiDay})
                      </h2>
                    </div>
                    <p className="mt-1.5 text-sm text-ink-muted">
                      Gợi ý khung giờ đẹp truyền thống để làm lễ rước dâu, dâng hương gia tiên hoặc đón khách.
                    </p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      {selectedMeta.hours.map((slot) => (
                        <div
                          key={slot.chi}
                          className="rounded-xl bg-blush/60 px-4 py-3"
                        >
                          <p className="text-xs font-semibold text-burgundy">Giờ {slot.chi}</p>
                          <p className="mt-1 text-sm font-bold tabular-nums text-ink">
                            {slot.range}
                          </p>
                        </div>
                      ))}
                    </div>
                  </Card>
                </>
              ) : null}
            </div>
          </div>
        ) : (
          <Card
            id="panel-calendar"
            role="tabpanel"
            aria-labelledby="tab-calendar"
            className="p-5 sm:p-6"
          >
            <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <div>
                  <label htmlFor="cal-month-select" className="sr-only">
                    Chọn tháng
                  </label>
                  <select
                    id="cal-month-select"
                    value={calMonth}
                    onChange={(e) => setCalMonth(Number(e.target.value))}
                    className={`h-11 rounded-xl border border-border-strong bg-ivory px-3.5 text-sm font-semibold tabular-nums text-ink transition-colors duration-200 motion-reduce:transition-none focus:border-burgundy ${FOCUS_RING_CLASS}`}
                  >
                    {MONTHS.map((m) => (
                      <option key={m} value={m}>
                        Tháng {m}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="cal-year-select" className="sr-only">
                    Chọn năm
                  </label>
                  <select
                    id="cal-year-select"
                    value={calYear}
                    onChange={(e) => setCalYear(Number(e.target.value))}
                    className={`h-11 rounded-xl border border-border-strong bg-ivory px-3.5 text-sm font-semibold tabular-nums text-ink transition-colors duration-200 motion-reduce:transition-none focus:border-burgundy ${FOCUS_RING_CLASS}`}
                  >
                    {YEARS.map((y) => (
                      <option key={y} value={y}>
                        Năm {y}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs text-ink-muted">
                <span className="inline-flex items-center gap-1.5">
                  <span
                    aria-hidden="true"
                    className="h-3 w-3 rounded-full bg-amber-surface ring-1 ring-gold"
                  />
                  <span>Cuối tuần thuận tiện</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-burgundy" aria-hidden="true" />
                  <span>Mùng 1 &amp; Rằm (15) Âm lịch</span>
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <div className="min-w-[640px]">
                <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold text-ink-secondary">
                  {CALENDAR_HEADERS.map((hdr) => (
                    <div key={hdr} className="py-2">
                      {hdr}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-2">
                  {calendarCells.map((cell) => {
                    if (cell.kind === "empty") {
                      return (
                        <div
                          key={cell.key}
                          className="min-h-[82px] rounded-xl bg-blush/30"
                        />
                      );
                    }

                    const isSelected = cell.iso === selectedIsoDate;
                    const isLunarMarker = cell.lunar.day === 1 || cell.lunar.day === 15;
                    const lunarLabel = `${cell.lunar.day}/${cell.lunar.month}${
                      cell.lunar.isLeap ? " N" : ""
                    }`;

                    return (
                      <button
                        key={cell.key}
                        type="button"
                        onClick={() => {
                          setSelectedIsoDate(cell.iso);
                          setActiveTab("single");
                        }}
                        className={`flex min-h-[82px] cursor-pointer flex-col justify-between rounded-xl border p-2.5 text-left transition-colors duration-200 motion-reduce:transition-none ${FOCUS_RING_CLASS} ${
                          isSelected
                            ? "border-burgundy bg-blush"
                            : cell.isWeekend
                              ? "border-border bg-amber-surface/75 hover:bg-amber-surface"
                              : "border-border bg-ivory hover:bg-blush-hover"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-1">
                          <span
                            className={`text-sm font-bold tabular-nums ${
                              cell.isWeekend ? "text-burgundy" : "text-ink"
                            }`}
                          >
                            {cell.solarDay}
                          </span>
                          {isLunarMarker ? (
                            <Sparkles
                              className="h-3.5 w-3.5 shrink-0 text-burgundy"
                              aria-hidden="true"
                            />
                          ) : null}
                        </div>

                        <div>
                          <p
                            className={`text-xs font-semibold tabular-nums ${
                              isLunarMarker ? "text-burgundy" : "text-ink-muted"
                            }`}
                          >
                            {lunarLabel}
                          </p>
                          <p className="truncate text-xs text-ink-muted">
                            {cell.lunar.canChiDay}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </Card>
        )}
      </main>
    </div>
  );
}
