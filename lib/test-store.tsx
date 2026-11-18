"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { projects } from "@/lib/mock-data";
import { useAuditStore } from "@/lib/audit-store";
import { useMasterStore } from "@/lib/master-store";
import { useProjectStructure } from "@/lib/project-structure";
import { breaksDependents, normalizeProgress, validateTest, type TestRecord } from "@/lib/test-logic";

// ---------------------------------------------------------------------------
// Store Pengujian — SATU sumber untuk menu Pengujian, kartu fase di detail project, dan Timeline.
// Aturan urutan/paralel dari Master Data › Jenis Testing ditegakkan di sini (lihat test-logic.ts).
//
// Sementara di memori. Padanan backend: GET /test-stages, /phases/{id}/test-stages, /test-stages/{id}.
// ---------------------------------------------------------------------------

export type TestInput = Omit<TestRecord, "id">;
export type TestResult = { ok: true; record: TestRecord } | { ok: false; reason: string };

type TestStore = {
  records: TestRecord[];
  forPhase: (phaseId: string) => TestRecord[];
  addTest: (input: TestInput) => TestResult;
  updateTest: (id: string, patch: Partial<TestInput>) => TestResult;
  deleteTest: (id: string) => { ok: true } | { ok: false; reason: string };
};

const Ctx = createContext<TestStore | null>(null);
let seq = 0;

const SEED: TestRecord[] = projects.flatMap((p) =>
  p.phases.flatMap((ph) =>
    ph.testStages.map((t) => ({
      id: t.id,
      projectId: p.id,
      phaseId: ph.id,
      type: t.type,
      status: t.status,
      progressPercent: t.progressPercent,
      pic: t.pic,
    })),
  ),
);

export function TestStoreProvider({ children }: { children: ReactNode }) {
  const [records, setRecords] = useState<TestRecord[]>(SEED);
  const ref = useRef(records);
  const { testTypes } = useMasterStore();
  const { addLog } = useAuditStore();
  const { phasesOf } = useProjectStructure();

  const set = useCallback((next: TestRecord[]) => {
    ref.current = next;
    setRecords(next);
  }, []);

  const names = useCallback(
    (r: { projectId: string; phaseId: string }) => ({
      project: projects.find((p) => p.id === r.projectId)?.name ?? "-",
      phase: phasesOf(r.projectId).find((x) => x.id === r.phaseId)?.name ?? "-",
    }),
    [phasesOf],
  );

  const value = useMemo<TestStore>(() => {
    const fail = (reason: string) => ({ ok: false as const, reason });
    return {
      records,
      forPhase: (phaseId) => records.filter((r) => r.phaseId === phaseId),

      addTest: (input) => {
        if (!phasesOf(input.projectId).some((p) => p.id === input.phaseId)) return fail("Fase tidak termasuk project ini.");
        const progressPercent = normalizeProgress(input.status, input.progressPercent);
        const why = validateTest(ref.current, testTypes, { ...input, progressPercent } as TestRecord);
        if (why) return fail(why);
        const record: TestRecord = { ...input, progressPercent, id: `ts-${Date.now().toString(36)}${(seq++).toString(36)}` };
        set([...ref.current, record]);
        const n = names(record);
        addLog({
          projectName: n.project,
          projectId: record.projectId,
          entity: `Pengujian · ${record.type} (${n.phase})`,
          field: "Pengujian",
          oldValue: "—",
          newValue: `Dibuat: ${record.status}, ${record.progressPercent}%, PIC ${record.pic}`,
        });
        return { ok: true, record };
      },

      updateTest: (id, patch) => {
        const cur = ref.current.find((r) => r.id === id);
        if (!cur) return fail("Data pengujian tidak ditemukan.");
        const merged = { ...cur, ...patch };
        if (!phasesOf(merged.projectId).some((p) => p.id === merged.phaseId)) return fail("Fase tidak termasuk project ini.");
        merged.progressPercent = normalizeProgress(merged.status, merged.progressPercent);
        const moved = merged.phaseId !== cur.phaseId || merged.type !== cur.type;
        if (moved) {
          const b = breaksDependents(ref.current, testTypes, cur.phaseId, cur.type, "deleted");
          if (b) return fail(b);
        } else {
          const b = breaksDependents(ref.current, testTypes, cur.phaseId, cur.type, merged.status);
          if (b) return fail(b);
        }
        const why = validateTest(ref.current, testTypes, merged);
        if (why) return fail(why);
        set(ref.current.map((r) => (r.id === id ? merged : r)));
        const n = names(merged);
        const rows: [string, string, string][] = [];
        if (cur.status !== merged.status) rows.push(["Status", cur.status, merged.status]);
        if (cur.progressPercent !== merged.progressPercent) rows.push(["Progress", `${cur.progressPercent}%`, `${merged.progressPercent}%`]);
        if (cur.pic !== merged.pic) rows.push(["PIC", cur.pic, merged.pic]);
        if (cur.startDate !== merged.startDate) rows.push(["Tanggal mulai", cur.startDate ?? "—", merged.startDate ?? "—"]);
        if (cur.endDate !== merged.endDate) rows.push(["Tanggal selesai", cur.endDate ?? "—", merged.endDate ?? "—"]);
        if (cur.type !== merged.type) rows.push(["Jenis testing", cur.type, merged.type]);
        if (cur.phaseId !== merged.phaseId) rows.push(["Fase", names(cur).phase, n.phase]);
        if ((cur.notes ?? "") !== (merged.notes ?? "")) rows.push(["Catatan", cur.notes || "—", merged.notes || "—"]);
        if (rows.length)
          addLog(
            rows.map(([field, oldValue, newValue]) => ({
              projectName: n.project,
              projectId: merged.projectId,
              entity: `Pengujian · ${merged.type} (${n.phase})`,
              field,
              oldValue,
              newValue,
            })),
          );
        return { ok: true, record: merged };
      },

      deleteTest: (id) => {
        const cur = ref.current.find((r) => r.id === id);
        if (!cur) return fail("Data pengujian tidak ditemukan.");
        const b = breaksDependents(ref.current, testTypes, cur.phaseId, cur.type, "deleted");
        if (b) return fail(b);
        set(ref.current.filter((r) => r.id !== id));
        const n = names(cur);
        addLog({ projectName: n.project, projectId: cur.projectId, entity: `Pengujian · ${cur.type} (${n.phase})`, field: "Pengujian", oldValue: cur.status, newValue: "Dihapus" });
        return { ok: true };
      },
    };
  }, [records, testTypes, addLog, phasesOf, names, set]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTestStore(): TestStore {
  const v = useContext(Ctx);
  if (!v) throw new Error("useTestStore harus dipakai di dalam <TestStoreProvider>");
  return v;
}
