"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { projects, type Member, type Phase } from "@/lib/mock-data";

// ---------------------------------------------------------------------------
// Struktur project yang dipakai lintas halaman: FASE dan ANGGOTA TIM (PMO/Developer/User).
//
// Halaman detail project menyimpan fase & anggota di state lokalnya, jadi layar lain (Task Board,
// form task, hak akses PMO, dashboard) tidak tahu kalau fase/anggota diubah di sana. Store ini
// jembatannya: detail project "menerbitkan" state-nya lewat `usePublishProjectStructure`, dan
// layar lain membaca lewat `useProjectStructure`. Kalau project belum pernah dibuka, dipakai data
// awal dari mock-data.
//
// Sementara di memori. Waktu backend jadi, ini diganti query biasa (GET /projects/{id}/phases,
// /members) dan jembatan ini tidak diperlukan lagi.
// ---------------------------------------------------------------------------

type Structure = { phases: Phase[]; pmo: Member[]; developers: Member[]; users: Member[] };

type ProjectStructureStore = {
  /** Fase project (urut) — dipakai form task supaya fase selalu milik project-nya. */
  phasesOf: (projectId: string) => Phase[];
  /** Nama semua anggota tim project (untuk pilihan PIC). */
  memberNamesOf: (projectId: string) => string[];
  /** PMO yang memegang project. */
  pmoOf: (projectId: string) => Member[];
  /** Developer project (untuk aturan akses project). */
  developersOf: (projectId: string) => Member[];
  /** Semua anggota tim (PMO + Developer + User), lengkap dengan employeeId bila ada. */
  membersOf: (projectId: string) => Member[];
  publish: (projectId: string, s: Structure) => void;
};

const Ctx = createContext<ProjectStructureStore | null>(null);

export function ProjectStructureProvider({ children }: { children: ReactNode }) {
  const [published, setPublished] = useState<Record<string, Structure>>({});

  const publish = useCallback((projectId: string, s: Structure) => {
    setPublished((prev) => ({ ...prev, [projectId]: s }));
  }, []);

  const value = useMemo<ProjectStructureStore>(() => {
    const get = (projectId: string): Structure => {
      const p = published[projectId];
      if (p) return p;
      const m = projects.find((x) => x.id === projectId);
      return { phases: m?.phases ?? [], pmo: m?.pmo ?? [], developers: m?.developers ?? [], users: m?.users ?? [] };
    };
    return {
      phasesOf: (id) => get(id).phases,
      memberNamesOf: (id) => {
        const s = get(id);
        return Array.from(new Set([...s.pmo, ...s.developers, ...s.users].map((m) => m.name)));
      },
      pmoOf: (id) => get(id).pmo,
      developersOf: (id) => get(id).developers,
      membersOf: (id) => {
        const s = get(id);
        return [...s.pmo, ...s.developers, ...s.users];
      },
      publish,
    };
  }, [published, publish]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useProjectStructure(): ProjectStructureStore {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useProjectStructure harus dipakai di dalam <ProjectStructureProvider>.");
  return ctx;
}

/** Dipanggil di halaman detail project: terbitkan fase & anggota terbaru supaya layar lain ikut sinkron. */
export function usePublishProjectStructure(
  projectId: string,
  phases: Phase[],
  pmo: Member[],
  developers: Member[],
  users: Member[],
) {
  const { publish } = useProjectStructure();
  useEffect(() => {
    publish(projectId, { phases, pmo, developers, users });
  }, [publish, projectId, phases, pmo, developers, users]);
}
