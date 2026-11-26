import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merges Tailwind class names cleanly without conflicting utilities. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Formats an integer amount in Vietnamese Dong (e.g., 149.000đ). */
export function formatVnd(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return "0đ";
  return `${new Intl.NumberFormat("vi-VN").format(amount)}đ`;
}

/** Converts Vietnamese or Unicode text into a safe URL slug. */
export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 60)
    .replace(/^-+|-+$/g, "");
}
