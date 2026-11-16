"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import dayjs from "dayjs";
import { currentUser } from "@/lib/access";
import { useAuditStore } from "@/lib/audit-store";
import { seedArticles } from "@/lib/library-content";
import {
  canManageLibrary,
  canManageTechAccess,
  canViewSection,
  isRestrictedSection,
  type LibrarySectionKey,
} from "@/lib/library-permissions";

// ---------------------------------------------------------------------------
// Store Daftar Pustaka: artikel (CRUD) + daftar pengguna yang boleh melihat bagian teknis
// (Skema Database & API). Isi awal dari lib/library-content.ts.
//
// Sementara di memori (hilang saat refresh). Backend nanti:
//   GET/POST/PATCH/DELETE /library/articles, GET/PUT /library/technical-access
// dan pembatasan bagian teknis dicek di server (403), bukan hanya disembunyikan di UI.
// ---------------------------------------------------------------------------

export type LibraryArticle = {
  id: string;
  section: LibrarySectionKey;
  title: string;
  summary: string;
  body: string; // markdown
  order: number;
  tags: string[];
  updatedAt: string; // YYYY-MM-DD
  updatedBy: string;
};

export type ArticleInput = Pick<LibraryArticle, "section" | "title" | "summary" | "body" | "order" | "tags">;
export type LibraryResult = { ok: true; id?: string } | { ok: false; reason: string };

type LibraryStore = {
  /** Hanya artikel yang boleh dilihat pengguna saat ini, terurut per bagian lalu urutan. */
  articles: LibraryArticle[];
  techAccessIds: string[];
  canManage: boolean;
  canManageAccessList: boolean;
  addArticle: (input: ArticleInput) => LibraryResult;
  updateArticle: (id: string, input: ArticleInput) => LibraryResult;
  deleteArticle: (id: string) => LibraryResult;
  setTechAccess: (userIds: string[]) => LibraryResult;
};

const Ctx = createContext<LibraryStore | null>(null);

const NO_ACCESS = "Kamu tidak punya akses ke bagian ini.";
const NOT_MANAGER = "Hanya pengelola pustaka (Administrator atau developer yang diberi akses teknis) yang bisa mengubah artikel.";

export function LibraryProvider({ children }: { children: ReactNode }) {
  const { addLog } = useAuditStore();
  const [all, setAll] = useState<LibraryArticle[]>(seedArticles);
  // Awalnya hanya akun Administrator (selalu punya akses). Administrator menambah developer lain lewat menu Pustaka.
  const [techAccessIds, setTech] = useState<string[]>([]);

  const value = useMemo<LibraryStore>(() => {
    const manager = canManageLibrary(currentUser, techAccessIds);
    // Judul artikel teknis tidak dibocorkan ke Riwayat Perubahan (yang bisa dibaca semua orang).
    const entityOf = (a: Pick<LibraryArticle, "section" | "title">) =>
      isRestrictedSection(a.section) ? "Pustaka · (artikel teknis)" : `Pustaka · ${a.title}`;
    const log = (a: Pick<LibraryArticle, "section" | "title">, field: string, oldValue: string, newValue: string) =>
      addLog({ projectName: "Daftar Pustaka", entity: entityOf(a), field, oldValue, newValue });

    const visible = all
      .filter((a) => canViewSection(currentUser, a.section, techAccessIds))
      .sort((a, b) => a.section.localeCompare(b.section) || a.order - b.order || a.title.localeCompare(b.title));

    const guard = (section: LibrarySectionKey): LibraryResult | null => {
      if (!manager) return { ok: false, reason: NOT_MANAGER };
      if (!canViewSection(currentUser, section, techAccessIds)) return { ok: false, reason: NO_ACCESS };
      return null;
    };

    return {
      articles: visible,
      techAccessIds,
      canManage: manager,
      canManageAccessList: canManageTechAccess(currentUser),

      addArticle(input) {
        const denied = guard(input.section);
        if (denied) return denied;
        const a: LibraryArticle = {
          ...input,
          id: `lib-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
          updatedAt: dayjs().format("YYYY-MM-DD"),
          updatedBy: currentUser.name,
        };
        setAll((prev) => [...prev, a]);
        log(a, "Artikel", "—", "Dibuat");
        return { ok: true, id: a.id };
      },

      updateArticle(id, input) {
        const cur = all.find((x) => x.id === id);
        if (!cur) return { ok: false, reason: "Artikel tidak ditemukan." };
        const denied = guard(cur.section) ?? guard(input.section);
        if (denied) return denied;
        setAll((prev) =>
          prev.map((x) => (x.id === id ? { ...x, ...input, updatedAt: dayjs().format("YYYY-MM-DD"), updatedBy: currentUser.name } : x)),
        );
        log(input, "Artikel", "—", "Diubah");
        return { ok: true, id };
      },

      deleteArticle(id) {
        const cur = all.find((x) => x.id === id);
        if (!cur) return { ok: false, reason: "Artikel tidak ditemukan." };
        const denied = guard(cur.section);
        if (denied) return denied;
        setAll((prev) => prev.filter((x) => x.id !== id));
        log(cur, "Artikel", "Aktif", "Dihapus");
        return { ok: true };
      },

      setTechAccess(userIds) {
        if (!canManageTechAccess(currentUser)) return { ok: false, reason: "Hanya Administrator yang bisa mengatur akses teknis." };
        const before = techAccessIds.length;
        setTech(userIds);
        addLog({
          projectName: "Daftar Pustaka",
          entity: "Pustaka · Akses Teknis",
          field: "Daftar developer",
          oldValue: `${before} orang`,
          newValue: `${userIds.length} orang`,
        });
        return { ok: true };
      },
    };
  }, [all, techAccessIds, addLog]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLibraryStore(): LibraryStore {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useLibraryStore harus dipakai di dalam <LibraryProvider>.");
  return ctx;
}
