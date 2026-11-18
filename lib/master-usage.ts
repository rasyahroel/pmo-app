import { projects, type AppUser, type Employee } from "@/lib/mock-data";
import type { ListKey, SubditDef } from "@/lib/master-store";

// Berapa banyak data yang memakai sebuah nilai master. Dipakai Master Data untuk mengunci
// ubah-nama/hapus nilai yang masih dipakai (data menyimpan NAMA-nya, bukan ID — setelah backend
// memakai ID, kunci ini tidak diperlukan lagi).
const allPhases = () => projects.flatMap((p) => p.phases);

export function listUsage(key: ListKey, name: string, ctx: { employees: Employee[]; subdits: SubditDef[]; users: AppUser[] }): number {
  switch (key) {
    case "directorates":
      return (
        projects.filter((p) => p.directorate === name).length +
        ctx.employees.filter((e) => e.directorate === name).length +
        ctx.users.filter((u) => u.directorate === name).length +
        ctx.subdits.filter((s) => s.directorate === name).length
      );
    case "vendors":
      return projects.filter((p) => p.vendor === name).length;
    case "projectCategories":
      return projects.filter((p) => p.category === name).length;
    case "projectPriorities":
      return projects.filter((p) => p.priority === name).length;
    case "dependencySystems":
      return allPhases().flatMap((ph) => ph.dependencies).filter((d) => d.system === name).length;
    case "approvalLevels":
      return allPhases().flatMap((ph) => ph.documents.flatMap((d) => d.approvers)).filter((a) => a.level === name).length;
    case "projectRoles":
      return (
        ctx.employees.filter((e) => e.roles.includes(name)).length +
        projects.flatMap((p) => [...p.pmo, ...p.developers, ...p.users]).filter((m) => m.role === name).length
      );
  }
}

export const USAGE_NOUN: Record<ListKey, string> = {
  directorates: "data (project, pegawai, user, subdit)",
  vendors: "project",
  projectCategories: "project",
  projectPriorities: "project",
  dependencySystems: "dependency",
  approvalLevels: "approver dokumen",
  projectRoles: "pegawai/anggota tim",
};

export const subditUsage = (s: SubditDef, employees: Employee[], users: AppUser[]) =>
  projects.filter((p) => p.directorate === s.directorate && p.subdirectorate === s.subdirectorate).length +
  employees.filter((e) => e.directorate === s.directorate && e.subdirectorate === s.subdirectorate).length +
  users.filter((u) => u.directorate === s.directorate && u.subdirectorate === s.subdirectorate).length;

export const docTypeUsage = (type: string) => allPhases().flatMap((ph) => ph.documents).filter((d) => d.type === type).length;

export const employeeUsage = (id: string) =>
  projects.flatMap((p) => [...p.pmo, ...p.developers, ...p.users]).filter((m) => m.employeeId === id).length;
