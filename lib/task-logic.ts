// Logika murni (tanpa React/DOM) untuk Task Board: urutan task, subtask, dan pemindahan antar kolom.
// Dipisah dari komponen supaya mudah diuji, dan supaya aturannya sama persis dengan yang
// nanti dikerjakan backend.
import type { Task } from "./mock-data";

// `isDone(statusId)` = apakah status itu berjenis "done" (ditentukan Master Data, bukan nama status).
export type IsDone = (statusId: string) => boolean;

type ProgressLike = Pick<Task, "status" | "progressPercent">;

// ---------------------------------------------------------------------------
// Task induk & subtask (disimpan datar dalam satu array; subtask punya parentId)
// ---------------------------------------------------------------------------

export const topLevel = (tasks: Task[]): Task[] => tasks.filter((t) => !t.parentId);

export function groupSubtasks(tasks: Task[]): Map<string, Task[]> {
  const map = new Map<string, Task[]>();
  for (const t of tasks) {
    if (!t.parentId) continue;
    const list = map.get(t.parentId);
    if (list) list.push(t);
    else map.set(t.parentId, [t]);
  }
  return map;
}

// Progress task induk = rata-rata progress subtask (subtask berstatus "done" dihitung 100).
export function parentProgress(children: ProgressLike[], isDone: IsDone): number {
  if (children.length === 0) return 0;
  const sum = children.reduce((acc, c) => acc + (isDone(c.status) ? 100 : c.progressPercent), 0);
  return Math.round(sum / children.length);
}

// Hitung ulang progress task induk setelah subtask-nya berubah.
export function refreshParent(tasks: Task[], parentId: string, isDone: IsDone): Task[] {
  const children = tasks.filter((t) => t.parentId === parentId);
  if (children.length === 0) return tasks;
  const progress = parentProgress(children, isDone);
  return tasks.map((t) => (t.id === parentId && t.progressPercent !== progress ? { ...t, progressPercent: progress } : t));
}

// Task induk dipindah ke status "done" -> semua subtask yang belum selesai ikut selesai (100%).
export function cascadeDone(tasks: Task[], parentId: string, statusId: string, isDone: IsDone): Task[] {
  return tasks.map((t) =>
    t.parentId === parentId && !isDone(t.status) ? { ...t, status: statusId, progressPercent: 100 } : t,
  );
}

// ---------------------------------------------------------------------------
// Urutan task
//
// Urutan tampil dalam satu kolom = urutan task induk itu di array `tasks` (yang berstatus sama).
// Memindah task = "taruh di kolom X, tepat SEBELUM task Y" (Y = null -> paling bawah).
// Bentuk ini sengaja dipilih karena tidak bergantung pada filter yang sedang aktif di layar
// (project/fase/pencarian) dan gampang dipetakan ke backend:
//   PATCH /tasks/{id}/move  { "statusId": "...", "beforeTaskId": "..." | null }
// Backend lalu menghitung kolom `position` (mis. fractional index) — FE tidak perlu tahu.
// ---------------------------------------------------------------------------

// Aturan status: task yang BARU masuk status "done" otomatis 100%.
export function withStatus(task: Task, statusId: string, isDone: IsDone): Task {
  const justDone = isDone(statusId) && !isDone(task.status);
  return { ...task, status: statusId, progressPercent: justDone ? 100 : task.progressPercent };
}

// Posisi sisip "di dasar kolom": setelah task induk terakhir berstatus itu (beserta subtask-nya),
// atau di akhir array kalau kolomnya kosong.
export function endOfColumnIndex(list: Task[], statusId: string): number {
  let last = -1;
  list.forEach((t, i) => {
    if (!t.parentId && t.status === statusId) last = i;
  });
  if (last < 0) return list.length;
  const lastId = list[last].id;
  let index = last + 1;
  while (index < list.length && list[index].parentId === lastId) index++;
  return index;
}

export function moveTaskInList(
  tasks: Task[],
  id: string,
  statusId: string,
  beforeId: string | null,
  isDone: IsDone,
): Task[] {
  const current = tasks.find((t) => t.id === id);
  if (!current) return tasks;
  const moved = withStatus(current, statusId, isDone);
  const rest = tasks.filter((t) => t.id !== id);

  let index = beforeId ? rest.findIndex((t) => t.id === beforeId) : -1;
  if (index < 0) index = endOfColumnIndex(rest, statusId);
  return [...rest.slice(0, index), moved, ...rest.slice(index)];
}

// ---------------------------------------------------------------------------
// State drag & drop (kolom -> daftar id task yang sedang tampil)
// ---------------------------------------------------------------------------

export type Columns = Record<string, string[]>;

const COLUMN_PREFIX = "col:";
export const columnId = (statusId: string) => `${COLUMN_PREFIX}${statusId}`;
export const isColumnId = (id: string) => id.startsWith(COLUMN_PREFIX);
export const statusOfColumnId = (id: string) => id.slice(COLUMN_PREFIX.length);

// `tasks` = task induk yang sedang tampil; `statusIds` = urutan kolom (dari Master Data).
export function buildColumns(tasks: Task[], statusIds: string[]): Columns {
  const cols: Columns = {};
  for (const s of statusIds) cols[s] = tasks.filter((t) => t.status === s).map((t) => t.id);
  return cols;
}

export function findColumn(cols: Columns, id: string): string | undefined {
  if (isColumnId(id)) return statusOfColumnId(id);
  return Object.keys(cols).find((s) => cols[s].includes(id));
}

function reorder<T>(list: T[], from: number, to: number): T[] {
  const copy = list.slice();
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}

// Dipanggil terus selama drag: kartu "pindah" ke kolom yang sedang di-hover (pratinjau langsung).
export function moveAcross(cols: Columns, activeId: string, overId: string, isBelowOver: boolean): Columns {
  const from = findColumn(cols, activeId);
  const to = findColumn(cols, overId);
  if (!from || !to || from === to || !cols[from] || !cols[to]) return cols;

  const target = cols[to];
  let index: number;
  if (isColumnId(overId)) {
    index = target.length; // dilepas di area kolom (bukan di atas kartu) -> paling bawah
  } else {
    const overIndex = target.indexOf(overId);
    index = overIndex < 0 ? target.length : overIndex + (isBelowOver ? 1 : 0);
  }
  return {
    ...cols,
    [from]: cols[from].filter((id) => id !== activeId),
    [to]: [...target.slice(0, index), activeId, ...target.slice(index)],
  };
}

// Dipanggil saat dilepas: kalau kartu masih di kolom yang sama dengan `over`, atur urutannya.
export function settleDrop(cols: Columns, activeId: string, overId?: string | null): Columns {
  if (!overId || overId === activeId) return cols;
  const from = findColumn(cols, activeId);
  const to = findColumn(cols, overId);
  if (!from || from !== to || !cols[from]) return cols;

  const list = cols[from];
  const oldIndex = list.indexOf(activeId);
  const newIndex = isColumnId(overId) ? list.length - 1 : list.indexOf(overId);
  if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return cols;
  return { ...cols, [from]: reorder(list, oldIndex, newIndex) };
}

// Hasil akhir drop dalam bentuk yang dipakai store: kolom tujuan + id kartu tepat di bawahnya.
export function dropTarget(
  cols: Columns,
  activeId: string,
): { statusId: string; beforeId: string | null } | undefined {
  const statusId = findColumn(cols, activeId);
  if (!statusId || !cols[statusId]) return undefined;
  const list = cols[statusId];
  const i = list.indexOf(activeId);
  return { statusId, beforeId: list[i + 1] ?? null };
}
