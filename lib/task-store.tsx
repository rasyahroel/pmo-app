"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { currentUser } from "@/lib/access";
import { projectNameById, taskEntity, truncate, useAuditStore, type NewAuditEntry } from "@/lib/audit-store";
import { useMasterStore } from "@/lib/master-store";
import { tasks as seedTasks, type ReviewStatus, type Task } from "@/lib/mock-data";
import { useProjectStructure } from "@/lib/project-structure";
import { cascadeDone, endOfColumnIndex, moveTaskInList, parentProgress, refreshParent, withStatus } from "@/lib/task-logic";
import { DENY, canCreateTask, canReviewTask, canUpdateTask } from "@/lib/task-permissions";

// ---------------------------------------------------------------------------
// Satu store task untuk SEMUA layar (Task Board, tab Task di detail project, halaman detail
// task, kalender, laporan, dashboard). Memuat aturan bisnis task supaya konsisten di mana pun:
//  - hak akses (lihat task-permissions.ts) -> ditolak dengan alasan yang bisa ditampilkan,
//  - sub task satu tingkat, selalu satu project/fase/kategori dengan induknya,
//  - fase harus milik project,
//  - progress task induk = rata-rata sub task; status "selesai" -> progress 100%,
//  - task induk tidak boleh "selesai" selagi sub task belum selesai, kecuali dikonfirmasi
//    (`completeSubtasks: true`) -> semua sub task ikut selesai,
//  - setiap perubahan dicatat ke Riwayat Perubahan.
//
// Sementara di memori. Padanan backend: POST /tasks, PATCH/DELETE /tasks/{id},
// PATCH /tasks/{id}/move, PATCH /tasks/{id}/review. Aturan di atas HARUS diulang di server.
// ---------------------------------------------------------------------------

export type TaskInput = Omit<Task, "id" | "progressPercent" | "reviewedBy" | "reviewedAt" | "reviewStatus"> & {
  progressPercent?: number;
};
export type TaskPatch = Partial<Omit<Task, "id" | "parentId">>;
export type ActionOptions = { completeSubtasks?: boolean };
export type ReviewPatch = { reviewedBy?: string; reviewedAt?: string; reviewStatus?: ReviewStatus };

export type ActionResult =
  | { ok: true; completedSubtasks?: number }
  | { ok: false; reason: string; openSubtasks?: Task[] };
export type AddResult = { ok: true; task: Task } | { ok: false; reason: string };

type TaskStore = {
  tasks: Task[];
  addTask: (input: TaskInput) => AddResult;
  updateTask: (id: string, patch: TaskPatch, opts?: ActionOptions) => ActionResult;
  deleteTask: (id: string) => ActionResult;
  /** Pindah ke status `status`, tepat sebelum task `beforeId` (null = paling bawah kolom). */
  moveTask: (id: string, status: string, beforeId?: string | null, opts?: ActionOptions) => ActionResult;
  setReview: (id: string, patch: ReviewPatch) => ActionResult;
};

const Ctx = createContext<TaskStore | null>(null);

let seq = 0;
const newId = () => `t-${Date.now().toString(36)}${(seq++).toString(36)}`;
const fail = (reason: string, openSubtasks?: Task[]): { ok: false; reason: string; openSubtasks?: Task[] } => ({ ok: false, reason, openSubtasks });

export function TaskStoreProvider({ children }: { children: ReactNode }) {
  const { addLog } = useAuditStore();
  const { pmoOf, phasesOf } = useProjectStructure();
  const { taskStatuses, taskCategories } = useMasterStore();

  const [tasks, setTasks] = useState<Task[]>(() => seedTasks.map((t) => ({ ...t, pics: [...t.pics], attachments: [...t.attachments] })));
  // Aksi dijalankan berurutan dalam satu render (mis. "jadikan semua tindak lanjut task"), jadi
  // keadaan terbaru dipegang di ref dan state hanya cerminannya untuk render.
  const ref = useRef(tasks);
  const commit = useCallback((next: Task[]) => {
    ref.current = next;
    setTasks(next);
  }, []);

  const statusName = useCallback((id: string) => taskStatuses.find((s) => s.id === id)?.name ?? id, [taskStatuses]);
  const categoryName = useCallback((id: string) => taskCategories.find((c) => c.id === id)?.name ?? id, [taskCategories]);
  const isDone = useCallback((id: string) => taskStatuses.find((s) => s.id === id)?.isDone ?? false, [taskStatuses]);

  const logEntries = useCallback(
    (task: Task, all: Task[], rows: [field: string, oldValue: string, newValue: string][]) => {
      const base = { projectId: task.projectId, projectName: projectNameById(task.projectId), entity: taskEntity(task, all), taskId: task.id };
      const entries: NewAuditEntry[] = rows.map(([field, oldValue, newValue]) => ({ ...base, field, oldValue, newValue }));
      addLog(entries);
    },
    [addLog],
  );

  const diffRows = useCallback(
    (before: Task, after: Task): [string, string, string][] => {
      const rows: [string, string, string][] = [];
      const push = (field: string, o: string, n: string) => o !== n && rows.push([field, o || "—", n || "—"]);
      push("Judul", before.title, after.title);
      push("Deskripsi", truncate(before.description ?? "", 60), truncate(after.description ?? "", 60));
      push("Kategori", categoryName(before.category), categoryName(after.category));
      push("Status", statusName(before.status), statusName(after.status));
      push("PIC", before.pics.join(", "), after.pics.join(", "));
      push("Tanggal mulai", before.startDate, after.startDate);
      push("Tenggat", before.dueDate, after.dueDate);
      push("Progress", `${before.progressPercent}%`, `${after.progressPercent}%`);
      push("Fase", before.phaseId, after.phaseId);
      push("Lampiran", `${before.attachments.length} berkas`, `${after.attachments.length} berkas`);
      return rows;
    },
    [categoryName, statusName],
  );

  const addTask = useCallback<TaskStore["addTask"]>(
    (input) => {
      const all = ref.current;
      const parent = input.parentId ? all.find((t) => t.id === input.parentId) : undefined;
      if (input.parentId && !parent) return fail("Task induk tidak ditemukan.");
      if (parent?.parentId) return fail("Sub task tidak bisa punya sub task lagi.");
      if (!canCreateTask(currentUser, parent?.projectId ?? input.projectId, parent, all, pmoOf)) return fail(parent ? DENY.createSub : DENY.create);
      if (!input.title.trim()) return fail("Judul task wajib diisi.");

      // sub task selalu mewarisi project, fase, dan kategori induknya
      const projectId = parent?.projectId ?? input.projectId;
      const phaseId = parent?.phaseId ?? input.phaseId;
      const category = parent?.category ?? input.category;
      if (!phasesOf(projectId).some((p) => p.id === phaseId)) return fail("Fase harus milik project yang dipilih.");

      const done = isDone(input.status);
      const task: Task = {
        ...input,
        id: newId(),
        projectId,
        phaseId,
        category,
        title: input.title.trim(),
        pics: [...input.pics],
        attachments: [...input.attachments],
        progressPercent: done ? 100 : Math.max(0, Math.min(100, input.progressPercent ?? 0)),
      };

      let next: Task[];
      if (parent) {
        let at = all.findIndex((t) => t.id === parent.id) + 1;
        while (at < all.length && all[at].parentId === parent.id) at++;
        next = [...all.slice(0, at), task, ...all.slice(at)];
        next = refreshParent(next, parent.id, isDone);
      } else {
        const at = endOfColumnIndex(all, task.status);
        next = [...all.slice(0, at), task, ...all.slice(at)];
      }
      commit(next);
      logEntries(task, next, [[parent ? "Sub task" : "Task", "—", "Dibuat"]]);
      return { ok: true, task };
    },
    [commit, isDone, logEntries, phasesOf, pmoOf],
  );

  // Inti perubahan task: dipakai updateTask dan moveTask.
  const applyChange = useCallback(
    (id: string, patch: TaskPatch, opts: ActionOptions | undefined, place?: { beforeId: string | null }): ActionResult => {
      const all = ref.current;
      const cur = all.find((t) => t.id === id);
      if (!cur) return fail("Task tidak ditemukan.");
      if (!canUpdateTask(currentUser, cur, all, pmoOf)) return fail(DENY.edit);

      const kids = all.filter((t) => t.parentId === id);
      const parent = cur.parentId ? all.find((t) => t.id === cur.parentId) : undefined;
      const merged: Task = { ...cur, ...patch, pics: patch.pics ? [...patch.pics] : cur.pics };
      if (!merged.title.trim()) return fail("Judul task wajib diisi.");
      if (parent) {
        // sub task tidak boleh pindah project/fase/kategori sendiri
        merged.projectId = parent.projectId;
        merged.phaseId = parent.phaseId;
        merged.category = parent.category;
      } else if (!phasesOf(merged.projectId).some((p) => p.id === merged.phaseId)) {
        return fail("Fase harus milik project yang dipilih.");
      }

      const becomesDone = isDone(merged.status) && !isDone(cur.status);
      const openKids = becomesDone ? kids.filter((k) => !isDone(k.status)) : [];
      if (openKids.length > 0 && !opts?.completeSubtasks) {
        return fail(`${openKids.length} sub task belum selesai.`, openKids);
      }

      let next = all.map((t) => (t.id === id ? merged : t));
      if (isDone(merged.status)) merged.progressPercent = 100;
      else if (kids.length > 0) merged.progressPercent = parentProgress(kids, isDone); // dihitung dari sub task
      next = next.map((t) => (t.id === id ? merged : t));

      if (!parent && (merged.projectId !== cur.projectId || merged.phaseId !== cur.phaseId || merged.category !== cur.category)) {
        next = next.map((t) =>
          t.parentId === id ? { ...t, projectId: merged.projectId, phaseId: merged.phaseId, category: merged.category } : t,
        );
      }
      if (becomesDone) next = cascadeDone(next, id, merged.status, isDone);
      if (place && !parent && merged.status !== cur.status) {
        next = moveTaskInList(next, id, merged.status, place.beforeId, isDone);
      } else if (place && !parent) {
        next = moveTaskInList(next, id, merged.status, place.beforeId, isDone);
      } else if (!parent && merged.status !== cur.status) {
        next = moveTaskInList(next, id, merged.status, null, isDone); // pindah status lewat form -> dasar kolom baru
      }
      if (parent) next = refreshParent(next, parent.id, isDone);

      commit(next);
      const after = next.find((t) => t.id === id) ?? merged;
      const rows = diffRows(cur, after);
      if (openKids.length > 0) rows.push(["Sub task", `${openKids.length} belum selesai`, "Diselesaikan otomatis"]);
      if (rows.length > 0) logEntries(after, next, rows);
      return { ok: true, completedSubtasks: openKids.length || undefined };
    },
    [commit, diffRows, isDone, logEntries, phasesOf, pmoOf],
  );

  const updateTask = useCallback<TaskStore["updateTask"]>((id, patch, opts) => applyChange(id, patch, opts), [applyChange]);

  const moveTask = useCallback<TaskStore["moveTask"]>(
    (id, status, beforeId = null, opts) => {
      const cur = ref.current.find((t) => t.id === id);
      if (cur && cur.status === status && beforeId === undefined) return { ok: true };
      return applyChange(id, { status }, opts, { beforeId });
    },
    [applyChange],
  );

  const deleteTask = useCallback<TaskStore["deleteTask"]>(
    (id) => {
      const all = ref.current;
      const cur = all.find((t) => t.id === id);
      if (!cur) return fail("Task tidak ditemukan.");
      if (!canUpdateTask(currentUser, cur, all, pmoOf)) return fail(DENY.edit);
      let next = all.filter((t) => t.id !== id && t.parentId !== id);
      if (cur.parentId) next = refreshParent(next, cur.parentId, isDone);
      commit(next);
      const kidCount = all.filter((t) => t.parentId === id).length;
      logEntries(cur, all, [[cur.parentId ? "Sub task" : "Task", "Aktif", kidCount ? `Dihapus (beserta ${kidCount} sub task)` : "Dihapus"]]);
      return { ok: true };
    },
    [commit, isDone, logEntries, pmoOf],
  );

  const setReview = useCallback<TaskStore["setReview"]>(
    (id, patch) => {
      const all = ref.current;
      const cur = all.find((t) => t.id === id);
      if (!cur) return fail("Task tidak ditemukan.");
      if (!canReviewTask(currentUser, cur, pmoOf)) return fail(DENY.review);
      const next = all.map((t) => (t.id === id ? { ...t, ...patch } : t));
      commit(next);
      const rows: [string, string, string][] = [];
      if ((cur.reviewStatus ?? "Belum Direview") !== (patch.reviewStatus ?? cur.reviewStatus ?? "Belum Direview"))
        rows.push(["Status review", cur.reviewStatus ?? "Belum Direview", patch.reviewStatus ?? "Belum Direview"]);
      if ((cur.reviewedBy ?? "") !== (patch.reviewedBy ?? "")) rows.push(["Direview oleh", cur.reviewedBy ?? "—", patch.reviewedBy ?? "—"]);
      if (rows.length === 0) rows.push(["Review", "—", "Diperbarui"]);
      logEntries(cur, next, rows);
      return { ok: true };
    },
    [commit, logEntries, pmoOf],
  );

  const value = useMemo<TaskStore>(
    () => ({ tasks, addTask, updateTask, deleteTask, moveTask, setReview }),
    [tasks, addTask, updateTask, deleteTask, moveTask, setReview],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTaskStore(): TaskStore {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTaskStore harus dipakai di dalam <TaskStoreProvider>.");
  return ctx;
}

/** Sub task dari satu task induk (urut seperti di daftar task). */
export function useSubtasks(parentId?: string): Task[] {
  const { tasks } = useTaskStore();
  return useMemo(() => (parentId ? tasks.filter((t) => t.parentId === parentId) : []), [tasks, parentId]);
}

// withStatus diekspor ulang supaya satu tempat untuk aturan "baru selesai -> 100%".
export { withStatus };
