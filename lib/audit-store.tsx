"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import dayjs from "dayjs";
import { auditLogs as seedLogs, projects, type AuditLog, type Task } from "@/lib/mock-data";
import { useCurrentUser } from "@/lib/acting-user";

// ---------------------------------------------------------------------------
// Store Riwayat Perubahan — SATU sumber untuk menu "Riwayat Perubahan" dan tab "Riwayat"
// di detail project. Aktivitas task (buat/ubah/pindah status/hapus/review/komentar) dicatat
// otomatis dari task-store & comment-store, jadi tidak perlu dipanggil manual di tiap layar.
//
// Sementara di memori; waktu backend jadi, sebaiknya pencatatan dilakukan di server
// (satu transaksi dengan perubahannya), bukan dari FE.
// ---------------------------------------------------------------------------

// projectId & taskId dipakai untuk membatasi siapa yang boleh melihat entri (lihat audit-permissions.ts).
// Entri lama dari data contoh tidak punya projectId; project-nya dicari lewat projectName.
export type AuditEntry = AuditLog & { taskId?: string; projectId?: string };

export type NewAuditEntry = {
  projectName: string;
  entity: string;
  field: string;
  oldValue: string;
  newValue: string;
  taskId?: string;
  projectId?: string;
  /** pelaku bila bukan pengguna aktif (mis. pendaftaran mandiri) */
  by?: string;
};

type AuditStore = {
  /** terbaru di atas */
  logs: AuditEntry[];
  addLog: (entries: NewAuditEntry | NewAuditEntry[]) => void;
  /** Pintasan untuk layar yang bekerja per project: nama project diisi otomatis dari projectId. */
  logProject: (projectId: string, entity: string, field: string, oldValue: string, newValue: string) => void;
};

const AuditStoreContext = createContext<AuditStore | null>(null);

let seq = 0;

export function AuditProvider({ children }: { children: ReactNode }) {
  const actorName = useCurrentUser().name;
  const [logs, setLogs] = useState<AuditEntry[]>(() => seedLogs.map((l) => ({ ...l })));

  const addLog = useCallback((input: NewAuditEntry | NewAuditEntry[]) => {
    const list = Array.isArray(input) ? input : [input];
    if (list.length === 0) return;
    const at = dayjs().format("YYYY-MM-DDTHH:mm:ss");
    const built: AuditEntry[] = list.map((e) => ({
      ...e,
      id: `al-${Date.now().toString(36)}-${++seq}`,
      changedBy: e.by ?? actorName,
      changedAt: at,
    }));
    // entri yang dicatat lebih dulu tampil lebih atas dalam satu aksi
    setLogs((prev) => [...built, ...prev]);
  }, [actorName]);

  const value = useMemo<AuditStore>(
    () => ({
      logs,
      addLog,
      logProject: (projectId, entity, field, oldValue, newValue) =>
        addLog({ projectId, projectName: projectNameById(projectId), entity, field, oldValue, newValue }),
    }),
    [logs, addLog],
  );
  return <AuditStoreContext.Provider value={value}>{children}</AuditStoreContext.Provider>;
}

export function useAuditStore(): AuditStore {
  const ctx = useContext(AuditStoreContext);
  if (!ctx) throw new Error("useAuditStore harus dipakai di dalam <AuditProvider>.");
  return ctx;
}

export const projectNameById = (id: string) => projects.find((p) => p.id === id)?.name ?? id;

/** Label entitas di riwayat: "Task · Judul" atau "Sub task · Judul (Judul induk)". */
export function taskEntity(task: Task, all: Task[]): string {
  if (!task.parentId) return `Task · ${task.title}`;
  const parent = all.find((t) => t.id === task.parentId);
  return `Sub task · ${task.title}${parent ? ` (${parent.title})` : ""}`;
}

export function truncate(text: string, max: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}
