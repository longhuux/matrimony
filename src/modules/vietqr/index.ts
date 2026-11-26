export interface BankInfo {
  bin: string;
  shortName: string;
  name: string;
}

export const VIETNAM_BANKS: readonly BankInfo[] = [
  { bin: "970436", shortName: "VCB", name: "Vietcombank" },
  { bin: "970407", shortName: "TCB", name: "Techcombank" },
  { bin: "970422", shortName: "MB", name: "MB Bank" },
  { bin: "970418", shortName: "BIDV", name: "BIDV" },
  { bin: "970415", shortName: "CTG", name: "VietinBank" },
  { bin: "970416", shortName: "ACB", name: "ACB" },
  { bin: "970432", shortName: "VPB", name: "VPBank" },
  { bin: "970423", shortName: "TPB", name: "TPBank" },
  { bin: "970403", shortName: "STB", name: "Sacombank" },
  { bin: "970405", shortName: "AGR", name: "Agribank" },
  { bin: "970441", shortName: "VIB", name: "VIB" },
  { bin: "970437", shortName: "HDB", name: "HDBank" },
  { bin: "970448", shortName: "OCB", name: "OCB" },
  { bin: "970426", shortName: "MSB", name: "MSB" },
] as const;

/** Encodes an EMVCo Tag-Length-Value field, enforcing the 99-byte length cap. */
export function tlv(tag: string, value: string): string {
  const byteLen = Buffer.byteLength(value, "utf8");
  if (byteLen > 99) {
    throw new Error(`TLV field ${tag} exceeds 99 bytes`);
  }
  const len = byteLen.toString().padStart(2, "0");
  return `${tag}${len}${value}`;
}

/**
 * Computes EMVCo / Napas CRC-16/CCITT-FALSE checksum (poly 0x1021, init 0xFFFF).
 */
export function crc16CcittFalse(payload: string): string {
  let crc = 0xffff;
  const bytes = Buffer.from(payload, "utf8");
  for (const byte of bytes) {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 0x8000) !== 0 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function sanitizeDescription(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^a-zA-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 50);
}

export interface BuildVietQrInput {
  bankBin: string;
  accountNumber: string;
  amount?: number;
  description?: string;
}

/**
 * Builds an EMVCo-compliant Napas VietQR payload string for direct P2P bank transfers (0% fee).
 */
export function buildVietQrPayload(input: BuildVietQrInput): string {
  const bankBin = input.bankBin.trim();
  const accountNumber = input.accountNumber.trim();
  if (!/^\d{6}$/.test(bankBin)) {
    throw new Error("bankBin must be a 6-digit Napas bank BIN");
  }
  if (!/^[a-zA-Z0-9]{4,30}$/.test(accountNumber)) {
    throw new Error("accountNumber must be 4-30 alphanumeric characters");
  }

  let hasAmount = false;
  if (input.amount !== undefined) {
    if (
      typeof input.amount !== "number" ||
      !Number.isFinite(input.amount) ||
      !Number.isInteger(input.amount) ||
      input.amount <= 0 ||
      input.amount > 999_999_999_999
    ) {
      throw new Error("amount must be a positive integer <= 999999999999 VND");
    }
    hasAmount = true;
  }

  const beneficiary = tlv("00", bankBin) + tlv("01", accountNumber);
  const consumerInfo =
    tlv("00", "A000000727") +
    tlv("01", beneficiary) +
    tlv("02", "QRIBFTTA");

  let body = "";
  body += tlv("00", "01");
  body += tlv("01", hasAmount ? "12" : "11");
  body += tlv("38", consumerInfo);
  body += tlv("53", "704");
  if (hasAmount) {
    body += tlv("54", input.amount!.toString());
  }
  body += tlv("58", "VN");

  const cleanDesc = input.description ? sanitizeDescription(input.description) : "";
  if (cleanDesc.length > 0) {
    body += tlv("62", tlv("08", cleanDesc));
  }

  const payloadWithoutCrc = `${body}6304`;
  return `${payloadWithoutCrc}${crc16CcittFalse(payloadWithoutCrc)}`;
}
