"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import dayjs from "dayjs";
import type { TaskAttachment } from "@/lib/mock-data";
import { currentUser } from "@/lib/access";
import { projectNameById, taskEntity, truncate, useAuditStore } from "@/lib/audit-store";
import { useTaskStore, type ActionResult } from "@/lib/task-store";
import { useProjectStructure } from "@/lib/project-structure";
import { DENY, canCommentOnTask, canDeleteComment, isCommentOwner } from "@/lib/task-permissions";

// Komentar per task / sub task. Lampiran komentar memakai tipe yang sama dengan lampiran task
// (gambar, PDF/file, atau link). Setiap komentar masuk/ubah/hapus ikut tercatat di Riwayat Perubahan.
// Hak akses: yang punya akses ke project (atau PIC task) boleh berkomentar; ubah komentar hanya
// oleh pemiliknya; hapus oleh pemiliknya atau PMO project (moderasi). Lihat task-permissions.ts.
//
// Sementara di memori. Backend nanti: GET/POST /tasks/{id}/comments, DELETE /comments/{id}.

export type TaskComment = {
  id: string;
  taskId: string;
  author: string;
  createdAt: string; // YYYY-MM-DDTHH:mm:ss (waktu lokal)
  text: string;
  attachments: TaskAttachment[];
};

type CommentStore = {
  comments: TaskComment[];
  addComment: (taskId: string, text: string, attachments: TaskAttachment[]) => ActionResult;
  /** hanya pemilik komentar */
  updateComment: (id: string, text: string) => ActionResult;
  /** pemilik komentar, atau PMO project task tsb */
  deleteComment: (id: string) => ActionResult;
};

const CommentStoreContext = createContext<CommentStore | null>(null);

const seed: TaskComment[] = [
  {
    id: "c1",
    taskId: "t2",
    author: "Rani Kusuma",
    createdAt: "2026-09-12T10:30:00",
    text: "Tolong pastikan rekonsiliasi saldo per batch selesai sebelum cutover ya.",
    attachments: [],
  },
];

export function CommentProvider({ children }: { children: ReactNode }) {
  const { tasks } = useTaskStore();
  const { addLog } = useAuditStore();
  const { pmoOf } = useProjectStructure();
  const [comments, setComments] = useState<TaskComment[]>(seed);

  const value = useMemo<CommentStore>(() => {
    const logFor = (taskId: string, newValue: string) => {
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return;
      addLog({
        projectId: task.projectId,
        projectName: projectNameById(task.projectId),
        entity: taskEntity(task, tasks),
        field: "Komentar",
        oldValue: "—",
        newValue,
        taskId,
      });
    };
    return {
      comments,
      addComment(taskId, text, attachments) {
        const task = tasks.find((t) => t.id === taskId);
        if (!task) return { ok: false, reason: "Task tidak ditemukan." };
        if (!canCommentOnTask(currentUser, task, tasks, pmoOf)) return { ok: false, reason: DENY.comment };
        const c: TaskComment = {
          id: `c-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
          taskId,
          author: currentUser.name,
          createdAt: dayjs().format("YYYY-MM-DDTHH:mm:ss"),
          text: text.trim(),
          attachments,
        };
        setComments((prev) => [...prev, c]);
        logFor(
          taskId,
          `Menambah komentar: "${truncate(c.text || "(hanya lampiran)", 70)}"${attachments.length ? ` (+${attachments.length} lampiran)` : ""}`,
        );
        return { ok: true };
      },
      updateComment(id, text) {
        const c = comments.find((x) => x.id === id);
        if (!c) return { ok: false, reason: "Komentar tidak ditemukan." };
        if (!isCommentOwner(currentUser, c.author)) return { ok: false, reason: DENY.commentOwn };
        if (!text.trim() && c.attachments.length === 0) return { ok: false, reason: "Komentar tidak boleh kosong." };
        setComments((prev) => prev.map((x) => (x.id === id ? { ...x, text: text.trim() } : x)));
        logFor(c.taskId, `Mengubah komentar: "${truncate(text, 70)}"`);
        return { ok: true };
      },
      deleteComment(id) {
        const c = comments.find((x) => x.id === id);
        if (!c) return { ok: false, reason: "Komentar tidak ditemukan." };
        const task = tasks.find((t) => t.id === c.taskId);
        if (!task || !canDeleteComment(currentUser, c.author, task, pmoOf)) return { ok: false, reason: DENY.commentDelete };
        setComments((prev) => prev.filter((x) => x.id !== id));
        logFor(c.taskId, `Menghapus komentar${c.author !== currentUser.name ? ` milik ${c.author}` : ""}: "${truncate(c.text || "(hanya lampiran)", 70)}"`);
        return { ok: true };
      },
    };
  }, [comments, tasks, addLog, pmoOf]);

  return <CommentStoreContext.Provider value={value}>{children}</CommentStoreContext.Provider>;
}

export function useCommentStore(): CommentStore {
  const ctx = useContext(CommentStoreContext);
  if (!ctx) throw new Error("useCommentStore harus dipakai di dalam <CommentProvider>.");
  return ctx;
}

export function useTaskComments(taskId: string | undefined): TaskComment[] {
  const { comments } = useCommentStore();
  return useMemo(() => (taskId ? comments.filter((c) => c.taskId === taskId) : []), [comments, taskId]);
}
