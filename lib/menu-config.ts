// Plain navigation data — no icon JSX here so this module stays safe to
// import from server components (icons are attached separately in
// menu-icons.tsx, which is client-only).
export type MenuNode = {
  key: string;
  label: string;
  path: string;
  description: string;
  children?: MenuNode[];
  hidden?: boolean; // halaman yang tidak tampil di sidebar (mis. Notifikasi, dibuka dari ikon lonceng)
};

export const MENU_CONFIG: MenuNode[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    path: "/dashboard",
    description: "Ringkasan seluruh project, notifikasi, dan progres terkini.",
  },
  {
    key: "projects",
    label: "Project",
    path: "/projects",
    description:
      "Daftar dan detail project: dokumen, fase, environment, PIC, dan status.",
  },
  {
    key: "tasks",
    label: "Task Board",
    path: "/tasks",
    description:
      "Papan tugas per fase — development, migrasi/sinkronisasi, testing, dan to-do meeting.",
  },
  {
    key: "meetings",
    label: "Rapat",
    path: "/meetings",
    description: "Jadwal dan notulen rapat terkait dokumen, development, atau testing.",
  },
  {
    key: "timeline",
    label: "Timeline Project",
    path: "/timeline",
    description: "Gantt tahapan SDLC per project maupun seluruh project, dengan filter.",
  },
  {
    key: "testing",
    label: "Pengujian",
    path: "/testing",
    description: "Test script dan progres tiap jenis pengujian: IUT, SIT, UAT, TO, Pentest.",
  },
  {
    key: "reports",
    label: "Laporan",
    path: "/reports",
    description: "Ringkasan status seluruh project dalam tampilan kalender dan tabel.",
  },
  {
    key: "audit-trail",
    label: "Riwayat Perubahan",
    path: "/audit-trail",
    description: "Jejak audit perubahan timeline, PIC, dan status — khusus lihat & ekspor.",
  },
  {
    key: "library",
    label: "Daftar Pustaka",
    path: "/library",
    description: "Panduan penggunaan aplikasi.",
  },
  {
    key: "master-data",
    label: "Master Data",
    path: "/master-data",
    description: "Kelola parameter aplikasi: jenis dokumen, jenis testing, divisi, dan lainnya.",
  },
  {
    key: "user-management",
    label: "Manajemen User",
    path: "/user-management",
    description: "Kelola pengguna serta role & hak akses per menu.",
    children: [
      {
        key: "user-management-users",
        label: "Pengguna",
        path: "/user-management/users",
        description: "Daftar pengguna aplikasi.",
      },
      {
        key: "user-management-roles",
        label: "Role & Permission",
        path: "/user-management/roles",
        description: "Atur role dan akses per menu.",
      },
    ],
  },
];

// Halaman tanpa sidebar. Tidak masuk matriks permission (selalu boleh untuk yang sudah masuk).
export const EXTRA_PAGES: MenuNode[] = [
  { key: "notifications", label: "Notifikasi", path: "/notifications", description: "Semua pemberitahuan untukmu: penugasan, komentar, review, rapat, dan pengingat.", hidden: true },
  { key: "profile", label: "Profil Saya", path: "/profile", description: "Data akun, keamanan, dan ganti password.", hidden: true },
];

/** Kunci menu tingkat atas (kunci di matriks permission) untuk sebuah path. */
export function menuKeyOfPath(path: string): string | undefined {
  for (const node of MENU_CONFIG) {
    if (node.path === path || node.children?.some((c) => c.path === path)) return node.key;
  }
  return undefined;
}

export function findMenuByPath(path: string): MenuNode | undefined {
  const extra = EXTRA_PAGES.find((n) => n.path === path);
  if (extra) return extra;
  for (const node of MENU_CONFIG) {
    if (node.path === path) return node;
    if (node.children) {
      const child = node.children.find((c) => c.path === path);
      if (child) return child;
    }
  }
  return undefined;
}
