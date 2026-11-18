"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import dayjs from "dayjs";
import { employees, meetings as seedMeetings, projects, type TaskAttachment } from "@/lib/mock-data";
import { useCurrentUser } from "@/lib/acting-user";
import { useNotify } from "@/lib/notification-store";
import { projectNameById, truncate, useAuditStore, type NewAuditEntry } from "@/lib/audit-store";
import { useMasterStore, useMeetingMeta, useStatusMeta } from "@/lib/master-store";
import { useProjectStructure } from "@/lib/project-structure";
import { useTaskStore } from "@/lib/task-store";
import {
  MEETING_DENY,
  canCreateMeeting,
  canManageMeeting,
  canViewMeeting,
} from "@/lib/meeting-permissions";

// ---------------------------------------------------------------------------
// Store Rapat: jadwal, mode (online/offline), peserta (pegawai master atau pihak luar), hasil rapat
// (ringkasan, keputusan, file MOM) dan tindak lanjut yang bisa dijadikan task di Task Board.
//
// Kategori dan status rapat berasal dari Master Data (lihat master-store). Semua aksi dicek hak
// aksesnya di sini (bukan hanya disembunyikan di UI) dan dicatat ke Riwayat Perubahan.
//
// Sementara di memori. Padanan backend: /meetings (lihat artikel API Pustaka).
// ---------------------------------------------------------------------------

export type Participant = {
  id: string;
  name: string;
  /** terisi bila dipilih dari Master Pegawai */
  employeeId?: string;
  /** true = pihak luar yang diinput manual */
  external: boolean;
  organization?: string;
};

export type ActionItem = {
  id: string;
  title: string;
  pics: string[];
  dueDate?: string; // YYYY-MM-DD
  note?: string;
  /** terisi setelah dijadikan task */
  taskId?: string;
};

export type MeetingRecord = {
  id: string;
  projectId: string;
  title: string;
  categoryId: string;
  statusId: string;
  startsAt: string; // YYYY-MM-DDTHH:mm:ss (waktu lokal)
  endsAt: string;
  isOnline: boolean;
  location?: string; // bila offline
  meetingUrl?: string; // bila online
  description?: string;
  participants: Participant[];
  // Hasil rapat
  summary?: string;
  decisions?: string;
  attachments: TaskAttachment[];
  actionItems: ActionItem[];
  createdBy: string; // AppUser.id
};

export type MeetingInput = Omit<MeetingRecord, "id" | "createdBy" | "summary" | "decisions" | "attachments" | "actionItems"> &
  Partial<Pick<MeetingRecord, "summary" | "decisions" | "attachments" | "actionItems">>;
export type MeetingPatch = Partial<Omit<MeetingRecord, "id" | "createdBy">>;
export type MeetingResult = { ok: true; id?: string; count?: number; taskId?: string } | { ok: false; reason: string };

type MeetingStore = {
  /** Hanya rapat yang boleh dilihat pengguna saat ini. */
  meetings: MeetingRecord[];
  /** POST /meetings */
  addMeeting: (input: MeetingInput) => MeetingResult;
  /** PATCH /meetings/{id} */
  updateMeeting: (id: string, patch: MeetingPatch) => MeetingResult;
  /** DELETE /meetings/{id} */
  deleteMeeting: (id: string) => MeetingResult;
  /** PUT /meetings/{id}/participants — peserta boleh ditambah kapan saja, juga setelah rapat dibuat */
  setParticipants: (id: string, list: Participant[]) => MeetingResult;
  /** PUT /meetings/{id}/action-items */
  setActionItems: (id: string, items: ActionItem[]) => MeetingResult;
  /** POST /meetings/{id}/action-items/{itemId}/task — jadikan satu tindak lanjut sebagai task */
  convertActionItem: (meetingId: string, itemId: string, phaseId: string) => MeetingResult;
  /** POST /meetings/{id}/action-items/convert — semua yang belum jadi task */
  convertAllActionItems: (meetingId: string, phaseId: string) => MeetingResult;
};

const Ctx = createContext<MeetingStore | null>(null);

const newId = (p: string) => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
const norm = (s: string) => s.trim().toLowerCase();

export const participantKey = (p: Pick<Participant, "name" | "employeeId" | "external">) =>
  p.employeeId ? `emp:${p.employeeId}` : `${p.external ? "ext" : "int"}:${norm(p.name)}`;

/** Gabungkan peserta tanpa duplikat (kunci: pegawai master, atau nama). */
export function mergeParticipants(base: Participant[], extra: Participant[]): Participant[] {
  const seen = new Set(base.map(participantKey));
  const out = [...base];
  for (const p of extra) {
    const k = participantKey(p);
    if (!seen.has(k)) {
      seen.add(k);
      out.push(p);
    }
  }
  return out;
}

const SEED_CATEGORY = (name: string) => `mc-${name.toLowerCase()}`;
const SEED_STATUS: Record<string, string> = { Scheduled: "ms-scheduled", Done: "ms-done", Cancelled: "ms-cancelled" };

function buildSeed(): MeetingRecord[] {
  return seedMeetings.map((m, i) => {
    const start = dayjs(m.date);
    const base: MeetingRecord = {
      id: m.id,
      projectId: m.projectId,
      title: m.title,
      categoryId: SEED_CATEGORY(m.category),
      statusId: SEED_STATUS[m.status] ?? "ms-scheduled",
      startsAt: start.format("YYYY-MM-DDTHH:mm:ss"),
      endsAt: start.add(1, "hour").format("YYYY-MM-DDTHH:mm:ss"),
      isOnline: i % 2 === 0,
      location: i % 2 === 0 ? undefined : "Ruang Rapat Lt. 5, Gedung Utama",
      meetingUrl: i % 2 === 0 ? "https://meet.example.co.id/pmo-rapat" : undefined,
      participants: m.attendees.map((name) => {
        const e = employees.find((x) => norm(x.name) === norm(name));
        return { id: newId("pt"), name, employeeId: e?.id, external: false };
      }),
      attachments: [],
      actionItems: [],
      createdBy: "u1",
    };
    if (m.status === "Done") {
      base.summary = "Progress development berjalan sesuai rencana. Integrasi API rekening selesai; migrasi data masih menunggu rekonsiliasi batch 2.";
      base.decisions = "Cutover digeser satu minggu menunggu hasil rekonsiliasi.";
      base.attachments = [{ id: "a-seed-1", kind: "link", name: "MOM mingguan (dokumen bersama)", url: "https://wiki.company.co.id/pmo/mom-mingguan" }];
      base.actionItems = [
        { id: "ai-seed-1", title: "Selesaikan rekonsiliasi batch 2", pics: ["Budi Prakoso"], dueDate: "2026-09-30" },
        { id: "ai-seed-2", title: "Jadwalkan ulang rencana cutover", pics: ["Rani Kusuma"], dueDate: "2026-09-28" },
      ];
    }
    return base;
  });
}

export function MeetingProvider({ children }: { children: ReactNode }) {
  const currentUser = useCurrentUser();
  const notify = useNotify();
  const { addTask } = useTaskStore();
  const { addLog } = useAuditStore();
  const { taskCategories } = useMasterStore();
  const { statuses: taskStatuses } = useStatusMeta();
  const meta = useMeetingMeta();
  const { pmoOf, developersOf, phasesOf } = useProjectStructure();
  const [all, setAll] = useState<MeetingRecord[]>(buildSeed);

  const value = useMemo<MeetingStore>(() => {
    const scope = { projects, pmoOf, developersOf };
    const visible = all.filter((m) => canViewMeeting(currentUser, m, scope)).sort((a, b) => a.startsAt.localeCompare(b.startsAt));

    const log = (m: Pick<MeetingRecord, "projectId" | "title">, field: string, o: string, n: string): NewAuditEntry => ({
      projectId: m.projectId,
      projectName: projectNameById(m.projectId),
      entity: `Rapat · ${m.title}`,
      field,
      oldValue: o,
      newValue: n,
    });
    const find = (id: string) => all.find((m) => m.id === id);
    const fmt = (iso: string) => dayjs(iso).format("DD MMM YYYY HH:mm");
    const modeText = (m: Pick<MeetingRecord, "isOnline" | "location" | "meetingUrl">) =>
      m.isOnline ? `Online · ${m.meetingUrl ?? "—"}` : `Offline · ${m.location ?? "—"}`;
    const patchOne = (id: string, fn: (m: MeetingRecord) => MeetingRecord) => setAll((prev) => prev.map((m) => (m.id === id ? fn(m) : m)));
    const denyManage = (m: MeetingRecord) => (canManageMeeting(currentUser, m, pmoOf) ? null : ({ ok: false, reason: MEETING_DENY.manage } as const));

    // peserta internal (Master Pegawai / nama) diberi tahu; tamu luar tidak punya akun
    function notifyPeople(list: Participant[], type: "meeting_invited" | "meeting_changed" | "meeting_cancelled", title: string, body: string) {
      const internal = list.filter((p) => !p.external);
      if (internal.length === 0) return;
      notify({ to: { employeeIds: internal.map((p) => p.employeeId).filter((x): x is string => !!x), names: internal.map((p) => p.name) }, type, title, body, link: "/meetings" });
    }

    function diff(before: MeetingRecord, after: MeetingRecord): NewAuditEntry[] {
      const out: NewAuditEntry[] = [];
      const push = (f: string, o: string, n: string) => out.push(log(after, f, o, n));
      if (before.title !== after.title) push("Judul", before.title, after.title);
      if (before.startsAt !== after.startsAt || before.endsAt !== after.endsAt) push("Jadwal", `${fmt(before.startsAt)} – ${dayjs(before.endsAt).format("HH:mm")}`, `${fmt(after.startsAt)} – ${dayjs(after.endsAt).format("HH:mm")}`);
      if (modeText(before) !== modeText(after)) push("Online / lokasi", modeText(before), modeText(after));
      if (before.statusId !== after.statusId) push("Status", meta.statusName(before.statusId), meta.statusName(after.statusId));
      if (before.categoryId !== after.categoryId) push("Kategori", meta.categoryName(before.categoryId), meta.categoryName(after.categoryId));
      if (before.projectId !== after.projectId) push("Project", projectNameById(before.projectId), projectNameById(after.projectId));
      if ((before.description ?? "") !== (after.description ?? "")) push("Deskripsi", truncate(before.description ?? "", 50) || "(kosong)", truncate(after.description ?? "", 50) || "(kosong)");
      if ((before.summary ?? "") !== (after.summary ?? "")) push("Ringkasan hasil", truncate(before.summary ?? "", 50) || "(kosong)", truncate(after.summary ?? "", 50) || "(kosong)");
      if ((before.decisions ?? "") !== (after.decisions ?? "")) push("Keputusan", truncate(before.decisions ?? "", 50) || "(kosong)", truncate(after.decisions ?? "", 50) || "(kosong)");
      const bIds = new Set(before.attachments.map((a) => a.id));
      const aIds = new Set(after.attachments.map((a) => a.id));
      const added = after.attachments.filter((a) => !bIds.has(a.id));
      const removed = before.attachments.filter((a) => !aIds.has(a.id));
      if (added.length || removed.length) {
        const note = [added.length ? `tambah: ${added.map((a) => a.name).join(", ")}` : "", removed.length ? `hapus: ${removed.map((a) => a.name).join(", ")}` : ""].filter(Boolean).join("; ");
        push("Hasil rapat (file)", `${before.attachments.length} file`, `${after.attachments.length} file (${note})`);
      }
      return out;
    }

    return {
      meetings: visible,

      addMeeting(input) {
        if (!canCreateMeeting(currentUser, input.projectId, pmoOf)) return { ok: false, reason: MEETING_DENY.create };
        const m: MeetingRecord = { summary: undefined, decisions: undefined, attachments: [], actionItems: [], ...input, id: newId("m"), createdBy: currentUser.id };
        setAll((prev) => [...prev, m]);
        addLog(log(m, "Rapat", "—", `Dibuat · ${fmt(m.startsAt)} · ${modeText(m)}`));
        notifyPeople(m.participants, "meeting_invited", `Kamu diundang rapat: ${m.title}`, `${fmt(m.startsAt)} · ${modeText(m)}`);
        return { ok: true, id: m.id };
      },

      updateMeeting(id, patch) {
        const cur = find(id);
        if (!cur) return { ok: false, reason: "Rapat tidak ditemukan." };
        const denied = denyManage(cur);
        if (denied) return denied;
        if (patch.projectId && patch.projectId !== cur.projectId && !canCreateMeeting(currentUser, patch.projectId, pmoOf)) return { ok: false, reason: MEETING_DENY.create };
        const next: MeetingRecord = { ...cur, ...patch };
        patchOne(id, () => next);
        addLog(diff(cur, next));
        const cancelled = meta.statusKind(next.statusId) === "cancelled" && meta.statusKind(cur.statusId) !== "cancelled";
        if (cancelled) notifyPeople(next.participants, "meeting_cancelled", `Rapat dibatalkan: ${next.title}`, `Semula ${fmt(cur.startsAt)}.`);
        else if (cur.startsAt !== next.startsAt || cur.endsAt !== next.endsAt || modeText(cur) !== modeText(next))
          notifyPeople(next.participants, "meeting_changed", `Jadwal rapat berubah: ${next.title}`, `${fmt(next.startsAt)} · ${modeText(next)}`);
        return { ok: true, id };
      },

      deleteMeeting(id) {
        const cur = find(id);
        if (!cur) return { ok: false, reason: "Rapat tidak ditemukan." };
        const denied = denyManage(cur);
        if (denied) return denied;
        setAll((prev) => prev.filter((m) => m.id !== id));
        addLog(log(cur, "Rapat", "Aktif", "Dihapus"));
        return { ok: true };
      },

      setParticipants(id, list) {
        const cur = find(id);
        if (!cur) return { ok: false, reason: "Rapat tidak ditemukan." };
        const denied = denyManage(cur);
        if (denied) return denied;
        const clean = mergeParticipants([], list);
        const before = new Set(cur.participants.map(participantKey));
        const after = new Set(clean.map(participantKey));
        const added = clean.filter((p) => !before.has(participantKey(p)));
        const removed = cur.participants.filter((p) => !after.has(participantKey(p)));
        patchOne(id, (m) => ({ ...m, participants: clean }));
        const entries: NewAuditEntry[] = [];
        if (added.length) entries.push(log(cur, "Peserta", `${cur.participants.length} orang`, `${clean.length} orang (tambah: ${added.map((p) => p.name).join(", ")})`));
        if (removed.length) entries.push(log(cur, "Peserta", `${cur.participants.length} orang`, `${clean.length} orang (hapus: ${removed.map((p) => p.name).join(", ")})`));
        addLog(entries);
        notifyPeople(added, "meeting_invited", `Kamu diundang rapat: ${cur.title}`, `${fmt(cur.startsAt)} · ${modeText(cur)}`);
        return { ok: true, count: clean.length };
      },

      setActionItems(id, items) {
        const cur = find(id);
        if (!cur) return { ok: false, reason: "Rapat tidak ditemukan." };
        const denied = denyManage(cur);
        if (denied) return denied;
        const before = new Set(cur.actionItems.map((i) => i.id));
        const after = new Set(items.map((i) => i.id));
        const added = items.filter((i) => !before.has(i.id));
        const removed = cur.actionItems.filter((i) => !after.has(i.id));
        patchOne(id, (m) => ({ ...m, actionItems: items }));
        const entries: NewAuditEntry[] = [];
        if (added.length) entries.push(log(cur, "Tindak lanjut", `${cur.actionItems.length} butir`, `${items.length} butir (tambah: ${added.map((i) => i.title).join("; ")})`));
        if (removed.length) entries.push(log(cur, "Tindak lanjut", `${cur.actionItems.length} butir`, `${items.length} butir (hapus: ${removed.map((i) => i.title).join("; ")})`));
        addLog(entries);
        return { ok: true, count: items.length };
      },

      convertActionItem(meetingId, itemId, phaseId) {
        const r = convert(meetingId, [itemId], phaseId);
        return r;
      },

      convertAllActionItems(meetingId, phaseId) {
        const cur = find(meetingId);
        if (!cur) return { ok: false, reason: "Rapat tidak ditemukan." };
        return convert(meetingId, cur.actionItems.filter((i) => !i.taskId).map((i) => i.id), phaseId);
      },
    };

    // Tindak lanjut -> task di Task Board (kategori "To-Do Meeting", status awal pertama yang belum selesai).
    function convert(meetingId: string, itemIds: string[], phaseId: string): MeetingResult {
      const cur = find(meetingId);
      if (!cur) return { ok: false, reason: "Rapat tidak ditemukan." };
      const denied = denyManage(cur);
      if (denied) return denied;
      if (!phasesOf(cur.projectId).some((p) => p.id === phaseId)) return { ok: false, reason: "Fase harus milik project rapat ini." };
      const category = taskCategories.find((c) => norm(c.name).includes("meeting")) ?? taskCategories[0];
      const status = taskStatuses.find((s) => !s.isDone) ?? taskStatuses[0];
      if (!category || !status) return { ok: false, reason: "Kategori atau status task belum ada di Master Data." };

      const created: Record<string, string> = {};
      const meetingDay = dayjs(cur.startsAt).format("YYYY-MM-DD");
      for (const itemId of itemIds) {
        const item = cur.actionItems.find((i) => i.id === itemId);
        if (!item || item.taskId) continue;
        const due = item.dueDate ?? dayjs(cur.startsAt).add(7, "day").format("YYYY-MM-DD");
        const res = addTask({
          projectId: cur.projectId,
          phaseId,
          title: item.title,
          description: `Berasal dari rapat "${cur.title}" (${fmt(cur.startsAt)}).${item.note ? `\n${item.note}` : ""}`,
          category: category.id,
          status: status.id,
          pics: item.pics.length ? item.pics : [currentUser.name],
          startDate: dayjs(due).isBefore(dayjs(meetingDay)) ? due : meetingDay,
          dueDate: due,
          attachments: [],
        });
        if (!res.ok) {
          // berhenti di kegagalan pertama (mis. tidak berhak membuat task); yang sudah jadi tetap tersimpan
          if (Object.keys(created).length > 0) break;
          return { ok: false, reason: res.reason };
        }
        created[itemId] = res.task.id;
        addLog(log(cur, "Tindak lanjut", item.title, `Dijadikan task (${res.task.id})`));
      }
      const count = Object.keys(created).length;
      if (count === 0) return { ok: false, reason: "Tidak ada tindak lanjut yang perlu dijadikan task." };
      patchOne(meetingId, (m) => ({ ...m, actionItems: m.actionItems.map((i) => (created[i.id] ? { ...i, taskId: created[i.id] } : i)) }));
      return { ok: true, count, taskId: Object.values(created)[0] };
    }
  }, [all, addLog, addTask, meta, pmoOf, developersOf, phasesOf, taskCategories, taskStatuses, currentUser, notify]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useMeetingStore(): MeetingStore {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useMeetingStore harus dipakai di dalam <MeetingProvider>.");
  return ctx;
}

/** Rapat berstatus "planned" yang akan datang, terdekat dulu — untuk Dashboard. */
export function useUpcomingMeetings(limit = 5): MeetingRecord[] {
  const { meetings } = useMeetingStore();
  const meta = useMeetingMeta();
  return useMemo(
    () => meetings.filter((m) => meta.statusKind(m.statusId) === "planned").slice(0, limit),
    [meetings, meta, limit],
  );
}
