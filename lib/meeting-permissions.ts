// Hak akses Rapat — fungsi murni.
//
//  - Melihat rapat: Administrator, anggota project (pembuat, PMO, Developer), peserta rapat, dan
//    pembuat rapat.
//  - Membuat rapat baru: PMO project / Administrator.
//  - Mengubah, menghapus, mengatur peserta, mengunggah hasil (MOM), dan mengubah tindak lanjut:
//    PMO project, pembuat rapat, dan Administrator.
//  - Menjadikan tindak lanjut sebagai task mengikuti aturan task: hanya PMO project / Administrator
//    yang boleh membuat task induk.
//
// PENTING: ini UX di frontend. Backend wajib mengulang pemeriksaan ini di setiap endpoint.
import { type AppUser, type Member, type Project } from "./mock-data";
import { getEmployees } from "./employee-registry";
import { canAccessProject, isAdministrator } from "./access";
import { canManageProject, type PmoLookup } from "./task-permissions";
import type { MeetingRecord } from "./meeting-store";

export const MEETING_DENY = {
  create: "Hanya PMO project yang bisa menjadwalkan rapat.",
  manage: "Hanya PMO project atau pembuat rapat yang bisa mengubah rapat ini.",
} as const;

const norm = (s: string) => s.trim().toLowerCase();

export type MeetingScope = {
  projects: Project[];
  pmoOf: PmoLookup;
  developersOf: (projectId: string) => Member[];
};

function isParticipant(user: AppUser, m: MeetingRecord): boolean {
  const names = new Set([user.name, ...getEmployees().filter((e) => e.userId === user.id).map((e) => e.name)].map(norm));
  const empIds = new Set(getEmployees().filter((e) => e.userId === user.id).map((e) => e.id));
  return m.participants.some((p) => (p.employeeId && empIds.has(p.employeeId)) || (!p.external && names.has(norm(p.name))));
}

export function canViewMeeting(user: AppUser, m: MeetingRecord, scope: MeetingScope): boolean {
  if (isAdministrator(user) || m.createdBy === user.id || isParticipant(user, m)) return true;
  const project = scope.projects.find((p) => p.id === m.projectId);
  return !!project && canAccessProject(user, { ...project, pmo: scope.pmoOf(project.id), developers: scope.developersOf(project.id) });
}

export function canManageMeeting(user: AppUser, m: MeetingRecord, pmoOf: PmoLookup): boolean {
  return canManageProject(user, m.projectId, pmoOf) || m.createdBy === user.id;
}

export const canCreateMeeting = (user: AppUser, projectId: string, pmoOf: PmoLookup) => canManageProject(user, projectId, pmoOf);
