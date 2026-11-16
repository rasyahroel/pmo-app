// Hak akses Daftar Pustaka — fungsi murni.
//
//  - Bagian umum (Alur & Panduan Menu, Hak Akses): semua pengguna boleh membaca.
//  - Bagian teknis (Skema Database, API): hanya Administrator dan pengguna yang masuk daftar
//    "Akses Teknis" (developer tertentu).
//  - Tambah / ubah / hapus artikel: "Pengelola Pustaka" = Administrator + daftar Akses Teknis
//    (hanya untuk bagian yang boleh mereka lihat).
//  - Mengatur daftar Akses Teknis: hanya Administrator.
//
// PENTING: ini UX di frontend. Karena isi artikel dimuat ke browser, pembatasan sebenarnya untuk
// bagian teknis HARUS dilakukan backend (endpoint /library/articles?section=schema|api mengembalikan
// 403 bila bukan developer yang diizinkan).
import type { AppUser } from "./mock-data";
import { isAdministrator } from "./access";

export type LibrarySectionKey = "flow" | "access" | "schema" | "api";

export const LIBRARY_SECTIONS: { key: LibrarySectionKey; label: string; description: string; restricted: boolean }[] = [
  { key: "flow", label: "Alur & Panduan Menu", description: "Penjelasan tiap menu, cara pengisian, dan alur kerja.", restricted: false },
  { key: "access", label: "Hak Akses", description: "Siapa boleh melakukan apa di setiap menu.", restricted: false },
  { key: "schema", label: "Skema Database", description: "Rancangan tabel & relasi. Khusus developer tertentu.", restricted: true },
  { key: "api", label: "API", description: "Daftar endpoint, request & response. Khusus developer tertentu.", restricted: true },
];

export const isRestrictedSection = (s: LibrarySectionKey) => LIBRARY_SECTIONS.find((x) => x.key === s)?.restricted ?? false;

export function hasTechnicalAccess(user: AppUser, techUserIds: string[]): boolean {
  return isAdministrator(user) || techUserIds.includes(user.id);
}

export function canViewSection(user: AppUser, section: LibrarySectionKey, techUserIds: string[]): boolean {
  return !isRestrictedSection(section) || hasTechnicalAccess(user, techUserIds);
}

export function canManageLibrary(user: AppUser, techUserIds: string[]): boolean {
  return hasTechnicalAccess(user, techUserIds);
}

export function canManageTechAccess(user: AppUser): boolean {
  return isAdministrator(user);
}
