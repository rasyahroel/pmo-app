// Siapa boleh melihat entri Riwayat Perubahan — fungsi murni.
//
// Riwayat dibuat otomatis oleh sistem dan HANYA DILIHAT (tidak ada tambah/ubah/hapus). Yang boleh
// dilihat seseorang:
//  1. Administrator: semua.
//  2. Anggota project (pembuat, PMO, Developer): semua entri project itu.
//  3. PIC sebuah task: entri task itu dan sub task-nya, walau ia bukan anggota project.
//  4. Entri yang ia lakukan sendiri.
//  Entri tanpa project (mis. Daftar Pustaka) hanya terlihat oleh Administrator dan pelakunya.
//
// PENTING: ini UX di frontend. Backend harus menyaring dengan aturan yang sama di query
// (GET /audit-logs), bukan mengirim semuanya lalu menyaring di browser.
import type { AppUser, Member, Project, Task } from "./mock-data";
import { canAccessProject, isAdministrator } from "./access";
import { isTaskPic } from "./task-permissions";
import type { AuditEntry } from "./audit-store";

export type AuditScope = {
  projects: Project[];
  tasks: Task[];
  pmoOf: (projectId: string) => Member[];
  developersOf: (projectId: string) => Member[];
};

const norm = (s: string) => s.trim().toLowerCase();

export function entryProjectId(entry: AuditEntry, projects: Project[]): string | undefined {
  return entry.projectId ?? projects.find((p) => p.name === entry.projectName)?.id;
}

export function canViewAuditEntry(user: AppUser, entry: AuditEntry, scope: AuditScope): boolean {
  if (isAdministrator(user)) return true;

  const pid = entryProjectId(entry, scope.projects);
  const project = pid ? scope.projects.find((p) => p.id === pid) : undefined;
  if (project && canAccessProject(user, { ...project, pmo: scope.pmoOf(project.id), developers: scope.developersOf(project.id) })) {
    return true;
  }

  if (entry.taskId) {
    const task = scope.tasks.find((t) => t.id === entry.taskId);
    if (task && isTaskPic(user, task, scope.tasks)) return true;
  }

  return norm(entry.changedBy) === norm(user.name);
}

/** Jenis objek dari label entitas: "Task · …" -> "Task", "Sub task · …" -> "Sub task". */
export function entryKind(entry: Pick<AuditEntry, "entity">): string {
  const i = entry.entity.indexOf(" · ");
  return i > 0 ? entry.entity.slice(0, i) : "Lainnya";
}
