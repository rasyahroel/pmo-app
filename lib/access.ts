import { appUsers, employees, type AppUser, type Project } from "./mock-data";

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

// Sementara belum ada login: anggap "Rani Kusuma" yang lagi login (sama kayak header AppShell).
// Hapus & ganti dengan user dari session begitu auth jadi.
export const currentUser: AppUser = appUsers[0];

export function isAdministrator(user: AppUser | undefined): boolean {
  return !!user && user.active && user.roles.includes("Administrator");
}

export function canAccessProject(user: AppUser | undefined, project: Project): boolean {
  if (!user || !user.active) return false;
  if (isAdministrator(user)) return true;
  if (project.createdBy === user.id) return true;
  const employee = employees.find((e) => e.userId === user.id);
  if (!employee) return false;
  return [...project.pmo, ...project.developers].some((m) => m.employeeId === employee.id);
}

export function getAccessibleProjects(user: AppUser | undefined, all: Project[]): Project[] {
  return all.filter((p) => canAccessProject(user, p));
}
