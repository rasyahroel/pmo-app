// Aturan hak akses task — fungsi murni (tanpa React) supaya mudah dibaca/diuji dan gampang
// dipindah ke backend.
//
//  - PIC task (atau PIC task induk, untuk sub task) boleh Create/Read/Update/Delete task itu.
//  - PMO yang memegang project boleh CRUD semua task di project itu (termasuk review).
//  - Administrator boleh semuanya.
//  - Orang lain hanya bisa melihat.
//  - Komentar: pemilik komentar boleh ubah/hapus komentarnya sendiri; PMO project (dan
//    Administrator) boleh menghapus komentar orang lain di task project-nya (moderasi).
//    Siapa pun yang punya akses ke project (atau PIC task itu) boleh berkomentar.
//  - Membuat task BARU (induk): PMO project / Administrator. PIC boleh menambah sub task di
//    task miliknya.
//  - Review task: PMO project / Administrator (PIC tidak mereview pekerjaannya sendiri).
//
// PENTING: ini hanya UX di frontend. Penegak sebenarnya harus BACKEND (cek di tiap endpoint).
// Sekarang PIC disimpan sebagai NAMA teks, jadi pencocokan lewat nama; di backend sebaiknya
// pakai employeeId.
import { employees, projects, type AppUser, type Member, type Task } from "./mock-data";
import { canAccessProject, isAdministrator } from "./access";

export type PmoLookup = (projectId: string) => Member[];

export const DENY = {
  edit: "Kamu bukan PIC task ini atau PMO project-nya, jadi tidak bisa mengubahnya.",
  create: "Hanya PMO project yang bisa membuat task baru.",
  createSub: "Hanya PIC task ini atau PMO project yang bisa menambah sub task.",
  review: "Hanya PMO project yang bisa mereview task.",
  comment: "Kamu tidak punya akses ke project ini, jadi tidak bisa berkomentar.",
  commentOwn: "Komentar hanya bisa diubah oleh pemiliknya.",
  commentDelete: "Komentar hanya bisa dihapus oleh pemiliknya atau PMO project.",
} as const;

const norm = (s: string) => s.trim().toLowerCase();

function aliasesOf(user: AppUser): Set<string> {
  // nama akun + nama pegawai yang terhubung ke akun ini (Employee.userId)
  return new Set([user.name, ...employees.filter((e) => e.userId === user.id).map((e) => e.name)].map(norm));
}

/** PMO yang memegang project (rantai: AppUser <- Employee.userId <- Member.employeeId). */
export function isProjectPmo(user: AppUser, projectId: string, pmoOf: PmoLookup): boolean {
  const empIds = new Set(employees.filter((e) => e.userId === user.id).map((e) => e.id));
  return pmoOf(projectId).some((m) => !!m.employeeId && empIds.has(m.employeeId));
}

export function canManageProject(user: AppUser, projectId: string, pmoOf: PmoLookup): boolean {
  return isAdministrator(user) || isProjectPmo(user, projectId, pmoOf);
}

/** PIC task ini, atau PIC task induknya kalau ini sub task. */
export function isTaskPic(user: AppUser, task: Task, all: Task[]): boolean {
  const mine = aliasesOf(user);
  const parent = task.parentId ? all.find((t) => t.id === task.parentId) : undefined;
  return [...task.pics, ...(parent?.pics ?? [])].some((n) => mine.has(norm(n)));
}

export function canUpdateTask(user: AppUser, task: Task, all: Task[], pmoOf: PmoLookup): boolean {
  return canManageProject(user, task.projectId, pmoOf) || isTaskPic(user, task, all);
}
export const canDeleteTask = canUpdateTask;

export function canCreateTask(user: AppUser, projectId: string, parent: Task | undefined, all: Task[], pmoOf: PmoLookup): boolean {
  return parent ? canUpdateTask(user, parent, all, pmoOf) : canManageProject(user, projectId, pmoOf);
}

export function canReviewTask(user: AppUser, task: Task, pmoOf: PmoLookup): boolean {
  return canManageProject(user, task.projectId, pmoOf);
}

export function canCommentOnTask(user: AppUser, task: Task, all: Task[], pmoOf: PmoLookup): boolean {
  if (canUpdateTask(user, task, all, pmoOf)) return true;
  const project = projects.find((p) => p.id === task.projectId);
  return !!project && canAccessProject(user, { ...project, pmo: pmoOf(project.id) });
}

export const isCommentOwner = (user: AppUser, authorName: string) => norm(user.name) === norm(authorName);

export function canDeleteComment(user: AppUser, authorName: string, task: Task, pmoOf: PmoLookup): boolean {
  return isCommentOwner(user, authorName) || canManageProject(user, task.projectId, pmoOf);
}

/** Boleh membuat task di minimal satu project? (untuk menampilkan tombol "Tambah Task") */
export function canCreateAnywhere(user: AppUser, pmoOf: PmoLookup): boolean {
  return isAdministrator(user) || projects.some((p) => isProjectPmo(user, p.id, pmoOf));
}
