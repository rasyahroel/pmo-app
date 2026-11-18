import { appUsers, type AppUser, type Project } from "./mock-data";
import { getEmployees } from "./employee-registry";

// ---------------------------------------------------------------------------
// FONDASI AKSES PROJECT (belum dipakai di UI — belum ada auth).
//
// Aturan: sebuah project cuma bisa diakses oleh
//   1. akun yang membuat project itu (Project.createdBy), atau
//   2. akun yang jadi anggota tim project itu sebagai PMO / Developer.
//      Anggota role "User" (unit bisnis) & developer vendor cuma data, gak login.
//   3. Administrator: bisa lihat SEMUA project (petinggi PMO / developer yang memegang
//      aplikasi ini — siapa orangnya bebas, yang penting akunnya punya role "Administrator").
//
// Rantai penghubungnya:
//   AppUser.id  <-  Employee.userId  <-  Member.employeeId  (ada di project.pmo / project.developers)
//
// File ini cuma "spesifikasi hidup" aturan di atas. Yang beneran menegakkan aturan
// nanti harus BACKEND (Go) — sembunyiin di frontend itu cuma UX, bukan keamanan.
// ---------------------------------------------------------------------------

// Sementara belum ada login: pengguna awal = Administrator (agar semua menu terbuka). Pengguna aktif
// sebenarnya dipegang lib/acting-user.tsx (bisa diganti lewat menu pengguna di header untuk simulasi
// role). Hapus ini begitu auth jadi.
export const adminUser: AppUser = appUsers.find((u) => u.roles.includes("Administrator")) ?? appUsers[0];
export const currentUser: AppUser = adminUser;

export function isAdministrator(user: AppUser | undefined): boolean {
  return !!user && user.active && user.roles.includes("Administrator");
}

export function canAccessProject(user: AppUser | undefined, project: Project): boolean {
  if (!user || !user.active) return false;
  if (isAdministrator(user)) return true;
  if (project.createdBy === user.id) return true;
  const employee = getEmployees().find((e) => e.userId === user.id);
  if (!employee) return false;
  return [...project.pmo, ...project.developers].some((m) => m.employeeId === employee.id);
}

export function getAccessibleProjects(user: AppUser | undefined, all: Project[]): Project[] {
  return all.filter((p) => canAccessProject(user, p));
}
