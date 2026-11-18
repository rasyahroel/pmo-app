"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import dayjs, { type Dayjs } from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import "dayjs/locale/id";
import { Alert, Avatar, Button, Card, DatePicker, Empty, Input, Select, Space, Table, Tag, Tooltip, Typography } from "antd";
import { DownloadOutlined, LockOutlined, ReloadOutlined, SearchOutlined } from "@ant-design/icons";
import { projects } from "@/lib/mock-data";
import { isAdministrator } from "@/lib/access";
import { useCurrentUser } from "@/lib/acting-user";
import { useAuditStore, type AuditEntry } from "@/lib/audit-store";
import { useProjectStructure } from "@/lib/project-structure";
import { useTaskStore } from "@/lib/task-store";
import { canViewAuditEntry, entryKind, entryProjectId } from "@/lib/audit-permissions";
import { initials } from "@/lib/task-ui";
import { agi } from "@/app/providers";

dayjs.extend(relativeTime);

const { Text } = Typography;
const { RangePicker } = DatePicker;

const fmt = (iso: string) => new Date(iso).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });

// Ekspor CSV yang aman dibuka di Excel: BOM UTF-8, dan sel yang diawali = + - @ diberi tanda petik
// supaya tidak dieksekusi sebagai rumus (CSV injection).
function toCsv(rows: AuditEntry[], projectNameOf: (e: AuditEntry) => string): string {
  const cell = (v: string) => {
    const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  const head = ["Waktu", "Pelaku", "Project", "Objek", "Jenis perubahan", "Nilai lama", "Nilai baru"].map(cell).join(",");
  const body = rows.map((r) =>
    [r.changedAt.replace("T", " "), r.changedBy, projectNameOf(r), r.entity, r.field, r.oldValue, r.newValue].map(cell).join(","),
  );
  return "\uFEFF" + [head, ...body].join("\r\n");
}

type Props = {
  /** diisi = riwayat khusus satu project (tab Riwayat di detail project) */
  projectId?: string;
};

// Tampilan Riwayat Perubahan: hanya baca. Dipakai oleh menu Riwayat Perubahan (semua project yang
// boleh dilihat) dan tab Riwayat di detail project — satu komponen, satu sumber data, jadi sinkron.
export default function AuditLogView({ projectId }: Props) {
  const currentUser = useCurrentUser();
  const { logs } = useAuditStore();
  const { tasks } = useTaskStore();
  const { pmoOf, developersOf } = useProjectStructure();

  const [range, setRange] = useState<[Dayjs, Dayjs] | null>(null);
  const [actors, setActors] = useState<string[]>([]);
  const [fields, setFields] = useState<string[]>([]);
  const [kinds, setKinds] = useState<string[]>([]);
  const [projectIds, setProjectIds] = useState<string[]>([]);
  const [q, setQ] = useState("");

  const admin = isAdministrator(currentUser);
  const projectNameOf = (e: AuditEntry) => e.projectName;

  // 1) apa yang boleh dilihat pengguna ini (dan, di tab project, hanya project ini)
  const visible = useMemo(() => {
    const scope = { projects, tasks, pmoOf, developersOf };
    return logs
      .filter((l) => canViewAuditEntry(currentUser, l, scope))
      .filter((l) => !projectId || entryProjectId(l, projects) === projectId)
      .sort((a, b) => b.changedAt.localeCompare(a.changedAt));
  }, [logs, tasks, pmoOf, developersOf, projectId, currentUser]);

  // 2) pilihan filter diturunkan dari data yang boleh dilihat (tidak membocorkan nama lain)
  const actorOptions = useMemo(() => Array.from(new Set(visible.map((l) => l.changedBy))).sort(), [visible]);
  const fieldOptions = useMemo(() => Array.from(new Set(visible.map((l) => l.field))).sort(), [visible]);
  const kindOptions = useMemo(() => Array.from(new Set(visible.map((l) => entryKind(l)))).sort(), [visible]);
  const projectOptions = useMemo(() => {
    const ids = new Set(visible.map((l) => entryProjectId(l, projects)).filter(Boolean) as string[]);
    return projects.filter((p) => ids.has(p.id)).map((p) => ({ value: p.id, label: p.name }));
  }, [visible]);

  // 3) terapkan filter
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return visible.filter((l) => {
      if (range) {
        const t = dayjs(l.changedAt);
        if (t.isBefore(range[0].startOf("day")) || t.isAfter(range[1].endOf("day"))) return false;
      }
      if (actors.length && !actors.includes(l.changedBy)) return false;
      if (fields.length && !fields.includes(l.field)) return false;
      if (kinds.length && !kinds.includes(entryKind(l))) return false;
      if (projectIds.length && !projectIds.includes(entryProjectId(l, projects) ?? "")) return false;
      if (needle) {
        const hay = [l.projectName, l.entity, l.field, l.oldValue, l.newValue, l.changedBy].join(" ").toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [visible, range, actors, fields, kinds, projectIds, q]);

  const activeFilters = [range, actors.length, fields.length, kinds.length, projectIds.length, q.trim()].filter(Boolean).length;

  function reset() {
    setRange(null);
    setActors([]);
    setFields([]);
    setKinds([]);
    setProjectIds([]);
    setQ("");
  }

  function setPreset(days: number | "today") {
    const end = dayjs();
    setRange(days === "today" ? [end, end] : [end.subtract(days - 1, "day"), end]);
  }

  function exportCsv() {
    const blob = new Blob([toCsv(filtered, projectNameOf)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `riwayat-perubahan-${dayjs().format("YYYYMMDD-HHmm")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const taskExists = (id?: string) => !!id && tasks.some((t) => t.id === id);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Alert
        type="info"
        showIcon
        icon={<LockOutlined />}
        title={
          admin
            ? "Catatan dibuat otomatis dari setiap aktivitas dan tidak bisa diubah atau dihapus. Sebagai Administrator kamu melihat semua."
            : "Catatan dibuat otomatis dari setiap aktivitas dan tidak bisa diubah atau dihapus. Kamu melihat aktivitas pada project yang kamu ikuti, task yang kamu pegang, dan yang kamu lakukan sendiri."
        }
      />

      <Card size="small" styles={{ body: { padding: 14 } }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12 }}>
          <div>
            <Label>Kapan</Label>
            <RangePicker
              style={{ width: "100%" }}
              value={range}
              onChange={(v) => setRange(v && v[0] && v[1] ? [v[0], v[1]] : null)}
              allowClear
              disabledDate={(d) => d.isAfter(dayjs(), "day")}
            />
            <Space size={4} wrap style={{ marginTop: 6 }}>
              <Button size="small" onClick={() => setPreset("today")}>Hari ini</Button>
              <Button size="small" onClick={() => setPreset(7)}>7 hari</Button>
              <Button size="small" onClick={() => setPreset(30)}>30 hari</Button>
              <Button size="small" type="text" onClick={() => setRange(null)} disabled={!range}>Semua waktu</Button>
            </Space>
          </div>

          <div>
            <Label>Siapa</Label>
            <Select
              mode="multiple"
              allowClear
              maxTagCount="responsive"
              style={{ width: "100%" }}
              placeholder="Semua pengguna"
              value={actors}
              onChange={setActors}
              options={actorOptions.map((a) => ({ value: a, label: a }))}
            />
          </div>

          <div>
            <Label>Apa yang berubah</Label>
            <Select
              mode="multiple"
              allowClear
              maxTagCount="responsive"
              style={{ width: "100%" }}
              placeholder="Semua jenis perubahan"
              value={fields}
              onChange={setFields}
              options={fieldOptions.map((f) => ({ value: f, label: f }))}
            />
          </div>

          <div>
            <Label>Objek</Label>
            <Select
              mode="multiple"
              allowClear
              maxTagCount="responsive"
              style={{ width: "100%" }}
              placeholder="Task, sub task, komentar…"
              value={kinds}
              onChange={setKinds}
              options={kindOptions.map((k) => ({ value: k, label: k }))}
            />
          </div>

          {!projectId && (
            <div>
              <Label>Project</Label>
              <Select
                mode="multiple"
                allowClear
                maxTagCount="responsive"
                style={{ width: "100%" }}
                placeholder="Semua project"
                value={projectIds}
                onChange={setProjectIds}
                options={projectOptions}
                optionFilterProp="label"
              />
            </div>
          )}

          <div>
            <Label>Cari kata</Label>
            <Input
              allowClear
              prefix={<SearchOutlined />}
              placeholder="Judul task, nilai, nama…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12, gap: 8, flexWrap: "wrap" }}>
          <Text type="secondary">
            Menampilkan <b>{filtered.length}</b> dari {visible.length} aktivitas
            {activeFilters > 0 && <Tag color="cyan" style={{ marginInlineStart: 8 }}>{activeFilters} filter aktif</Tag>}
          </Text>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={reset} disabled={activeFilters === 0}>
              Reset filter
            </Button>
            <Button icon={<DownloadOutlined />} onClick={exportCsv} disabled={filtered.length === 0}>
              Ekspor CSV
            </Button>
          </Space>
        </div>
      </Card>

      <Table<AuditEntry>
        rowKey="id"
        size="middle"
        dataSource={filtered}
        scroll={{ x: "max-content" }}
        pagination={{ pageSize: 20, showSizeChanger: true, pageSizeOptions: [10, 20, 50, 100], showTotal: (t) => `${t} aktivitas` }}
        locale={{
          emptyText: (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={visible.length === 0 ? "Belum ada aktivitas yang bisa kamu lihat." : "Tidak ada aktivitas yang cocok dengan filter."}
            >
              {activeFilters > 0 && <Button onClick={reset}>Reset filter</Button>}
            </Empty>
          ),
        }}
        columns={[
          {
            title: "Kapan",
            dataIndex: "changedAt",
            width: 170,
            defaultSortOrder: "descend",
            sorter: (a, b) => a.changedAt.localeCompare(b.changedAt),
            render: (v: string) => (
              <Tooltip title={dayjs(v).format("DD/MM/YYYY HH:mm:ss")}>
                <span>
                  <div>{fmt(v)}</div>
                  <Text type="secondary" style={{ fontSize: 12 }}>{dayjs(v).locale("id").fromNow()}</Text>
                </span>
              </Tooltip>
            ),
          },
          {
            title: "Siapa",
            dataIndex: "changedBy",
            width: 170,
            render: (v: string) => (
              <Space size={8}>
                <Avatar size={26} style={{ background: agi[200], color: agi[800], fontSize: 11 }}>{initials(v)}</Avatar>
                <span>{v}</span>
              </Space>
            ),
          },
          ...(!projectId
            ? [
                {
                  title: "Project",
                  dataIndex: "projectName",
                  width: 210,
                  render: (v: string) => <Text>{v}</Text>,
                },
              ]
            : []),
          {
            title: "Objek",
            dataIndex: "entity",
            width: 280,
            render: (v: string, r: AuditEntry) =>
              taskExists(r.taskId) ? (
                <Link href={`/tasks/${r.taskId}`} style={{ color: "inherit" }}>
                  {v}
                </Link>
              ) : (
                <span>{v}</span>
              ),
          },
          { title: "Jenis", dataIndex: "field", width: 130, render: (v: string) => <Tag style={{ marginInlineEnd: 0 }}>{v}</Tag> },
          {
            title: "Perubahan",
            render: (_: unknown, r: AuditEntry) => (
              <div style={{ minWidth: 240, wordBreak: "break-word" }}>
                {r.oldValue !== "—" && (
                  <>
                    <Text delete type="secondary">{r.oldValue}</Text>
                    {" → "}
                  </>
                )}
                <Text strong>{r.newValue}</Text>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}

function Label({ children }: { children: string }) {
  return <div style={{ fontSize: 12, color: "#667085", marginBottom: 4 }}>{children}</div>;
}
