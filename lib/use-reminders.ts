"use client";

import { useMemo } from "react";
import dayjs from "dayjs";
import { useCurrentUser } from "@/lib/acting-user";
import { useMeetingMeta, useStatusMeta } from "@/lib/master-store";
import { useMeetingStore } from "@/lib/meeting-store";
import { getEmployees } from "@/lib/employee-registry";
import { useNotificationStore, type Notif, type NotifType } from "@/lib/notification-store";
import { useTaskStore } from "@/lib/task-store";
import { useTaskPermissions } from "@/lib/use-task-permissions";
import { useMeetingPermissions } from "@/lib/use-meeting-permissions";
import { useToday } from "@/lib/task-ui";

// Pengingat otomatis: dihitung dari keadaan data SEKARANG, jadi hilang sendiri begitu masalahnya selesai
// (task di-Done-kan, hasil rapat diisi). Tidak disimpan; id stabil `rem:{jenis}:{id}` supaya "sudah dibaca"
// bisa diingat. Di backend ini pekerjaan terjadwal yang menulis ke tabel notifications dengan dedupe_key.
export function useReminders(): Notif[] {
  const me = useCurrentUser();
  const today = useToday();
  const { tasks } = useTaskStore();
  const { meetings } = useMeetingStore();
  const meta = useMeetingMeta();
  const { isDone } = useStatusMeta();
  const perms = useTaskPermissions();
  const mperms = useMeetingPermissions();
  const { isReminderRead } = useNotificationStore();

  return useMemo(() => {
    if (!today) return [];
    const out: Notif[] = [];
    const add = (type: NotifType, key: string, title: string, body: string, link: string, at: string) =>
      out.push({ id: `rem:${type}:${key}`, userId: me.id, type, title, body, link, createdAt: at, derived: true });
    const now = dayjs();
    const myEmpIds = new Set(getEmployees().filter((e) => e.userId === me.id).map((e) => e.id));

    for (const t of tasks) {
      if (!perms.isPic(t) || isDone(t.status)) continue;
      const diff = dayjs(t.dueDate).startOf("day").diff(dayjs(today), "day");
      const kind = t.parentId ? "Sub task" : "Task";
      if (diff < 0) add("task_overdue", t.id, `${kind} terlambat: ${t.title}`, `Jatuh tempo ${dayjs(t.dueDate).format("DD MMM YYYY")}, terlambat ${-diff} hari.`, `/tasks/${t.id}`, `${t.dueDate}T00:00:00`);
      else if (diff <= 3) add("task_due_soon", t.id, `${kind} segera jatuh tempo: ${t.title}`, diff === 0 ? "Jatuh tempo hari ini." : `Jatuh tempo ${diff === 1 ? "besok" : `${diff} hari lagi`} (${dayjs(t.dueDate).format("DD MMM")}).`, `/tasks/${t.id}`, `${t.dueDate}T00:00:00`);
    }
    for (const m of meetings) {
      const kind = meta.statusKind(m.statusId);
      const start = dayjs(m.startsAt);
      // pengingat hanya untuk rapat yang menyangkut saya: peserta, pembuat, atau PMO/pengelola
      const mine = m.createdBy === me.id || mperms.canManage(m) || m.participants.some((p) => (p.employeeId && myEmpIds.has(p.employeeId)) || (!p.external && p.name.toLowerCase() === me.name.toLowerCase()));
      if (!mine) continue;
      if (kind === "planned" && start.isAfter(now) && start.diff(now, "hour") <= 24) {
        add("meeting_soon", m.id, `Rapat segera: ${m.title}`, `${start.format("DD MMM HH:mm")} · ${m.isOnline ? "Online" : (m.location ?? "Offline")}`, "/meetings", m.startsAt);
      }
      if (kind === "done" && !m.summary && !m.attachments.length && mperms.canManage(m)) {
        add("meeting_no_result", m.id, `Hasil rapat belum ada: ${m.title}`, `Rapat ${start.format("DD MMM")} sudah selesai; isi ringkasan atau unggah notulen.`, "/meetings", m.endsAt);
      }
    }
    return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((n) => ({ ...n, readAt: isReminderRead(n.id) ? n.createdAt : undefined }));
  }, [today, tasks, meetings, meta, isDone, perms, mperms, me, isReminderRead]);
}

/** Notifikasi + pengingat milik pengguna aktif, siap tampil. */
export function useMyNotifications() {
  const { mine, markRead, markAllRead, remove } = useNotificationStore();
  const reminders = useReminders();
  const all = useMemo(() => [...reminders, ...mine].sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [reminders, mine]);
  const unread = all.filter((n) => !n.readAt).length;
  return {
    all,
    reminders,
    events: mine,
    unread,
    markRead,
    remove,
    markAllRead: () => markAllRead(reminders.map((r) => r.id)),
  };
}
