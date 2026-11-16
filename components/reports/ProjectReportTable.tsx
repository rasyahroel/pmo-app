"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import dayjs from "dayjs";
import { Button, Card, Input, Progress, Segmented, Space, Table, Tag, Typography } from "antd";
import { DownloadOutlined, SearchOutlined } from "@ant-design/icons";
import { getProjectStatusColor } from "@/lib/mock-data";
import { formatDate } from "@/lib/task-ui";
import type { ProjectReportRow } from "@/lib/report-data";
import { useReportRows } from "@/components/reports/ReportSummary";

const { Text } = Typography;

// CSV yang aman dibuka di Excel (BOM UTF-8; sel berawalan = + - @ diberi tanda petik agar tidak jadi rumus).
function toCsv(rows: ProjectReportRow[]): string {
  const cell = (v: string | number | undefined | null) => {
    const t = v === undefined || v === null ? "" : String(v);
    return `"${(/^[=+\-@\t\r]/.test(t) ? `'${t}` : t).replace(/"/g, '""')}"`;
  };
  const head = ["Project", "Status", "Tahap", "Mulai", "Target live", "Progress project (%)", "Progress task (%)", "Task aktif", "Task terlambat", "Rapat berikutnya", "Perlu perhatian"].map(cell).join(",");
  const body = rows.map((r) =>
    [r.project.name, r.project.status, r.stage, r.startDate, r.targetDate, r.project.overallProgress, r.taskProgress ?? "", r.openTasks, r.overdueTasks, r.nextMeeting, r.reasons.join("; ")].map(cell).join(","),
  );
  return "\uFEFF" + [head, ...body].join("\r\n");
}

// Tabel lengkap per project; baris bisa dibuka untuk melihat tiap fase.
export default function ProjectReportTable() {
  const { rows, today } = useReportRows();
  const [status, setStatus] = useState<"Semua" | "Active" | "Hold" | "Cancelled" | "Perhatian">("Semua");
  const [q, setQ] = useState("");

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        if (status === "Perhatian" ? r.reasons.length === 0 : status !== "Semua" && r.project.status !== status) return false;
        const n = q.trim().toLowerCase();
        return !n || r.project.name.toLowerCase().includes(n);
      }),
    [rows, status, q],
  );

  function exportCsv() {
    const blob = new Blob([toCsv(filtered)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `laporan-project-${dayjs().format("YYYYMMDD")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Card>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12, alignItems: "center" }}>
        <Segmented value={status} onChange={(v) => setStatus(v as typeof status)} options={[{ value: "Semua", label: "Semua" }, { value: "Active", label: "Active" }, { value: "Hold", label: "Hold" }, { value: "Cancelled", label: "Cancelled" }, { value: "Perhatian", label: "Perlu perhatian" }]} />
        <Input allowClear prefix={<SearchOutlined />} placeholder="Cari project…" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 260 }} />
        <Text type="secondary" style={{ marginInlineStart: "auto" }}>{filtered.length} dari {rows.length} project</Text>
        <Button icon={<DownloadOutlined />} onClick={exportCsv} disabled={filtered.length === 0}>Ekspor CSV</Button>
      </div>
      <Table<ProjectReportRow>
        rowKey={(r) => r.project.id}
        size="middle"
        dataSource={filtered}
        pagination={false}
        scroll={{ x: "max-content" }}
        expandable={{
          expandedRowRender: (r) => (
            <Table
              size="small"
              pagination={false}
              rowKey="id"
              dataSource={r.phases}
              columns={[
                { title: "Fase", dataIndex: "name" },
                { title: "Tahap", dataIndex: "stage", width: 120, render: (v: string) => <Tag>{v}</Tag> },
                { title: "Mulai", dataIndex: "startDate", width: 120, render: (v: string) => formatDate(v, today) },
                { title: "Target live", dataIndex: "targetLiveDate", width: 130, render: (v: string) => formatDate(v, today) },
                { title: "Progress", dataIndex: "progressPercent", width: 160, render: (v: number) => <Progress percent={v} size="small" /> },
              ]}
            />
          ),
        }}
        columns={[
          { title: "Project", render: (_, r) => <Link href={`/projects/${r.project.id}`} style={{ fontWeight: 500, color: "inherit" }}>{r.project.name}</Link> },
          { title: "Status", width: 100, render: (_, r) => <Tag color={getProjectStatusColor(r.project.status)}>{r.project.status}</Tag> },
          { title: "Tahap", dataIndex: "stage", width: 110, render: (v: string) => <Tag>{v}</Tag> },
          { title: "Mulai", width: 120, render: (_, r) => (r.startDate ? formatDate(r.startDate, today) : "—") },
          { title: "Target live", width: 130, render: (_, r) => (r.targetDate ? formatDate(r.targetDate, today) : "—") },
          { title: "Progress project", width: 160, render: (_, r) => <Progress percent={r.project.overallProgress} size="small" /> },
          { title: "Progress task", width: 150, render: (_, r) => (r.taskProgress === null ? <Text type="secondary">Belum ada task</Text> : <Progress percent={r.taskProgress} size="small" strokeColor="#2F80ED" />) },
          { title: "Task aktif", dataIndex: "openTasks", width: 90 },
          { title: "Terlambat", dataIndex: "overdueTasks", width: 100, render: (v: number) => (v ? <Text style={{ color: "#C4153F", fontWeight: 600 }}>{v}</Text> : <Text type="secondary">0</Text>) },
          { title: "Rapat berikutnya", width: 140, render: (_, r) => (r.nextMeeting ? formatDate(r.nextMeeting, today) : <Text type="secondary">—</Text>) },
          { title: "Perhatian", width: 220, render: (_, r) => (r.reasons.length ? <Space size={4} wrap>{r.reasons.map((x) => <Tag key={x} color="volcano" style={{ marginInlineEnd: 0 }}>{x}</Tag>)}</Space> : <Text type="secondary">—</Text>) },
        ]}
      />
    </Card>
  );
}
