import dayjs from "dayjs";
import type { Phase, PhaseStage, Task } from "@/lib/mock-data";

// Rentang tiap tahap TIDAK diinput manual — diturunkan dari data menu lain:
//  • Dokumen     : tanggal mulai fase → tanggal approval terakhir di dokumen fase (Detail Project › Dokumen)
//                  (dokumen belum semua approved → bar berjalan sampai hari ini)
//  • Development : task kategori Development & Migrasi di fase itu (Task Board)
//  • Testing     : task kategori Testing di fase itu (Task Board)
//  • Live        : target live fase (milestone satu hari)
// Tahap tanpa sumber data tampil kosong ("—"). Kategori di bawah mengacu ke ID master Kategori Task.
export const STAGES: PhaseStage[] = ["Dokumen", "Development", "Testing", "Live"];

export const STAGE_COLOR: Record<PhaseStage, string> = {
  Dokumen: "#94A3C4",
  Development: "#5D74A8",
  Testing: "#C08B2C",
  Live: "#3E8E5A",
};

export const STAGE_TASK_CATEGORIES: Partial<Record<PhaseStage, string[]>> = {
  Development: ["development", "migration"],
  Testing: ["testing"],
};

export type StageRange = { start: string; end: string; source: string };
export type StageSchedule = Partial<Record<PhaseStage, StageRange>>;

const minOf = (a: string[]) => a.reduce((x, y) => (x < y ? x : y));
const maxOf = (a: string[]) => a.reduce((x, y) => (x > y ? x : y));

export function scheduleOf(phase: Phase, tasks: Task[], today: string): StageSchedule {
  const out: StageSchedule = {};

  // Dokumen
  if (phase.documents.length > 0) {
    const approvals = phase.documents.flatMap((d) => d.approvers.map((a) => a.date).filter((x): x is string => !!x));
    const start = approvals.length ? minOf([phase.startDate, ...approvals]) : phase.startDate;
    let end = approvals.length ? maxOf(approvals) : start;
    let source = "tanggal approval dokumen";
    if (phase.documentProgress < 100 && today) {
      end = maxOf([end, today < phase.targetLiveDate ? today : phase.targetLiveDate]);
      source = "dokumen berjalan (sampai hari ini)";
    }
    out.Dokumen = { start, end: end < start ? start : end, source };
  }

  // Development & Testing dari task
  for (const stage of ["Development", "Testing"] as const) {
    const cats = STAGE_TASK_CATEGORIES[stage] ?? [];
    const ts = tasks.filter((t) => t.phaseId === phase.id && cats.includes(t.category));
    if (ts.length > 0) {
      out[stage] = {
        start: minOf(ts.map((t) => t.startDate)),
        end: maxOf(ts.map((t) => t.dueDate)),
        source: `${ts.length} task kategori ${cats.join("/")}`,
      };
    }
  }

  // Live
  out.Live = { start: phase.targetLiveDate, end: phase.targetLiveDate, source: "target live fase" };
  return out;
}

/**
 * Tahap yang memang tidak diperlukan di sebuah fase (bukan data kurang).
 * Contoh: Fase 2 tanpa dokumen baru yang merujuk Fase 1 → langsung development, memakai dokumen fase rujukan.
 * Mengembalikan keterangan, atau null kalau tahap itu berlaku.
 */
export function skipReason(phase: Phase, stage: PhaseStage, siblings: Phase[]): string | null {
  if (stage === "Dokumen" && phase.documents.length === 0 && phase.previousPhaseId) {
    const prev = siblings.find((x) => x.id === phase.previousPhaseId);
    return `Tidak ada dokumen baru — memakai dokumen ${prev?.name ?? "fase sebelumnya"}`;
  }
  return null;
}

/** progress tiap tahap, diambil dari data fase */
export function stageProgress(ph: Phase, stage: PhaseStage): number {
  if (stage === "Dokumen") return ph.documentProgress;
  if (stage === "Development") return ph.developmentProgress;
  if (stage === "Testing") return ph.testingProgress;
  return ph.stage === "Live" ? 100 : 0;
}

/** jumlah hari (inklusif) */
export const daysBetween = (a: string, b: string) => dayjs(b).diff(dayjs(a), "day") + 1;

export type StageState = "done" | "active" | "late" | "upcoming";
/** done = progress 100%; late = lewat tanggal akhir tapi belum 100%; active = hari ini ada di rentang */
export function stageState(range: { start: string; end: string }, progress: number, today: string): StageState {
  if (progress >= 100) return "done";
  if (today > range.end) return "late";
  if (today >= range.start) return "active";
  return "upcoming";
}

export type Parallel = { a: PhaseStage; b: PhaseStage; start: string; end: string; days: number };
/** Tahap yang pengerjaannya tumpang-tindih (paralel). Live (penanda satu hari) tidak dihitung. */
export function parallelOf(sch: StageSchedule): Parallel[] {
  const list = STAGES.filter((s) => s !== "Live" && sch[s]);
  const out: Parallel[] = [];
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const A = sch[list[i]]!;
      const B = sch[list[j]]!;
      const start = A.start > B.start ? A.start : B.start;
      const end = A.end < B.end ? A.end : B.end;
      if (start <= end) out.push({ a: list[i], b: list[j], start, end, days: daysBetween(start, end) });
    }
  }
  return out;
}
