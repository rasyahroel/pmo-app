"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import dayjs from "dayjs";
import { useCurrentUser } from "@/lib/acting-user";
import { getEmployees } from "@/lib/employee-registry";
import { useProjectStructure } from "@/lib/project-structure";
import { useUserStore } from "@/lib/user-store";

// Notifikasi = pemberitahuan untuk SATU penerima. Dua jenis sumber:
//
//  1. KEJADIAN (disimpan): ada yang melakukan sesuatu terhadap saya -> baris baru untuk penerima
//     (ditugaskan jadi PIC, komentar, review, diundang rapat, jadwal rapat berubah/batal).
//     Dibuat oleh store lain lewat `notify()` tepat di aksi yang sama dengan Riwayat Perubahan.
//  2. PENGINGAT (dihitung): keadaan data yang butuh tindakan (task terlambat/jatuh tempo, rapat
//     segera, hasil rapat belum ada). Tidak disimpan; muncul dan hilang sendiri mengikuti data
//     (lihat lib/use-reminders.ts). Backend membuatnya lewat pekerjaan terjadwal (cron).
//
// Titik sambung ke backend Go: GET /notifications, POST /notifications/{id}/read, POST
// /notifications/read-all. `notify()` dihapus dari frontend; server yang membuat baris saat kejadian.

export type NotifType =
  | "task_assigned"
  | "task_commented"
  | "task_reviewed"
  | "meeting_invited"
  | "meeting_changed"
  | "meeting_cancelled"
  | "task_overdue"
  | "task_due_soon"
  | "meeting_soon"
  | "meeting_no_result";

export type NotifGroup = "Task" | "Rapat" | "Pengingat";

export const NOTIF_META: Record<NotifType, { label: string; group: NotifGroup; color: string }> = {
  task_assigned: { label: "Penugasan", group: "Task", color: "#206D7E" },
  task_commented: { label: "Komentar", group: "Task", color: "#6B5BD2" },
  task_reviewed: { label: "Review", group: "Task", color: "#17A34A" },
  meeting_invited: { label: "Undangan rapat", group: "Rapat", color: "#2F6FDE" },
  meeting_changed: { label: "Rapat berubah", group: "Rapat", color: "#B7791F" },
  meeting_cancelled: { label: "Rapat batal", group: "Rapat", color: "#D6336C" },
  task_overdue: { label: "Task terlambat", group: "Pengingat", color: "#D6336C" },
  task_due_soon: { label: "Segera jatuh tempo", group: "Pengingat", color: "#B7791F" },
  meeting_soon: { label: "Rapat segera", group: "Pengingat", color: "#2F6FDE" },
  meeting_no_result: { label: "Hasil rapat belum ada", group: "Pengingat", color: "#B7791F" },
};

export type Notif = {
  id: string;
  userId: string;
  type: NotifType;
  title: string;
  body?: string;
  link: string;
  createdAt: string; // ISO
  readAt?: string;
  actor?: string;
  /** true = pengingat yang dihitung dari data (tidak disimpan, tidak bisa dihapus) */
  derived?: boolean;
};

export type NotifTarget = {
  userIds?: string[];
  /** nama orang (PIC/peserta tersimpan sebagai nama); dicocokkan ke akun lewat nama atau Master Pegawai */
  names?: string[];
  employeeIds?: string[];
  /** semua PMO project ini */
  pmoOfProject?: string;
};
export type NotifInput = { to: NotifTarget; type: NotifType; title: string; body?: string; link: string };

type NotificationStore = {
  /** hanya yang dikirim ke pengguna aktif, terbaru dulu (belum termasuk pengingat) */
  mine: Notif[];
  /** POST (server) — dipanggil store lain saat kejadian. Pelaku sendiri tidak diberi notifikasi. */
  notify: (n: NotifInput) => void;
  markRead: (id: string) => void;
  markAllRead: (derivedIds?: string[]) => void;
  remove: (id: string) => void;
  /** id pengingat yang sudah ditandai dibaca oleh pengguna aktif */
  isReminderRead: (id: string) => boolean;
};

const Ctx = createContext<NotificationStore | null>(null);
const norm = (s: string) => s.trim().toLowerCase();
let seq = 0;

function seedFor(): Notif[] {
  const ago = (min: number) => dayjs().subtract(min, "minute").format("YYYY-MM-DDTHH:mm:ss");
  return [
    { id: "n-seed-1", userId: "u1", type: "task_commented", title: "Budi Prakoso berkomentar di “Migrasi data nasabah dari T24”", body: "Batch 3 sudah selesai diekstrak, mohon dicek rekonsiliasinya.", link: "/tasks/t2", createdAt: ago(25), actor: "Budi Prakoso" },
    { id: "n-seed-2", userId: "u1", type: "meeting_changed", title: "Jadwal rapat berubah: Review FSD Fase 2", body: "Dipindah ke 22 Okt, 10.00.", link: "/meetings", createdAt: ago(180), actor: "Admin IT" },
    { id: "n-seed-3", userId: "u1", type: "task_reviewed", title: "Task kamu direview: Integrasi API rekening core banking", body: "Status review: Disetujui.", link: "/tasks/t1", createdAt: ago(60 * 26), readAt: ago(60 * 24), actor: "Rani Kusuma" },
    { id: "n-seed-4", userId: "u2", type: "task_assigned", title: "Kamu ditunjuk sebagai PIC: Siapkan data uji penggajian", body: "Ditugaskan oleh Admin IT.", link: "/tasks", createdAt: ago(40), actor: "Admin IT" },
    { id: "n-seed-5", userId: "u3", type: "meeting_invited", title: "Kamu diundang rapat: Persiapan UAT batch 2", link: "/meetings", createdAt: ago(95), actor: "Rani Kusuma" },
    { id: "n-seed-6", userId: "u4", type: "task_commented", title: "Rani Kusuma berkomentar di “Migrasi data nasabah dari T24”", body: "Tolong lampirkan hasil rekon sebelum cutover.", link: "/tasks/t2", createdAt: ago(55), actor: "Rani Kusuma" },
  ];
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const me = useCurrentUser();
  const { users } = useUserStore();
  const { pmoOf } = useProjectStructure();
  const [items, setItems] = useState<Notif[]>(seedFor);
  const [readReminders, setReadReminders] = useState<string[]>([]);
  const ref = useRef(items);
  const commit = useCallback((next: Notif[]) => {
    ref.current = next;
    setItems(next);
  }, []);

  const value = useMemo<NotificationStore>(() => {
    const resolve = (t: NotifTarget): string[] => {
      const emps = getEmployees();
      const out = new Set<string>(t.userIds ?? []);
      for (const n of t.names ?? []) {
        const u = users.find((x) => norm(x.name) === norm(n));
        if (u) out.add(u.id);
        const e = emps.find((x) => norm(x.name) === norm(n) && x.userId);
        if (e?.userId) out.add(e.userId);
      }
      for (const id of t.employeeIds ?? []) {
        const e = emps.find((x) => x.id === id);
        if (e?.userId) out.add(e.userId);
      }
      if (t.pmoOfProject) {
        for (const m of pmoOf(t.pmoOfProject)) {
          const e = m.employeeId ? emps.find((x) => x.id === m.employeeId) : undefined;
          if (e?.userId) out.add(e.userId);
        }
      }
      // hanya akun aktif, dan bukan pelakunya sendiri
      return [...out].filter((id) => id !== me.id && users.some((u) => u.id === id && u.active));
    };

    return {
      mine: items.filter((n) => n.userId === me.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      notify(n) {
        const at = dayjs().format("YYYY-MM-DDTHH:mm:ss");
        const rows: Notif[] = resolve(n.to).map((userId) => ({ id: `n-${Date.now().toString(36)}-${++seq}`, userId, type: n.type, title: n.title, body: n.body, link: n.link, createdAt: at, actor: me.name }));
        if (rows.length) commit([...rows, ...ref.current]);
      },
      markRead(id) {
        const at = dayjs().format("YYYY-MM-DDTHH:mm:ss");
        if (id.startsWith("rem:")) return void setReadReminders((p) => (p.includes(`${me.id}|${id}`) ? p : [...p, `${me.id}|${id}`]));
        commit(ref.current.map((n) => (n.id === id && n.userId === me.id && !n.readAt ? { ...n, readAt: at } : n)));
      },
      markAllRead(derivedIds = []) {
        const at = dayjs().format("YYYY-MM-DDTHH:mm:ss");
        commit(ref.current.map((n) => (n.userId === me.id && !n.readAt ? { ...n, readAt: at } : n)));
        if (derivedIds.length) setReadReminders((p) => [...new Set([...p, ...derivedIds.map((d) => `${me.id}|${d}`)])]);
      },
      remove(id) {
        commit(ref.current.filter((n) => !(n.id === id && n.userId === me.id)));
      },
      isReminderRead: (id) => readReminders.includes(`${me.id}|${id}`),
    };
  }, [items, me, users, pmoOf, commit, readReminders]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useNotificationStore(): NotificationStore {
  const v = useContext(Ctx);
  if (!v) throw new Error("useNotificationStore harus dipakai di dalam <NotificationProvider>");
  return v;
}

/** Pintasan untuk store lain: hanya `notify`. */
export const useNotify = () => useNotificationStore().notify;
