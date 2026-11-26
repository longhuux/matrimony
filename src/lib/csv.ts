const FORMULA_PREFIX_RE = /^[=+\-@\t\r]/;
const CONTROL_CHARS_RE = /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g;
const MAX_GUEST_CSV_ROWS = 500;

export interface ParsedGuestCsvRow {
  fullName: string;
  salutation: string;
  groupName: string;
  guestSide: "groom" | "bride" | "both";
  greeting: string;
}

/**
 * Escapes a single CSV cell and neutralizes spreadsheet formula injection (CWE-1236).
 */
export function escapeCsvCell(value: unknown): string {
  let str = value === null || value === undefined ? "" : String(value);
  if (FORMULA_PREFIX_RE.test(str) || FORMULA_PREFIX_RE.test(str.trimStart())) {
    str = `'${str}`;
  }
  return `"${str.replace(/"/g, '""')}"`;
}

/**
 * Formats headers and rows into a UTF-8 BOM CSV string safe for Excel on Windows/macOS.
 */
export function toCsvWithBom(headers: string[], rows: unknown[][]): string {
  const lines = [
    headers.map((h) => escapeCsvCell(h)).join(","),
    ...rows.map((row) => row.map((cell) => escapeCsvCell(cell)).join(",")),
  ];
  return `\uFEFF${lines.join("\r\n")}`;
}

function normalizeHeaderKey(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function detectDelimiter(sampleLine: string): "," | ";" | "\t" {
  const counts: Record<"," | ";" | "\t", number> = {
    ",": 0,
    ";": 0,
    "\t": 0,
  };
  let inQuotes = false;

  for (let i = 0; i < sampleLine.length; i += 1) {
    const ch = sampleLine[i];
    if (ch === '"') {
      if (inQuotes && sampleLine[i + 1] === '"') {
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (!inQuotes && (ch === "," || ch === ";" || ch === "\t")) {
      counts[ch] += 1;
    }
  }

  if (counts["\t"] > counts[","] && counts["\t"] >= counts[";"]) return "\t";
  if (counts[";"] > counts[","]) return ";";
  return ",";
}

function splitCsvRecords(input: string): string[] {
  const records: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    if (ch === '"') {
      if (inQuotes && input[i + 1] === '"') {
        current += '""';
        i += 1;
      } else {
        inQuotes = !inQuotes;
        current += ch;
      }
      continue;
    }
    if (!inQuotes && (ch === "\r" || ch === "\n")) {
      if (ch === "\r" && input[i + 1] === "\n") {
        i += 1;
      }
      if (current.trim().length > 0) {
        records.push(current);
      }
      current = "";
      continue;
    }
    current += ch;
  }

  if (current.trim().length > 0) {
    records.push(current);
  }
  return records;
}

function parseCsvLine(line: string, delimiter: "," | ";" | "\t"): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (!inQuotes && ch === delimiter) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  cells.push(current.trim());
  return cells;
}

function cleanText(val: string | undefined, maxLen: number): string {
  if (!val) return "";
  return val.replace(CONTROL_CHARS_RE, " ").trim().slice(0, maxLen);
}

function normalizeGuestSide(raw: string | undefined): "groom" | "bride" | "both" {
  const norm = normalizeHeaderKey(raw ?? "");
  if (
    norm === "bride" ||
    norm === "nha gai" ||
    norm === "co dau" ||
    norm === "gai" ||
    norm === "ben gai"
  ) {
    return "bride";
  }
  if (
    norm === "both" ||
    norm === "ca hai" ||
    norm === "chung" ||
    norm === "2 ben" ||
    norm === "hai ben"
  ) {
    return "both";
  }
  return "groom";
}

type ColumnRole = "fullName" | "salutation" | "groupName" | "guestSide" | "greeting";

function matchHeaderRole(header: string): ColumnRole | null {
  const norm = normalizeHeaderKey(header);
  if (norm === "fullname" || norm === "full name" || norm === "ho ten" || norm === "ho va ten" || norm === "ten") {
    return "fullName";
  }
  if (norm === "salutation" || norm === "xung ho" || norm === "danh xung") {
    return "salutation";
  }
  if (norm === "groupname" || norm === "group name" || norm === "group" || norm === "nhom") {
    return "groupName";
  }
  if (norm === "guestside" || norm === "guest side" || norm === "side" || norm === "nha" || norm === "ben") {
    return "guestSide";
  }
  if (norm === "greeting" || norm === "loi moi" || norm === "loi chuc") {
    return "greeting";
  }
  return null;
}

/**
 * Parses a guest CSV string (UTF-8 BOM, comma/semicolon/tab, optional header row) capped at 500 rows.
 */
export function parseGuestCsv(raw: string): ParsedGuestCsvRow[] {
  const stripped = raw.replace(/^\uFEFF/, "");
  const lines = splitCsvRecords(stripped);
  if (lines.length === 0) return [];

  const delimiter = detectDelimiter(lines[0]);
  const firstCells = parseCsvLine(lines[0], delimiter);

  const headerMap = new Map<ColumnRole, number>();
  firstCells.forEach((cell, idx) => {
    const role = matchHeaderRole(cell);
    if (role && !headerMap.has(role)) {
      headerMap.set(role, idx);
    }
  });

  const hasHeader = headerMap.size > 0;
  const dataLines = hasHeader ? lines.slice(1) : lines;
  const results: ParsedGuestCsvRow[] = [];

  for (const line of dataLines) {
    if (results.length >= MAX_GUEST_CSV_ROWS) break;
    const cells = parseCsvLine(line, delimiter);

    const getCell = (role: ColumnRole, fallbackIdx: number): string | undefined => {
      if (hasHeader) {
        const idx = headerMap.get(role);
        return idx !== undefined ? cells[idx] : undefined;
      }
      return cells[fallbackIdx];
    };

    const fullName = cleanText(getCell("fullName", 0), 100);
    if (!fullName) continue;

    const salutation = cleanText(getCell("salutation", 1), 40) || "Bạn";
    const groupName = cleanText(getCell("groupName", 2), 50) || "ban-be";
    const guestSide = normalizeGuestSide(getCell("guestSide", 3));
    const greeting = cleanText(getCell("greeting", 4), 300);

    results.push({
      fullName,
      salutation,
      groupName,
      guestSide,
      greeting,
    });
  }

  return results;
}
