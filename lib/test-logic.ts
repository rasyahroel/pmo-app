import type { TestStatus } from "@/lib/mock-data";
import type { TestTypeDef } from "@/lib/master-store";

// Aturan pengujian — fungsi murni (mudah dites; backend harus mengulang aturan yang sama).
//
// Sumber aturan = Master Data › Jenis Testing (urutan + dua saklar):
//  • "Wajib menunggu testing sebelumnya" → jenis ini baru boleh dimulai (On Going/Passed/Failed)
//    setelah jenis PENGANTAR-nya berstatus Passed di fase yang sama. Pengantar = jenis terdekat di
//    atasnya (dalam urutan master) yang TIDAK boleh paralel (mis. UAT & TO menunggu SIT; SIT menunggu IUT).
//  • "Boleh berjalan paralel" → dua pengujian hanya boleh berstatus On Going bersamaan bila KEDUANYA boleh paralel.
// Satu fase hanya punya satu catatan per jenis testing.

export type TestRecord = {
  id: string;
  projectId: string;
  phaseId: string;
  type: string;
  status: TestStatus;
  progressPercent: number;
  pic: string;
  startDate?: string;
  endDate?: string;
  notes?: string;
};

export const TEST_STATUSES: TestStatus[] = ["Not Started", "On Going", "Passed", "Failed"];

/** jenis pengantar (gate) sebuah jenis testing, atau null kalau tidak perlu menunggu */
export function gateOf(types: TestTypeDef[], type: string): string | null {
  const i = types.findIndex((t) => t.type === type);
  if (i < 0 || !types[i].requiresPrevious) return null;
  for (let k = i - 1; k >= 0; k--) if (!types[k].allowParallel) return types[k].type;
  return null;
}

/** progress yang konsisten dengan status: Not Started=0, Passed=100, On Going maksimal 99 */
export function normalizeProgress(status: TestStatus, progress: number): number {
  const n = Math.max(0, Math.min(100, Math.round(Number.isFinite(progress) ? progress : 0)));
  if (status === "Not Started") return 0;
  if (status === "Passed") return 100;
  if (status === "On Going") return Math.min(n, 99);
  return n;
}

type Candidate = { id?: string; phaseId: string; type: string; status: TestStatus; startDate?: string; endDate?: string };

/** alasan penolakan, atau null bila boleh disimpan */
export function validateTest(records: TestRecord[], types: TestTypeDef[], c: Candidate): string | null {
  const inPhase = records.filter((r) => r.phaseId === c.phaseId && r.id !== c.id);

  if (inPhase.some((r) => r.type === c.type)) return `${c.type} sudah ada di fase ini — ubah datanya saja, jangan buat dobel.`;
  if (c.startDate && c.endDate && c.endDate < c.startDate) return "Tanggal selesai tidak boleh sebelum tanggal mulai.";

  if (c.status !== "Not Started") {
    const gate = gateOf(types, c.type);
    if (gate) {
      const g = inPhase.find((r) => r.type === gate);
      if (!g) return `${c.type} baru bisa dimulai setelah ${gate} Passed, sedangkan ${gate} belum ada di fase ini.`;
      if (g.status !== "Passed") return `${c.type} baru bisa dimulai setelah ${gate} Passed (sekarang ${gate}: ${g.status}).`;
    }
  }

  if (c.status === "On Going") {
    const me = types.find((t) => t.type === c.type);
    for (const o of inPhase) {
      if (o.status !== "On Going") continue;
      const other = types.find((t) => t.type === o.type);
      if (!(me?.allowParallel && other?.allowParallel)) return `${c.type} tidak boleh berjalan bersamaan dengan ${o.type} (sedang On Going).`;
    }
  }
  return null;
}

/** pengujian lain yang bergantung pada `type` dan sudah dimulai */
export function startedDependents(records: TestRecord[], types: TestTypeDef[], phaseId: string, type: string): TestRecord[] {
  return records.filter((r) => r.phaseId === phaseId && r.type !== type && gateOf(types, r.type) === type && r.status !== "Not Started");
}

/** menghapus/menurunkan statusnya dari Passed akan merusak urutan? */
export function breaksDependents(records: TestRecord[], types: TestTypeDef[], phaseId: string, type: string, nextStatus: TestStatus | "deleted"): string | null {
  if (nextStatus === "Passed") return null;
  const deps = startedDependents(records, types, phaseId, type);
  if (deps.length === 0) return null;
  return `${deps.map((d) => d.type).join(", ")} sudah berjalan dan bergantung pada ${type}. Ubah/hapus ${deps.map((d) => d.type).join(", ")} dulu.`;
}

/** apakah sebuah jenis sedang tertahan (belum boleh dimulai) di fase tertentu — untuk penanda di tampilan */
export function blockedBy(records: TestRecord[], types: TestTypeDef[], phaseId: string, type: string): string | null {
  const gate = gateOf(types, type);
  if (!gate) return null;
  const g = records.find((r) => r.phaseId === phaseId && r.type === gate);
  return g && g.status === "Passed" ? null : gate;
}
