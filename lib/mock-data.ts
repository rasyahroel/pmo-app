// Dummy data layer.
// Mirrors the ERD we designed (projects -> phases -> documents / development /
// testing / tasks) but kept as plain in-memory arrays for now, since the
// backend (Golang + PostgreSQL) isn't built yet. Swap this file for real API
// calls later without touching the pages, as long as the shapes stay the same.

export type ProjectStatus = "Active" | "Hold" | "Cancelled";
export type PhaseStage = "Dokumen" | "Development" | "Testing" | "Live";
export type DocStatus = "Draft" | "Review" | "Approved" | "Rejected";
// Status & kategori task dikelola di Master Data (Status Task / Kategori Task) — bukan union tetap.
// Task menyimpan ID-nya, jadi mengganti nama di master tidak merusak task yang sudah ada.
export type TaskStatus = string;
export type TestStatus = "Not Started" | "On Going" | "Passed" | "Failed";
export type TestType = "IUT" | "SIT" | "UAT" | "TO" | "Pentest";
export type DocType = "BR" | "CR" | "FSD" | "PO";

export type Member = {
  id: string;
  name: string;
  role: "PMO" | "Developer" | "User" | "QA" | "Security";
  isPrimary: boolean;
  employeeId?: string; // relasi ke Employee.id (hanya untuk anggota internal yang dipilih dari master pegawai)
  directorate?: string; // direktorat asal orang ini (bisa beda dari direktorat pengaju project)
  subdirectorate?: string;
  // Developer vendor (dan User) diinput manual, bukan dipilih dari master pegawai (appUsers).
  // Kalau isVendor true, UI cukup nampilin nama aja (field lain di-hide), tapi tetep
  // disimpan di skema biar konsisten kalau suatu saat mau dilengkapi.
  isVendor?: boolean;
};

export type ApprovalStatus = "Menunggu" | "Disetujui" | "Ditolak";

export type Approver = {
  id: string;
  name: string;
  level: string; // e.g. "Manager", "Kepala Divisi" — from masterApprovalLevels
  status: ApprovalStatus; // "Disetujui" = approver ini udah approve & TTD-nya dianggap selesai
  date?: string;
};

export type DocumentItem = {
  id: string;
  type: DocType;
  status: DocStatus;
  approvalLevel: string; // ringkasan, e.g. "2/3 approved" — dipakai di tabel utama
  approvers: Approver[];
  sourceType: "Link" | "Upload";
  url: string; // link eksternal (mis. Gdrive), atau nama file kalau sourceType Upload
};
// Kategori environment/IP — dipisah biar satu fase bisa punya banyak entri
// per kategori (banyak repo modular, banyak developer beda segmen IP,
// banyak lokasi staging, banyak DB, dst), bukan cuma satu value per tipe.
export type EnvironmentCategory =
  | "Git Repository"
  | "Local Developer"
  | "Staging"
  | "Production"
  | "Database"
  | "SSH"
  | "User"; // IP milik user — biasanya baru diisi menjelang UAT/testing lanjutan

export type EnvironmentItem = {
  id: string;
  category: EnvironmentCategory;
  label: string; // nama bebas: lokasi ("Cokro", "Kwitang"), nama developer/user, nama modul/repo, nama DB, dst
  value: string; // IP, host, URL, atau path repo
  port?: string; // dipakai Staging/Production/Database/SSH — gak relevan buat Local Developer/User
  segment?: string; // khusus Local Developer/User — lokasi/segmen IP (mis. "Kwitang", "Cokro") kalau 1 orang punya beberapa IP beda segmen
  isTemplate?: boolean; // khusus Git Repository — ini repo template atau bukan (gak semua project punya)
  mainBranch?: string; // khusus Git Repository — branch utama, mis. "main", "develop"
  dns?: string; // khusus Staging/Production — domain publik kalau environment ini udah bisa diakses online (bukan DNS per repo git)
  dbName?: string; // khusus Database — nama database-nya
  containerName?: string; // khusus SSH — kalau pakai docker, nama/ID container-nya
  note?: string;
  // Spesifikasi server — relevan buat Staging/Production/SSH/Database.
  cpu?: string; // mis. "4 vCPU"
  memory?: string; // mis. "8 GB"
  storage?: string; // mis. "100 GB SSD"
  extraSpecs?: { id: string; label: string; value: string }[]; // spesifikasi tambahan bebas (tombol "Tambah Lainnya")
};

export type MigrationRecon = {
  id: string;
  sourceSystem: string; // mis. Core Banking, T24, vendor X
  dbName?: string;
  tableName?: string;
  description: string;
  status: "Belum Mulai" | "On Going" | "Rekon Selesai";
  reportStatus: "Belum Ada" | "Draft" | "Final"; // status Laporan Hasil (pengganti "BA")
  reportUrl?: string; // link atau nama file laporan hasil, bisa diklik
  pic: string; // PIC utama/penanggung jawab
  team?: string[]; // orang-orang lain yang ikut ngerjain, walau PIC cuma 1
  startDate?: string;
  endDate?: string;
};

// Ketergantungan ke sistem lain (Axway, Fiorano, Big Data, dst) — satu fase
// bisa punya beberapa dependency, dan tiap dependency bisa punya banyak
// endpoint (IP/host tujuan) karena satu integrasi kadang nembak ke banyak alamat.
export type DependencyEndpoint = {
  id: string;
  label: string; // mis. "Fiorano ESB - Prod", "Axway Gateway"
  value: string; // IP/host/URL tujuan
  note?: string;
};

export type Dependency = {
  id: string;
  system: string; // dari masterDependencySystems, atau "Lainnya" + customSystemName
  customSystemName?: string;
  serviceName?: string; // nama service/API spesifik yang dipakai di sistem itu, mis. "Transfer Antar Bank (RTGS)", "Inquiry Saldo"
  description: string; // penjelasan koneksinya ngapain/kemana
  endpoints: DependencyEndpoint[];
};

export type HoldRecord = {
  id: string;
  heldAt: string;
  reason: string;
  heldBy: string;
  resumedAt?: string;
  resumedBy?: string;
};

export type TestStage = {
  id: string;
  type: TestType;
  status: TestStatus;
  progressPercent: number;
  pic: string;
};

export type Phase = {
  id: string;
  name: string; // "Fase 1"
  stage: PhaseStage;
  progressPercent: number;
  documentProgress: number;
  developmentProgress: number;
  testingProgress: number;
  documents: DocumentItem[];
  testStages: TestStage[];
  startDate: string;
  targetLiveDate: string;
  previousPhaseId?: string; // relasi ke fase sebelumnya yang jadi rujukan
  environments: EnvironmentItem[];
  migrations: MigrationRecon[];
  dependencies: Dependency[];
  scope?: string[]; // ringkasan scope fase ini, per poin (bullet) — biar rapi kalau scope-nya banyak
  note?: string; // catatan tambahan perihal scope, dll
};

export type ProjectCategory = "Support" | "Regulator" | "Bisnis";
export type ProjectPriority = "Rendah" | "Sedang" | "Tinggi";

export type Project = {
  id: string;
  crNumber?: string; // nomor CR — ini yang utama/lebih dipakai PMO
  brNumber?: string; // nomor BR — biasanya terbit lebih dulu, sebelum CR ada
  name: string;
  directorate: string;
  subdirectorate: string;
  category: ProjectCategory;
  priority: ProjectPriority;
  status: ProjectStatus;
  pmo: Member[];
  developers: Member[];
  users: Member[];
  gitRepo: string;
  phases: Phase[];
  overallProgress: number;
  vendor?: string; // dari masterVendors, opsional — belum tentu ada di awal
  // Nomor & status PO disiapkan di skema untuk kebutuhan nanti, tapi sengaja
  // belum ditampilkan di UI — PMO cuma butuh tau ada vendor-nya aja dulu.
  poNumber?: string;
  poStatus?: "Belum Ada" | "Draft" | "Approved";
  hasMigration?: boolean; // gak semua project ada migrasi/rekon data — tab ini disembunyikan kalau false
  holdHistory: HoldRecord[];
  createdBy?: string; // AppUser.id pembuat project — ikut menentukan hak akses (lihat lib/access.ts)
};

export type ReviewStatus = "Belum Direview" | "Disetujui" | "Perlu Revisi";

export type TaskStatusDef = {
  id: string;
  name: string;
  color: string; // warna utama (hex); warna lembut/tepi/teks diturunkan otomatis di task-ui
  isDone: boolean; // true = dianggap selesai: otomatis 100% & tidak dihitung terlambat
};

export type TaskCategoryDef = { id: string; name: string };

export type TaskAttachment = {
  id: string;
  kind: "image" | "file" | "link";
  name: string;
  url: string; // link eksternal, atau URL file (sementara blob: lokal; nanti URL dari backend)
  size?: number; // byte, untuk image/file
};

// Task dan sub task memakai tipe yang sama: sub task = Task dengan `parentId`.
// Sub task selalu satu project & fase dengan induknya (dijaga di task-store).
export type Task = {
  id: string;
  parentId?: string;
  projectId: string;
  phaseId: string;
  title: string;
  description?: string;
  category: string; // id dari masterTaskCategories
  status: TaskStatus; // id dari masterTaskStatuses
  progressPercent: number; // task induk yang punya sub task: dihitung otomatis dari sub task
  pics: string[]; // bisa lebih dari satu
  startDate: string;
  dueDate: string;
  attachments: TaskAttachment[];
  reviewedBy?: string;
  reviewedAt?: string;
  reviewStatus?: ReviewStatus;
};

export type Meeting = {
  id: string;
  projectId: string;
  title: string;
  category: "Dokumen" | "Development" | "Testing" | "General";
  date: string;
  status: "Scheduled" | "Done" | "Cancelled";
  attendees: string[];
};

export type AuditLog = {
  id: string;
  projectName: string;
  entity: string;
  field: string;
  oldValue: string;
  newValue: string;
  changedBy: string;
  changedAt: string;
};

export const projects: Project[] = [
  {
    id: "prj-1",
    crNumber: "CR-2026-0142",
    name: "Core Banking Integration Portal",
    directorate: "Direktorat Teknologi Informasi",
    subdirectorate: "Subdit Development",
    category: "Bisnis",
    priority: "Tinggi",
    status: "Active",
    pmo: [{ id: "u1", name: "Rani Kusuma", employeeId: "emp1", role: "PMO", isPrimary: true, directorate: "Direktorat Teknologi Informasi", subdirectorate: "Subdit Development" }],
    developers: [
      { id: "u2", name: "Andi Saputra", employeeId: "emp2", role: "Developer", isPrimary: true, directorate: "Direktorat Teknologi Informasi", subdirectorate: "Subdit Development" },
      { id: "u3", name: "Budi Prakoso", employeeId: "emp3", role: "Developer", isPrimary: false, directorate: "Direktorat Teknologi Informasi", subdirectorate: "Subdit Data & Migrasi" },
    ],
    users: [{ id: "u4", name: "Sinta Wulandari", employeeId: "emp4", role: "User", isPrimary: true, directorate: "Direktorat Operasional", subdirectorate: "Subdit Layanan Nasabah" }],
    gitRepo: "git.internal.co/core-banking-portal",
    overallProgress: 62,
    poStatus: "Belum Ada",
    hasMigration: true,
    holdHistory: [],
    phases: [
      {
        id: "ph-1a",
        name: "Fase 1",
        stage: "Testing",
        progressPercent: 78,
        documentProgress: 100,
        developmentProgress: 100,
        testingProgress: 55,
        startDate: "2026-04-01",
        targetLiveDate: "2026-10-15",
        scope: [
          "Integrasi API rekening (saldo, mutasi, transfer) antara Core Banking Portal dengan T24",
          "Migrasi data nasabah tahap awal",
        ],
        note: "Scope belum termasuk modul kartu — direncanakan masuk Fase 2.",
        documents: [
          {
            id: "d1", type: "BR", status: "Approved", approvalLevel: "2/2",
            sourceType: "Link", url: "https://drive.google.com/drive/folders/br-core-banking-f1",
            approvers: [
              { id: "ap1", name: "Rani Kusuma", level: "Manager", status: "Disetujui", date: "2026-03-28" },
              { id: "ap2", name: "Ir. Hartono", level: "Kepala Divisi", status: "Disetujui", date: "2026-03-30" },
            ],
          },
          {
            id: "d2", type: "CR", status: "Approved", approvalLevel: "2/2",
            sourceType: "Link", url: "https://drive.google.com/drive/folders/cr-core-banking-f1",
            approvers: [
              { id: "ap3", name: "Rani Kusuma", level: "Manager", status: "Disetujui", date: "2026-04-02" },
              { id: "ap4", name: "Ir. Hartono", level: "Kepala Divisi", status: "Disetujui", date: "2026-04-03" },
            ],
          },
          {
            id: "d3", type: "FSD", status: "Approved", approvalLevel: "3/3",
            sourceType: "Upload", url: "FSD-CoreBanking-Fase1-v2.pdf",
            approvers: [
              { id: "ap5", name: "Andi Saputra", level: "Staff", status: "Disetujui", date: "2026-04-05" },
              { id: "ap6", name: "Rani Kusuma", level: "Manager", status: "Disetujui", date: "2026-04-06" },
              { id: "ap7", name: "Ir. Hartono", level: "Kepala Divisi", status: "Disetujui", date: "2026-04-08" },
            ],
          },
        ],
        testStages: [
          { id: "ts1", type: "IUT", status: "Passed", progressPercent: 100, pic: "Andi Saputra" },
          { id: "ts2", type: "SIT", status: "On Going", progressPercent: 60, pic: "Dewi QA" },
          { id: "ts3", type: "UAT", status: "Not Started", progressPercent: 0, pic: "Sinta Wulandari" },
        ],
        environments: [
          { id: "env1a-1", category: "Git Repository", label: "core-banking-api (backend)", value: "git.internal.co/core-banking-portal", mainBranch: "main", note: "Repo utama" },
          { id: "env1a-2", category: "Git Repository", label: "core-banking-web (frontend)", value: "git.internal.co/core-banking-web", mainBranch: "develop" },
          { id: "env1a-3", category: "Git Repository", label: "service-template-golang", value: "git.internal.co/templates/service-golang", mainBranch: "main", isTemplate: true, note: "Dipakai sebagai starter tiap modul baru" },
          { id: "env1a-4", category: "Local Developer", label: "Andi Saputra", value: "192.168.1.24", segment: "Kwitang" },
          { id: "env1a-4b", category: "Local Developer", label: "Andi Saputra", value: "10.15.4.9", segment: "Cokro", note: "IP saat WFO di Cokro" },
          { id: "env1a-5", category: "Local Developer", label: "Budi Prakoso", value: "192.168.1.31", segment: "Kwitang" },
          {
            id: "env1a-6", category: "Staging", label: "Cokro", value: "10.20.14.31", port: "8080",
            dns: "corebanking-stg.internal.co", note: "Server dev utama",
            cpu: "4 vCPU", memory: "8 GB", storage: "100 GB SSD",
            extraSpecs: [{ id: "spec1", label: "OS", value: "Ubuntu 24.04" }],
          },
          { id: "env1a-7", category: "Staging", label: "Kwitang", value: "10.20.15.12", port: "8080", note: "Server dev cadangan/DR test" },
          { id: "env1a-8", category: "Database", label: "DB Staging", dbName: "corebanking_stg", value: "10.20.14.35", port: "5432" },
          { id: "env1a-9", category: "Database", label: "DB Core Banking (dari tim data)", dbName: "core_prod_readonly", value: "10.10.2.10", port: "1433", note: "Akses read-only untuk migrasi" },
          { id: "env1a-10", category: "SSH", label: "SSH Staging Cokro", value: "10.20.14.31", port: "22", containerName: "corebanking-api-stg" },
          { id: "env1a-11", category: "Production", label: "Production (dipegang tim Infra)", value: "10.30.1.5", port: "443", dns: "corebanking.bankid.co.id", note: "Informasi saja — bukan dikelola tim project ini" },
          { id: "env1a-12", category: "User", label: "Sinta Wulandari (UAT)", value: "10.25.3.14", segment: "Kwitang", note: "Dibuat menjelang UAT" },
        ],
        migrations: [
          {
            id: "mg1", sourceSystem: "T24", dbName: "t24_core", tableName: "ACCOUNT, CUSTOMER, BALANCE",
            description: "Migrasi data rekening & saldo nasabah",
            status: "On Going", reportStatus: "Draft", reportUrl: "Laporan-Migrasi-T24-Fase1-draft.pdf",
            pic: "Budi Prakoso", team: ["Budi Prakoso", "Andi Saputra"],
            startDate: "2026-08-01", endDate: "2026-09-30",
          },
        ],
        dependencies: [
          {
            id: "dep1a-1", system: "Axway",
            serviceName: "Transfer Antar Bank (RTGS/SKN)",
            description: "Gateway transaksi keluar (transfer antar bank) diteruskan lewat Axway sebelum ke jaringan switching.",
            endpoints: [
              { id: "dep1a-1-e1", label: "Axway Gateway - Staging", value: "10.20.18.5:8443" },
              { id: "dep1a-1-e2", label: "Axway Gateway - Production", value: "10.30.18.5:8443", note: "Dipegang tim Infra" },
            ],
          },
          {
            id: "dep1a-2", system: "Big Data",
            serviceName: "Fraud Detection Event Stream",
            description: "Kirim event transaksi ke platform Big Data untuk kebutuhan fraud detection & pelaporan.",
            endpoints: [
              { id: "dep1a-2-e1", label: "Kafka Topic - txn-events", value: "bigdata-kafka.internal.co:9092" },
            ],
          },
        ],
      },
      {
        id: "ph-1b",
        name: "Fase 2",
        stage: "Dokumen",
        progressPercent: 15,
        documentProgress: 40,
        developmentProgress: 0,
        testingProgress: 0,
        startDate: "2026-09-01",
        targetLiveDate: "2027-01-30",
        previousPhaseId: "ph-1a",
        documents: [
          {
            id: "d4", type: "BR", status: "Approved", approvalLevel: "2/2",
            sourceType: "Link", url: "https://drive.google.com/drive/folders/br-core-banking-f2",
            approvers: [
              { id: "ap8", name: "Rani Kusuma", level: "Manager", status: "Disetujui", date: "2026-08-20" },
              { id: "ap9", name: "Ir. Hartono", level: "Kepala Divisi", status: "Disetujui", date: "2026-08-22" },
            ],
          },
          {
            id: "d5", type: "CR", status: "Review", approvalLevel: "1/2",
            sourceType: "Upload", url: "CR-CoreBanking-Fase2-draft.docx",
            approvers: [
              { id: "ap10", name: "Rani Kusuma", level: "Manager", status: "Disetujui", date: "2026-09-10" },
              { id: "ap11", name: "Ir. Hartono", level: "Kepala Divisi", status: "Menunggu" },
            ],
          },
        ],
        testStages: [],
        environments: [
          { id: "env1b-1", category: "Git Repository", label: "core-banking-api (backend)", value: "git.internal.co/core-banking-portal", mainBranch: "main" },
        ],
        migrations: [],
        dependencies: [],
        scope: ["Modul kartu debit: aktivasi, blokir/buka blokir, dan histori transaksi kartu."],
      },
    ],
  },
  {
    id: "prj-2",
    brNumber: "BR-2026-0087",
    name: "HR Employee Self Service",
    directorate: "Direktorat Sumber Daya Manusia",
    subdirectorate: "Subdit Sistem Informasi SDM",
    category: "Support",
    priority: "Sedang",
    status: "Hold",
    pmo: [{ id: "u5", name: "Fajar Hidayat", employeeId: "emp5", role: "PMO", isPrimary: true, directorate: "Direktorat Sumber Daya Manusia", subdirectorate: "Subdit Sistem Informasi SDM" }],
    developers: [{ id: "u6", name: "Citra Ayu", employeeId: "emp6", role: "Developer", isPrimary: true, directorate: "Direktorat Teknologi Informasi", subdirectorate: "Subdit Development" }],
    users: [{ id: "u7", name: "Herman Wijaya", employeeId: "emp7", role: "User", isPrimary: true, directorate: "Direktorat Sumber Daya Manusia", subdirectorate: "Subdit Administrasi Personalia" }],
    gitRepo: "git.internal.co/hr-ess",
    overallProgress: 34,
    poStatus: "Belum Ada",
    hasMigration: true,
    holdHistory: [
      {
        id: "hh1",
        heldAt: "2026-09-10",
        reason: "Menunggu revisi anggaran dari Human Capital sebelum lanjut development.",
        heldBy: "Fajar Hidayat",
      },
    ],
    phases: [
      {
        id: "ph-2a",
        name: "Fase 1",
        stage: "Development",
        progressPercent: 34,
        documentProgress: 100,
        developmentProgress: 45,
        testingProgress: 0,
        startDate: "2026-05-10",
        targetLiveDate: "2026-11-20",
        documents: [
          {
            id: "d6", type: "BR", status: "Approved", approvalLevel: "2/2",
            sourceType: "Link", url: "https://drive.google.com/drive/folders/br-hr-ess",
            approvers: [
              { id: "ap12", name: "Fajar Hidayat", level: "Manager", status: "Disetujui", date: "2026-05-05" },
              { id: "ap13", name: "Ir. Hartono", level: "Kepala Divisi", status: "Disetujui", date: "2026-05-07" },
            ],
          },
          {
            id: "d7", type: "FSD", status: "Approved", approvalLevel: "3/3",
            sourceType: "Upload", url: "FSD-HR-ESS-v1.pdf",
            approvers: [
              { id: "ap14", name: "Citra Ayu", level: "Staff", status: "Disetujui", date: "2026-05-08" },
              { id: "ap15", name: "Fajar Hidayat", level: "Manager", status: "Disetujui", date: "2026-05-09" },
              { id: "ap16", name: "Ir. Hartono", level: "Kepala Divisi", status: "Disetujui", date: "2026-05-11" },
            ],
          },
        ],
        testStages: [],
        environments: [
          { id: "env5-1", category: "Git Repository", label: "hr-ess-app", value: "git.internal.co/hr-ess", mainBranch: "main" },
          { id: "env5-2", category: "Local Developer", label: "Citra Ayu", value: "192.168.2.14", segment: "Kwitang" },
          { id: "env5-3", category: "Staging", label: "Kwitang", value: "10.20.14.40", port: "8080" },
          { id: "env5-4", category: "Database", label: "DB Staging", dbName: "hress_stg", value: "10.20.14.41", port: "5432" },
        ],
        migrations: [
          {
            id: "mg2", sourceSystem: "HRIS Lama", dbName: "hris_legacy", tableName: "EMPLOYEE, ORG_STRUCTURE",
            description: "Sinkronisasi data pegawai & struktur organisasi",
            status: "Belum Mulai", reportStatus: "Belum Ada", pic: "Citra Ayu", team: ["Citra Ayu"],
          },
        ],
        dependencies: [],
      },
    ],
  },
  {
    id: "prj-3",
    crNumber: "CR-2026-0055",
    name: "Vendor Payment Gateway",
    directorate: "Direktorat Keuangan",
    subdirectorate: "Subdit Treasury & Payment",
    category: "Regulator",
    priority: "Tinggi",
    status: "Active",
    pmo: [{ id: "u8", name: "Rani Kusuma", employeeId: "emp1", role: "PMO", isPrimary: false, directorate: "Direktorat Teknologi Informasi", subdirectorate: "Subdit Development" }],
    developers: [
      { id: "u9", name: "Galih Pratama", employeeId: "emp8", role: "Developer", isPrimary: true, directorate: "Direktorat Teknologi Informasi", subdirectorate: "Subdit Development" },
      { id: "u9v1", name: "Rudi Hartanto", role: "Developer", isPrimary: false, isVendor: true },
    ],
    users: [{ id: "u10", name: "Maya Sari", employeeId: "emp9", role: "User", isPrimary: true, directorate: "Direktorat Keuangan", subdirectorate: "Subdit Treasury & Payment" }],
    gitRepo: "git.internal.co/vendor-payment-gateway",
    overallProgress: 91,
    vendor: "PT Solusi Digital Nusantara",
    poNumber: "PO-2026-0087",
    poStatus: "Approved",
    hasMigration: false,
    holdHistory: [],
    phases: [
      {
        id: "ph-3a",
        name: "Fase 1",
        stage: "Live",
        progressPercent: 100,
        documentProgress: 100,
        developmentProgress: 100,
        testingProgress: 100,
        startDate: "2026-02-01",
        targetLiveDate: "2026-06-01",
        documents: [
          {
            id: "d8", type: "BR", status: "Approved", approvalLevel: "2/2",
            sourceType: "Link", url: "https://drive.google.com/drive/folders/br-vendor-payment",
            approvers: [
              { id: "ap17", name: "Rani Kusuma", level: "Manager", status: "Disetujui", date: "2026-01-25" },
              { id: "ap18", name: "Ir. Hartono", level: "Kepala Divisi", status: "Disetujui", date: "2026-01-27" },
            ],
          },
          {
            id: "d9", type: "PO", status: "Approved", approvalLevel: "2/2",
            sourceType: "Upload", url: "PO-VendorPaymentGateway-2026.pdf",
            approvers: [
              { id: "ap19", name: "Rani Kusuma", level: "Manager", status: "Disetujui", date: "2026-01-28" },
              { id: "ap20", name: "Ir. Hartono", level: "Kepala Divisi", status: "Disetujui", date: "2026-01-30" },
            ],
          },
        ],
        testStages: [
          { id: "ts4", type: "IUT", status: "Passed", progressPercent: 100, pic: "Galih Pratama" },
          { id: "ts5", type: "SIT", status: "Passed", progressPercent: 100, pic: "Dewi QA" },
          { id: "ts6", type: "UAT", status: "Passed", progressPercent: 100, pic: "Maya Sari" },
          { id: "ts7", type: "Pentest", status: "Passed", progressPercent: 100, pic: "Security Team" },
        ],
        environments: [
          { id: "env6-1", category: "Git Repository", label: "vendor-payment-gateway", value: "git.internal.co/vendor-payment-gateway", mainBranch: "main" },
          { id: "env6-2", category: "Production", label: "Production (dipegang tim Infra)", value: "10.20.16.10", port: "443", dns: "payment-gateway.internal.co", note: "Informasi saja — bukan dikelola tim project ini" },
          { id: "env6-3", category: "SSH", label: "SSH Production", value: "10.20.16.10", port: "22", containerName: "payment-gateway-prod" },
        ],
        migrations: [],
        dependencies: [],
      },
      {
        id: "ph-3b",
        name: "Fase 2",
        stage: "Testing",
        progressPercent: 82,
        documentProgress: 100,
        developmentProgress: 100,
        testingProgress: 70,
        startDate: "2026-06-15",
        targetLiveDate: "2026-10-01",
        previousPhaseId: "ph-3a",
        documents: [
          {
            id: "d10", type: "CR", status: "Approved", approvalLevel: "2/2",
            sourceType: "Link", url: "https://drive.google.com/drive/folders/cr-vendor-payment-f2",
            approvers: [
              { id: "ap21", name: "Rani Kusuma", level: "Manager", status: "Disetujui", date: "2026-06-10" },
              { id: "ap22", name: "Ir. Hartono", level: "Kepala Divisi", status: "Disetujui", date: "2026-06-12" },
            ],
          },
        ],
        testStages: [
          { id: "ts8", type: "IUT", status: "Passed", progressPercent: 100, pic: "Galih Pratama" },
          { id: "ts9", type: "SIT", status: "On Going", progressPercent: 40, pic: "Dewi QA" },
        ],
        environments: [
          { id: "env8-1", category: "Staging", label: "Cokro", value: "10.20.16.11", port: "8080" },
          { id: "env8-2", category: "Local Developer", label: "Galih Pratama", value: "192.168.3.9", segment: "Cokro" },
          { id: "env8-3", category: "Database", label: "DB Staging", dbName: "payment_gw_stg", value: "10.20.16.12", port: "5432" },
          { id: "env8-4", category: "Database", label: "DB Vendor (PT Solusi Digital Nusantara)", dbName: "vendor_txn_ro", value: "203.0.113.20", port: "5432", note: "Akses terbatas, hanya untuk rekonsiliasi transaksi" },
        ],
        migrations: [
          {
            id: "mg3", sourceSystem: "Vendor PT Solusi Digital Nusantara", dbName: "vendor_txn_ro", tableName: "DAILY_BATCH_TXN",
            description: "Rekonsiliasi transaksi harian batch vendor vs core",
            status: "Rekon Selesai", reportStatus: "Final", reportUrl: "Laporan-Rekon-VendorPayment-F2.pdf",
            pic: "Maya Sari", team: ["Maya Sari", "Galih Pratama"],
            startDate: "2026-06-20", endDate: "2026-07-10",
          },
        ],
        dependencies: [
          {
            id: "dep3b-1", system: "Fiorano",
            description: "Orkestrasi pesan settlement harian antara Vendor Payment Gateway dan core banking lewat Fiorano ESB.",
            endpoints: [
              { id: "dep3b-1-e1", label: "Fiorano ESB - Staging", value: "10.20.19.7:1856" },
            ],
          },
        ],
      },
    ],
  },
];

export const tasks: Task[] = [
  {
    id: "t1",
    projectId: "prj-1",
    phaseId: "ph-1a",
    title: "Integrasi API rekening core banking",
    category: "development",
    status: "done",
    progressPercent: 100,
    pics: ["Andi Saputra"],
    startDate: "2026-05-01",
    dueDate: "2026-05-10",
    attachments: [],
    reviewedBy: "Rani Kusuma",
    reviewedAt: "2026-05-11",
    reviewStatus: "Disetujui",
  },
  {
    id: "t2",
    projectId: "prj-1",
    phaseId: "ph-1a",
    title: "Migrasi data nasabah dari T24",
    description:
      "Pindahkan data nasabah aktif dari T24 ke core banking baru. Rekonsiliasi jumlah record dan saldo per batch sebelum cutover.",
    category: "migration",
    status: "in-progress",
    progressPercent: 70, // dihitung ulang dari sub task saat store dibuat
    pics: ["Budi Prakoso", "Andi Saputra"],
    startDate: "2026-08-01",
    dueDate: "2026-09-25",
    attachments: [
      { id: "a1", kind: "link", name: "Panduan migrasi T24", url: "https://wiki.company.co.id/pmo/migrasi-t24" },
    ],
  },
  {
    id: "t2-1",
    parentId: "t2",
    projectId: "prj-1",
    phaseId: "ph-1a",
    title: "Ekstrak data nasabah dari T24",
    category: "migration",
    status: "done",
    progressPercent: 100,
    pics: ["Budi Prakoso"],
    startDate: "2026-08-01",
    dueDate: "2026-08-15",
    attachments: [],
  },
  {
    id: "t2-2",
    parentId: "t2",
    projectId: "prj-1",
    phaseId: "ph-1a",
    title: "Validasi & rekonsiliasi per batch",
    description: "Cocokkan jumlah record dan total saldo antara T24 dan core banking.",
    category: "migration",
    status: "in-progress",
    progressPercent: 80,
    pics: ["Budi Prakoso", "Andi Saputra"],
    startDate: "2026-08-16",
    dueDate: "2026-09-10",
    attachments: [],
  },
  {
    id: "t2-3",
    parentId: "t2",
    projectId: "prj-1",
    phaseId: "ph-1a",
    title: "Cutover & verifikasi akhir",
    category: "migration",
    status: "todo",
    progressPercent: 0,
    pics: ["Dewi Anggraini"],
    startDate: "2026-09-11",
    dueDate: "2026-09-25",
    attachments: [],
  },
  {
    id: "t3",
    projectId: "prj-1",
    phaseId: "ph-1a",
    title: "Susun skenario SIT modul transfer",
    category: "testing",
    status: "in-progress",
    progressPercent: 55,
    pics: ["Dewi QA"],
    startDate: "2026-09-05",
    dueDate: "2026-09-30",
    attachments: [],
  },
  {
    id: "t4",
    projectId: "prj-2",
    phaseId: "ph-2a",
    title: "Follow up hasil rapat PMO minggu lalu",
    category: "meeting",
    status: "todo",
    progressPercent: 0,
    pics: ["Fajar Hidayat"],
    startDate: "2026-09-18",
    dueDate: "2026-09-24",
    attachments: [],
  },
  {
    id: "t5",
    projectId: "prj-3",
    phaseId: "ph-3b",
    title: "Perbaikan bug hasil SIT batch 1",
    category: "testing",
    status: "blocked",
    progressPercent: 20,
    pics: ["Galih Pratama"],
    startDate: "2026-09-10",
    dueDate: "2026-09-22",
    attachments: [],
  },
];

export const meetings: Meeting[] = [
  {
    id: "m1",
    projectId: "prj-1",
    title: "Review FSD Fase 2",
    category: "Dokumen",
    date: "2026-09-24T10:00:00",
    status: "Scheduled",
    attendees: ["Rani Kusuma", "Andi Saputra", "Sinta Wulandari"],
  },
  {
    id: "m2",
    projectId: "prj-1",
    title: "Progress development mingguan",
    category: "Development",
    date: "2026-09-19T14:00:00",
    status: "Done",
    attendees: ["Rani Kusuma", "Andi Saputra", "Budi Prakoso"],
  },
  {
    id: "m3",
    projectId: "prj-3",
    title: "Persiapan UAT batch 2",
    category: "Testing",
    date: "2026-09-26T09:00:00",
    status: "Scheduled",
    attendees: ["Dewi QA", "Maya Sari"],
  },
];

export const auditLogs: AuditLog[] = [
  {
    id: "a1",
    projectName: "Core Banking Integration Portal",
    entity: "Fase 1",
    field: "Status",
    oldValue: "Development",
    newValue: "Testing",
    changedBy: "Rani Kusuma",
    changedAt: "2026-09-01T09:12:00",
  },
  {
    id: "a2",
    projectName: "HR Employee Self Service",
    entity: "Project",
    field: "Status",
    oldValue: "Active",
    newValue: "Hold",
    changedBy: "Fajar Hidayat",
    changedAt: "2026-09-10T16:40:00",
  },
  {
    id: "a3",
    projectName: "Vendor Payment Gateway",
    entity: "Fase 2 / Task",
    field: "PIC",
    oldValue: "Maya Sari",
    newValue: "Galih Pratama",
    changedBy: "Rani Kusuma",
    changedAt: "2026-09-15T11:05:00",
  },
];

export function getProjectById(id: string) {
  return projects.find((p) => p.id === id);
}

export function getProjectStatusColor(status: ProjectStatus) {
  switch (status) {
    case "Active":
      return "green";
    case "Hold":
      return "gold";
    case "Cancelled":
      return "red";
  }
}

export function getDocStatusColor(status: DocStatus) {
  switch (status) {
    case "Draft":
      return "default";
    case "Review":
      return "blue";
    case "Approved":
      return "green";
    case "Rejected":
      return "red";
  }
}

export function getApprovalStatusColor(status: ApprovalStatus) {
  switch (status) {
    case "Menunggu":
      return "gold";
    case "Disetujui":
      return "green";
    case "Ditolak":
      return "red";
  }
}

export function getMigrationStatusColor(status: MigrationRecon["status"]) {
  switch (status) {
    case "Belum Mulai":
      return "default";
    case "On Going":
      return "blue";
    case "Rekon Selesai":
      return "green";
  }
}

export function getReportStatusColor(status: MigrationRecon["reportStatus"]) {
  switch (status) {
    case "Belum Ada":
      return "default";
    case "Draft":
      return "blue";
    case "Final":
      return "green";
  }
}

export function getTestStatusColor(status: TestStatus) {
  switch (status) {
    case "Not Started":
      return "default";
    case "On Going":
      return "blue";
    case "Passed":
      return "green";
    case "Failed":
      return "red";
  }
}

export function getPriorityColor(priority: ProjectPriority) {
  switch (priority) {
    case "Rendah":
      return "default";
    case "Sedang":
      return "gold";
    case "Tinggi":
      return "volcano";
  }
}

export function getCategoryColor(category: ProjectCategory) {
  switch (category) {
    case "Support":
      return "blue";
    case "Regulator":
      return "purple";
    case "Bisnis":
      return "cyan";
  }
}

export function getReviewStatusColor(status?: ReviewStatus) {
  switch (status) {
    case "Disetujui":
      return "green";
    case "Perlu Revisi":
      return "volcano";
    case "Belum Direview":
    default:
      return "default";
  }
}

// ---------------------------------------------------------------------------
// Master Data (dummy) — parameter yang nantinya dikelola admin di menu
// Master Data. Dipakai sebagai sumber dropdown/referensi di halaman lain.
// ---------------------------------------------------------------------------

export const masterDocumentTypes: { type: DocType; description: string }[] = [
  { type: "BR", description: "Business Requirement" },
  { type: "CR", description: "Change Request" },
  { type: "FSD", description: "Functional Spec Document" },
  { type: "PO", description: "Purchase Order (jika ada vendor)" },
];

export const masterTestTypes: {
  type: TestType;
  requiresPrevious: boolean;
  allowParallel: boolean;
}[] = [
  { type: "IUT", requiresPrevious: false, allowParallel: false },
  { type: "SIT", requiresPrevious: true, allowParallel: false },
  { type: "UAT", requiresPrevious: true, allowParallel: true },
  { type: "TO", requiresPrevious: true, allowParallel: true },
  { type: "Pentest", requiresPrevious: false, allowParallel: true },
];

export const masterApprovalLevels = ["Staff", "Manager", "Kepala Divisi"];
export const masterProjectRoles = ["PMO", "Developer", "User", "QA", "Security"];
export const masterDirektorat = [
  "Direktorat Teknologi Informasi",
  "Direktorat Operasional",
  "Direktorat Keuangan",
  "Direktorat Kepatuhan & Legal",
  "Direktorat Sumber Daya Manusia",
];
// Subdit berelasi ke direktorat induknya — jangan diakses langsung sebagai
// daftar flat, pakai getSubditOptions(directorate) biar pilihan subdit di
// form otomatis ke-filter sesuai direktorat yang udah dipilih duluan.
export const masterSubdit: { directorate: string; subdirectorate: string }[] = [
  { directorate: "Direktorat Teknologi Informasi", subdirectorate: "Subdit Development" },
  { directorate: "Direktorat Teknologi Informasi", subdirectorate: "Subdit Infrastruktur" },
  { directorate: "Direktorat Teknologi Informasi", subdirectorate: "Subdit Data & Migrasi" },
  { directorate: "Direktorat Teknologi Informasi", subdirectorate: "Subdit Quality Assurance" },
  { directorate: "Direktorat Operasional", subdirectorate: "Subdit Layanan Nasabah" },
  { directorate: "Direktorat Operasional", subdirectorate: "Subdit Operasional Cabang" },
  { directorate: "Direktorat Keuangan", subdirectorate: "Subdit Treasury & Payment" },
  { directorate: "Direktorat Keuangan", subdirectorate: "Subdit Akuntansi" },
  { directorate: "Direktorat Kepatuhan & Legal", subdirectorate: "Subdit Legal & Compliance" },
  { directorate: "Direktorat Kepatuhan & Legal", subdirectorate: "Subdit Manajemen Risiko" },
  { directorate: "Direktorat Sumber Daya Manusia", subdirectorate: "Subdit Administrasi Personalia" },
  { directorate: "Direktorat Sumber Daya Manusia", subdirectorate: "Subdit Sistem Informasi SDM" },
];
export function getSubditOptions(directorate?: string) {
  return directorate ? masterSubdit.filter((s) => s.directorate === directorate) : masterSubdit;
}
export const masterProjectCategories: ProjectCategory[] = ["Support", "Regulator", "Bisnis"];
export const masterProjectPriorities: ProjectPriority[] = ["Rendah", "Sedang", "Tinggi"];
export const masterEnvironmentTypes = [
  "Git Repository",
  "Local Developer",
  "Staging",
  "Production",
  "Database",
  "SSH",
  "User",
];
export const masterTaskStatuses: TaskStatusDef[] = [
  { id: "todo", name: "To Do", color: "#7C8798", isDone: false },
  { id: "in-progress", name: "In Progress", color: "#2F80ED", isDone: false },
  { id: "done", name: "Done", color: "#17C653", isDone: true },
  { id: "blocked", name: "Blocked", color: "#F8285A", isDone: false },
];
export const masterTaskCategories: TaskCategoryDef[] = [
  { id: "development", name: "Development" },
  { id: "migration", name: "Migrasi/Sinkronisasi" },
  { id: "testing", name: "Testing" },
  { id: "meeting", name: "To-Do Meeting" },
];
export const masterMeetingCategories = ["Dokumen", "Development", "Testing", "General"];
export const masterVendors = [
  "PT Solusi Digital Nusantara",
  "PT Mitra Teknologi Bangsa",
  "CV Data Sinergi",
];
// Sistem lain yang biasa jadi dependency integrasi — kalau gak ada di daftar,
// pilih "Lainnya" lalu isi nama sistemnya manual.
export const masterDependencySystems = [
  "Axway",
  "Fiorano",
  "Big Data",
  "Core Banking",
  "Lainnya",
];
export const masterReviewStatuses: ReviewStatus[] = ["Belum Direview", "Disetujui", "Perlu Revisi"];

// ---------------------------------------------------------------------------
// Pengguna & Role (dummy)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Pegawai (master) — daftar orang yang bisa dipilih jadi PMO/Developer/User
// saat menambah anggota tim di sebuah project. INI BUKAN akun login aplikasi
// ini — pegawai di sini belum tentu pernah/perlu akses aplikasi ini sama
// sekali. Akun login ada di bawah (AppUser), daftar terpisah.
// ---------------------------------------------------------------------------

export type Employee = {
  id: string;
  name: string;
  directorate: string; // sinkron dgn masterDirektorat
  subdirectorate: string; // sinkron dgn masterSubdit (relasi ke directorate di atas)
  roles: string[]; // role project yang bisa diisi orang ini: PMO/Developer/User/QA/Security
  userId?: string; // AppUser.id kalau pegawai ini punya akun login aplikasi
};

export const employees: Employee[] = [
  { id: "emp1", name: "Rani Kusuma", userId: "u1", directorate: "Direktorat Teknologi Informasi", subdirectorate: "Subdit Development", roles: ["PMO"] },
  { id: "emp2", name: "Andi Saputra", directorate: "Direktorat Teknologi Informasi", subdirectorate: "Subdit Development", roles: ["Developer"] },
  { id: "emp3", name: "Budi Prakoso", directorate: "Direktorat Teknologi Informasi", subdirectorate: "Subdit Data & Migrasi", roles: ["Developer"] },
  { id: "emp4", name: "Sinta Wulandari", directorate: "Direktorat Operasional", subdirectorate: "Subdit Layanan Nasabah", roles: ["User"] },
  { id: "emp5", name: "Fajar Hidayat", userId: "u2", directorate: "Direktorat Sumber Daya Manusia", subdirectorate: "Subdit Administrasi Personalia", roles: ["PMO"] },
  { id: "emp6", name: "Citra Ayu", directorate: "Direktorat Sumber Daya Manusia", subdirectorate: "Subdit Sistem Informasi SDM", roles: ["Developer"] },
  { id: "emp7", name: "Herman Wijaya", directorate: "Direktorat Sumber Daya Manusia", subdirectorate: "Subdit Administrasi Personalia", roles: ["User"] },
  { id: "emp8", name: "Galih Pratama", directorate: "Direktorat Keuangan", subdirectorate: "Subdit Treasury & Payment", roles: ["Developer"] },
  { id: "emp9", name: "Maya Sari", directorate: "Direktorat Keuangan", subdirectorate: "Subdit Treasury & Payment", roles: ["User"] },
  { id: "emp10", name: "Dewi Anggraini", userId: "u3", directorate: "Direktorat Teknologi Informasi", subdirectorate: "Subdit Quality Assurance", roles: ["QA"] },
  { id: "emp11", name: "Wahyu Setiawan", directorate: "Direktorat Kepatuhan & Legal", subdirectorate: "Subdit Legal & Compliance", roles: ["Security"] },
];

// ---------------------------------------------------------------------------
// Akun login aplikasi ini (User Management) — jauh lebih sedikit orangnya
// daripada master Pegawai di atas, karena kebanyakan Developer/User di
// project cuma "dikelola" PMO lewat data project, gak pernah buka app ini.
// ---------------------------------------------------------------------------

export type AppUser = {
  id: string;
  name: string;
  username: string; // dipakai di halaman login (belum aktif)
  email: string;
  directorate: string;
  subdirectorate: string;
  roles: string[]; // nama Role dari master Role/Permission (Administrator/PMO/Developer/QA/User-Viewer)
  active: boolean;
};

export const appUsers: AppUser[] = [
  { id: "u1", username: "rani.kusuma", name: "Rani Kusuma", email: "rani.kusuma@company.co.id", directorate: "Direktorat Teknologi Informasi", subdirectorate: "Subdit Development", roles: ["PMO"], active: true },
  { id: "u2", username: "fajar.hidayat", name: "Fajar Hidayat", email: "fajar.hidayat@company.co.id", directorate: "Direktorat Sumber Daya Manusia", subdirectorate: "Subdit Administrasi Personalia", roles: ["PMO"], active: true },
  { id: "u3", username: "dewi.anggraini", name: "Dewi Anggraini", email: "dewi.anggraini@company.co.id", directorate: "Direktorat Teknologi Informasi", subdirectorate: "Subdit Quality Assurance", roles: ["QA"], active: true },
  { id: "u4", username: "admin.it", name: "Admin IT", email: "admin.it@company.co.id", directorate: "Direktorat Teknologi Informasi", subdirectorate: "Subdit Infrastruktur", roles: ["Administrator"], active: true },
];

export type RolePermission = {
  menuKey: string;
  menuLabel: string;
  view: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
};

export type Role = {
  id: string;
  name: string;
  description: string;
  memberCount: number;
  permissions: RolePermission[];
};

const ROLE_MENUS: { key: string; label: string }[] = [
  { key: "dashboard", label: "Dashboard" },
  { key: "projects", label: "Project" },
  { key: "tasks", label: "Task Board" },
  { key: "meetings", label: "Rapat" },
  { key: "timeline", label: "Timeline Project" },
  { key: "testing", label: "Pengujian" },
  { key: "reports", label: "Laporan" },
  { key: "audit-trail", label: "Riwayat Perubahan" },
  { key: "library", label: "Daftar Pustaka" },
  { key: "master-data", label: "Master Data" },
  { key: "user-management", label: "Manajemen User" },
];

function buildPermissions(
  overrides: Record<string, Partial<Omit<RolePermission, "menuKey" | "menuLabel">>>,
  fallback: Partial<Omit<RolePermission, "menuKey" | "menuLabel">> = { view: true }
): RolePermission[] {
  return ROLE_MENUS.map(({ key, label }) => ({
    menuKey: key,
    menuLabel: label,
    view: false,
    create: false,
    edit: false,
    delete: false,
    ...fallback,
    ...overrides[key],
  }));
}

export const roles: Role[] = [
  {
    id: "role-admin",
    name: "Administrator",
    description: "Akses penuh ke seluruh menu, termasuk Master Data dan Manajemen User.",
    memberCount: 1,
    permissions: buildPermissions({}, { view: true, create: true, edit: true, delete: true }),
  },
  {
    id: "role-pmo",
    name: "PMO",
    description: "Mengelola project, dokumen, task, rapat, dan laporan lintas project.",
    memberCount: 2,
    permissions: buildPermissions({
      "master-data": { view: false },
      "user-management": { view: false },
    }, { view: true, create: true, edit: true, delete: false }),
  },
  {
    id: "role-developer",
    name: "Developer",
    description: "Mengelola task development & migrasi, mengisi IUT, lihat project yang diikuti.",
    memberCount: 3,
    permissions: buildPermissions({
      projects: { view: true, create: false, edit: false },
      tasks: { view: true, create: true, edit: true },
      testing: { view: true, create: true, edit: true },
      "master-data": { view: false },
      "user-management": { view: false },
    }, { view: true, create: false, edit: false }),
  },
  {
    id: "role-qa",
    name: "QA",
    description: "Mengelola test script & hasil SIT, lihat task dan timeline terkait.",
    memberCount: 1,
    permissions: buildPermissions({
      testing: { view: true, create: true, edit: true },
      tasks: { view: true },
      "master-data": { view: false },
      "user-management": { view: false },
    }, { view: true, create: false, edit: false }),
  },
  {
    id: "role-viewer",
    name: "User / Viewer",
    description: "Hanya melihat project & laporan yang relevan, tanpa hak ubah data.",
    memberCount: 4,
    permissions: buildPermissions({
      "master-data": { view: false },
      "user-management": { view: false },
    }, { view: true, create: false, edit: false, delete: false }),
  },
];
