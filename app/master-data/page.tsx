"use client";

import { Suspense, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, Empty, Input, Tag, Typography } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import PageSkeleton from "@/components/layout/PageSkeleton";
import ListCrud from "@/components/master-data/ListCrud";
import DocTypesCrud from "@/components/master-data/DocTypesCrud";
import TestTypesCrud from "@/components/master-data/TestTypesCrud";
import SubditCrud from "@/components/master-data/SubditCrud";
import EmployeesCrud from "@/components/master-data/EmployeesCrud";
import TaskStatusesCrud from "@/components/master-data/TaskStatusesCrud";
import TaskCategoriesCrud from "@/components/master-data/TaskCategoriesCrud";
import MeetingCategoriesCrud from "@/components/master-data/MeetingCategoriesCrud";
import MeetingStatusesCrud from "@/components/master-data/MeetingStatusesCrud";
import { useMasterStore } from "@/lib/master-store";

const { Text, Title } = Typography;

type Section = {
  key: string;
  group: string;
  label: string;
  description: string;
  usedIn: string[];
  count: number;
  content: ReactNode;
};

const noop = () => () => undefined;
// Konten CRUD memakai modal/portal; dirender hanya di browser supaya tidak bentrok saat hidrasi.
function ClientOnly({ children }: { children: ReactNode }) {
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  return mounted ? <>{children}</> : null;
}

function MasterDataContent() {
  const router = useRouter();
  const params = useSearchParams();
  const m = useMasterStore();
  const [q, setQ] = useState("");

  const sections = useMemo<Section[]>(
    () => [
      {
        key: "project-categories", group: "Project", label: "Kategori Project", count: m.lists.projectCategories.length,
        description: "Pengelompokan project (mis. Support, Regulator, Bisnis).",
        usedIn: ["Form project", "Detail project"],
        content: <ListCrud listKey="projectCategories" itemLabel="Kategori Project" />,
      },
      {
        key: "project-priorities", group: "Project", label: "Priority Project", count: m.lists.projectPriorities.length,
        description: "Tingkat prioritas project. Urutan di sini = urutan pada pilihan dan filter.",
        usedIn: ["Form project", "Filter daftar project"],
        content: <ListCrud listKey="projectPriorities" itemLabel="Priority Project" />,
      },
      {
        key: "vendors", group: "Project", label: "Master Vendor", count: m.lists.vendors.length,
        description: "Vendor pelaksana project. Bisa dikosongkan di project yang dikerjakan internal.",
        usedIn: ["Form project", "Detail project"],
        content: <ListCrud listKey="vendors" itemLabel="Vendor" />,
      },
      {
        key: "dependency-systems", group: "Project", label: "Sistem Dependency", count: m.lists.dependencySystems.length,
        description: "Sistem lain yang biasa jadi dependency integrasi. Pilihan “Lainnya” dipakai untuk sistem di luar daftar.",
        usedIn: ["Tab Environment & Dependency"],
        content: <ListCrud listKey="dependencySystems" itemLabel="Sistem Dependency" locked={["Lainnya"]} lockedReason="Pilihan “Lainnya” dibaca langsung oleh form dependency (isi nama sistem manual)." />,
      },
      {
        key: "doc-types", group: "Dokumen & Pengujian", label: "Jenis Dokumen", count: m.documentTypes.length,
        description: "Jenis dokumen yang dicatat per fase (BR, CR, FSD, PO, ...).",
        usedIn: ["Tab Dokumen"],
        content: <DocTypesCrud />,
      },
      {
        key: "approval-levels", group: "Dokumen & Pengujian", label: "Level Approval", count: m.lists.approvalLevels.length,
        description: "Jenjang persetujuan dokumen, urut dari bawah ke atas.",
        usedIn: ["Approver dokumen"],
        content: <ListCrud listKey="approvalLevels" itemLabel="Level Approval" />,
      },
      {
        key: "test-types", group: "Dokumen & Pengujian", label: "Jenis Testing", count: m.testTypes.length,
        description: "Jenis pengujian beserta aturan urutan dan paralelnya.",
        usedIn: ["Menu Pengujian", "Timeline"],
        content: <TestTypesCrud />,
      },
      {
        key: "direktorat", group: "Organisasi", label: "Direktorat", count: m.lists.directorates.length,
        description: "Direktorat pengaju project dan asal pegawai/user.",
        usedIn: ["Form project", "Master Pegawai", "Manajemen User"],
        content: <ListCrud listKey="directorates" itemLabel="Direktorat" />,
      },
      {
        key: "subdit", group: "Organisasi", label: "Subdit", count: m.subdits.length,
        description: "Sub direktorat; selalu milik satu direktorat. Pilihan subdit di form tersaring sesuai direktorat.",
        usedIn: ["Form project", "Master Pegawai", "Manajemen User"],
        content: <SubditCrud />,
      },
      {
        key: "employees", group: "Organisasi", label: "Master Pegawai", count: m.employees.length,
        description: "Pegawai yang bisa dipilih jadi PMO/Developer/User saat menyusun tim project. Terpisah dari akun login.",
        usedIn: ["Tim project", "Peserta rapat"],
        content: <EmployeesCrud />,
      },
      {
        key: "project-roles", group: "Organisasi", label: "Role Project", count: m.lists.projectRoles.length,
        description: "Peran dalam tim project. Lima peran bawaan dibaca langsung oleh aturan akses dan tidak bisa diubah.",
        usedIn: ["Tim project", "Master Pegawai", "Hak akses task & rapat"],
        content: <ListCrud listKey="projectRoles" itemLabel="Role Project" locked={["PMO", "Developer", "User", "QA", "Security"]} lockedReason="Peran bawaan — dibaca langsung oleh aturan hak akses (task, rapat, project)." />,
      },
      {
        key: "task-statuses", group: "Task", label: "Status Task", count: m.taskStatuses.length,
        description: "Kolom di Task Board. Urutan = urutan kolom; saklar “dianggap selesai” menentukan arti status.",
        usedIn: ["Task Board", "Tab Task", "Laporan"],
        content: <TaskStatusesCrud />,
      },
      {
        key: "task-categories", group: "Task", label: "Kategori Task", count: m.taskCategories.length,
        description: "Jenis pekerjaan task (Development, Migrasi, Testing, ...). Development/Migrasi/Testing juga menentukan bar di Timeline.",
        usedIn: ["Task Board", "Timeline"],
        content: <TaskCategoriesCrud />,
      },
      {
        key: "meeting-statuses", group: "Rapat", label: "Status Rapat", count: m.meetingStatuses.length,
        description: "Status rapat beserta arti-nya (terjadwal, selesai, batal).",
        usedIn: ["Menu Rapat", "Kalender"],
        content: <MeetingStatusesCrud />,
      },
      {
        key: "meeting-categories", group: "Rapat", label: "Kategori Rapat", count: m.meetingCategories.length,
        description: "Pengelompokan rapat (Dokumen, Development, Testing, General).",
        usedIn: ["Menu Rapat"],
        content: <MeetingCategoriesCrud />,
      },
    ],
    [m],
  );

  const kw = q.trim().toLowerCase();
  const visible = sections.filter((s) => !kw || `${s.label} ${s.group} ${s.description}`.toLowerCase().includes(kw));
  const groups = [...new Set(visible.map((s) => s.group))];
  const wanted = params.get("section");
  const active = sections.find((s) => s.key === wanted) ?? sections[0];

  const select = (key: string) => router.replace(`/master-data?section=${key}`, { scroll: false });

  return (
    <PageSkeleton path="/master-data">
      <div style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "flex-start" }}>
        <nav aria-label="Daftar master data" style={{ flex: "0 0 260px", maxWidth: "100%", position: "sticky", top: 12 }}>
          <Input allowClear prefix={<SearchOutlined />} placeholder="Cari master..." value={q} onChange={(e) => setQ(e.target.value)} style={{ marginBottom: 12 }} />
          {groups.length === 0 && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Tidak ada yang cocok" />}
          {groups.map((g) => (
            <div key={g} style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.6, textTransform: "uppercase", color: "#6B7185", padding: "0 10px 4px" }}>{g}</div>
              {visible
                .filter((s) => s.group === g)
                .map((s) => {
                  const on = s.key === active.key;
                  return (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => select(s.key)}
                      aria-current={on ? "page" : undefined}
                      style={{
                        display: "flex", width: "100%", alignItems: "center", justifyContent: "space-between", gap: 8, textAlign: "left", cursor: "pointer",
                        padding: "8px 10px", borderRadius: 8, fontSize: 14, background: on ? "#E3F6F8" : "transparent", color: on ? "#206D7E" : "#1F2937", fontWeight: on ? 600 : 400,
                        borderStyle: "solid", borderWidth: 1, borderColor: on ? "#B1ECF0" : "transparent",
                      }}
                    >
                      <span>{s.label}</span>
                      <span style={{ fontSize: 12, color: on ? "#206D7E" : "#8A90A2" }}>{s.count}</span>
                    </button>
                  );
                })}
            </div>
          ))}
        </nav>

        <div style={{ flex: "1 1 520px", minWidth: 0 }}>
          <Card styles={{ body: { padding: 20 } }}>
            <div style={{ marginBottom: 16 }}>
              <Title level={4} style={{ margin: 0 }}>
                {active.label}
              </Title>
              <Text type="secondary">{active.description}</Text>
              <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Dipakai di:
                </Text>
                {active.usedIn.map((u) => (
                  <Tag key={u} style={{ marginInlineEnd: 0 }}>
                    {u}
                  </Tag>
                ))}
              </div>
            </div>
            <ClientOnly key={active.key}>{active.content}</ClientOnly>
          </Card>
        </div>
      </div>
    </PageSkeleton>
  );
}

// useSearchParams() wajib dibungkus Suspense di Next.js.
export default function MasterDataPage() {
  return (
    <Suspense fallback={null}>
      <MasterDataContent />
    </Suspense>
  );
}
