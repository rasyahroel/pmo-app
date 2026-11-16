"use client";

import { useSyncExternalStore } from "react";
import dayjs from "dayjs";

// ---------------------------------------------------------------------------
// Warna status: admin cukup memilih SATU warna (hex) di Master Data; warna lembut, tepi, dan
// teks diturunkan dari situ. Dipakai bersama oleh status task dan status rapat.
// ---------------------------------------------------------------------------

export const STATUS_COLOR_PRESETS = ["#7C8798", "#2F80ED", "#17C653", "#F8285A", "#F6B100", "#8B5CF6", "#22A7B8", "#F97316"];

function parseHex(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h.padEnd(6, "0");
  const n = parseInt(full.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mix(hex: string, withHex: string, amount: number): string {
  const a = parseHex(hex);
  const b = parseHex(withHex);
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * amount));
  return `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

export type StatusStyle = { main: string; soft: string; border: string; text: string };

export function deriveStatusStyle(color: string): StatusStyle {
  return {
    main: color,
    soft: mix(color, "#FFFFFF", 0.9),
    border: mix(color, "#FFFFFF", 0.65),
    text: mix(color, "#000000", 0.25),
  };
}

// ---------------------------------------------------------------------------
// Tanggal & jatuh tempo
// ---------------------------------------------------------------------------

export type DueState = "none" | "done" | "overdue" | "soon" | "ok";

export const DUE_COLOR: Record<DueState, string> = {
  none: "#99A1B7",
  done: "#17C653",
  overdue: "#F8285A",
  soon: "#F6B100",
  ok: "#4B5675",
};

/** `today` kosong saat render server -> tidak ada penilaian (menghindari hydration mismatch). */
export function getDueInfo(
  { dueDate, done }: { dueDate?: string; done: boolean },
  today: string,
): { state: DueState; label: string } {
  if (!dueDate) return { state: "none", label: "Tanpa tenggat" };
  const label = formatDate(dueDate);
  if (done) return { state: "done", label };
  if (!today) return { state: "ok", label };
  const diff = dayjs(dueDate).diff(dayjs(today), "day");
  if (diff < 0) return { state: "overdue", label: `${label} · telat ${-diff} hari` };
  if (diff <= 3) return { state: "soon", label: `${label} · ${diff === 0 ? "hari ini" : `${diff} hari lagi`}` };
  return { state: "ok", label };
}

const noopSubscribe = () => () => undefined;
/** Tanggal hari ini (YYYY-MM-DD) di client; "" saat render server. */
export function useToday(): string {
  return useSyncExternalStore(
    noopSubscribe,
    () => dayjs().format("YYYY-MM-DD"),
    () => "",
  );
}

/** Parameter kedua (today) diterima supaya pemanggilan lama tetap jalan; tampilan tidak bergantung padanya. */
export function formatDate(d?: string, _today?: string): string {
  void _today;
  return d ? dayjs(d).format("DD MMM YYYY") : "-";
}

// ---------------------------------------------------------------------------
// Lain-lain
// ---------------------------------------------------------------------------

const PROJECT_COLORS = ["#2F80ED", "#8950FC", "#22A7B8", "#FF7A45", "#17C653", "#F6B100", "#F8285A", "#7C8798"];
export function projectColor(projectId: string): string {
  let h = 0;
  for (const ch of projectId) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PROJECT_COLORS[h % PROJECT_COLORS.length];
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

export function formatBytes(n?: number): string {
  if (!n) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

/** Hanya http(s) yang diterima sebagai link (tolak javascript:, data:, dll). null = tidak valid. */
export function normalizeUrl(raw: string): string | null {
  const text = raw.trim();
  if (!text) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`;
  try {
    const u = new URL(withScheme);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}
