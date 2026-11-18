import { employees as seed, type Employee } from "./mock-data";

// Salinan daftar Master Pegawai yang selalu terbaru, untuk fungsi hak akses murni (tanpa React) yang
// perlu rantai AppUser <- Employee.userId <- Member.employeeId. Diperbarui oleh master-store setiap
// pegawai berubah, sehingga menautkan akun ke pegawai di halaman Pengguna langsung berlaku.
// Setelah backend ada, rantai ini dihitung di server dan file ini tidak diperlukan.
let list: Employee[] = seed;

export const getEmployees = (): Employee[] => list;
export const setEmployeeRegistry = (next: Employee[]) => {
  list = next;
};
