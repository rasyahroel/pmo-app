"use client";

import { useMemo } from "react";
import Link from "next/link";
import dayjs from "dayjs";
import { Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from "recharts";
import { Card, Col, Empty, Progress, Row, Statistic, Table, Tag, Typography } from "antd";
import { CheckCircleFilled, WarningOutlined } from "@ant-design/icons";
import { projects } from "@/lib/mock-data";
import { useMeetingMeta, useStatusMeta } from "@/lib/master-store";
import { useProjectStructure } from "@/lib/project-structure";
import { useMeetingStore } from "@/lib/meeting-store";
import { useTaskStore } from "@/lib/task-store";
import { buildProjectRows, type ProjectReportRow } from "@/lib/report-data";
import { formatDate, useToday } from "@/lib/task-ui";

const { Text } = Typography;

export function useReportRows() {
  const today = useToday();
  const { tasks } = useTaskStore();
  const { meetings } = useMeetingStore();
  const { phasesOf } = useProjectStructure();
  const { isDone } = useStatusMeta();
  const meta = useMeetingMeta();
  const rows = useMemo(
    () => buildProjectRows({ projects, phasesOf, tasks, meetings, isTaskDone: isDone, meetingKind: meta.statusKind, today }),
    [phasesOf, tasks, meetings, isDone, meta, today],
  );
  return { rows, today };
}

// Ringkasan: kesehatan seluruh project dalam satu layar, dan daftar project yang perlu perhatian.
export default function ReportSummary() {
  const { rows, today } = useReportRows();
  const { tasks } = useTaskStore();
  const { meetings } = useMeetingStore();
  const { statuses, isDone } = useStatusMeta();
  const meta = useMeetingMeta();

  const top = tasks.filter((t) => !t.parentId);
  const openTasks = top.filter((t) => !isDone(t.status));
  const overdue = openTasks.filter((t) => t.dueDate < today);
  const avgProgress = rows.length ? Math.round(rows.reduce((s, r) => s + r.project.overallProgress, 0) / rows.length) : 0;
  const monthMeetings = meetings.filter((m) => dayjs(m.startsAt).isSame(dayjs(today), "month"));
  const noMom = meetings.filter((m) => meta.statusKind(m.statusId) === "done" && !m.summary && m.attachments.length === 0 && m.actionItems.length === 0);
  const attention = rows.filter((r) => r.reasons.length > 0).sort((a, b) => b.reasons.length - a.reasons.length);

  const statusData = statuses.map((s) => ({ name: s.name, value: top.filter((t) => t.status === s.id).length, color: s.color }));
  const progressData = rows.map((r) => ({ name: r.project.name.length > 22 ? `${r.project.name.slice(0, 21)}…` : r.project.name, Project: r.project.overallProgress, Task: r.taskProgress ?? 0 }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Row gutter={[12, 12]}>
        <Col xs={12} md={6}><Card><Statistic title="Total project" value={rows.length} suffix={<Text type="secondary" style={{ fontSize: 13 }}>{rows.filter((r) => r.project.status === "Active").length} aktif · {rows.filter((r) => r.project.status === "Hold").length} hold</Text>} /></Card></Col>
        <Col xs={12} md={6}><Card><Statistic title="Rata-rata progress" value={avgProgress} suffix="%" /></Card></Col>
        <Col xs={12} md={6}><Card><Statistic title="Task aktif" value={openTasks.length} suffix={<Text type="secondary" style={{ fontSize: 13 }}>dari {top.length}</Text>} /></Card></Col>
        <Col xs={12} md={6}><Card><Statistic title="Task terlambat" value={overdue.length} styles={{ content: { color: overdue.length ? "#C4153F" : undefined } }} /></Card></Col>
        <Col xs={12} md={6}><Card><Statistic title="Rapat bulan ini" value={monthMeetings.length} /></Card></Col>
        <Col xs={12} md={6}><Card><Statistic title="Hasil rapat belum ada" value={noMom.length} styles={{ content: { color: noMom.length ? "#9A6200" : undefined } }} /></Card></Col>
        <Col xs={12} md={6}><Card><Statistic title="Project perlu perhatian" value={attention.length} prefix={attention.length ? <WarningOutlined /> : <CheckCircleFilled style={{ color: "#17A34A" }} />} styles={{ content: { color: attention.length ? "#C4153F" : "#17A34A" } }} /></Card></Col>
      </Row>

      <Card title="Perlu perhatian" extra={<Text type="secondary" style={{ fontSize: 12 }}>Aturan: project di-Hold, ada task terlambat, atau target live terlewat / ≤ 14 hari dengan progress &lt; 80%</Text>}>
        {attention.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Semua project dalam kondisi baik." />
        ) : (
          <Table<ProjectReportRow>
            rowKey={(r) => r.project.id}
            size="small"
            pagination={false}
            dataSource={attention}
            scroll={{ x: "max-content" }}
            columns={[
              { title: "Project", render: (_, r) => <Link href={`/projects/${r.project.id}`} style={{ fontWeight: 500, color: "inherit" }}>{r.project.name}</Link> },
              { title: "Alasan", render: (_, r) => <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>{r.reasons.map((x) => <Tag key={x} color="volcano" style={{ marginInlineEnd: 0 }}>{x}</Tag>)}</div> },
              { title: "Progress", width: 150, render: (_, r) => <Progress percent={r.project.overallProgress} size="small" /> },
              { title: "Target live", width: 130, render: (_, r) => (r.targetDate ? formatDate(r.targetDate, today) : "—") },
            ]}
          />
        )}
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={10}>
          <Card title="Task per status">
            <div style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <RTooltip />
                  <Bar dataKey="value" name="Task" radius={[6, 6, 0, 0]}>
                    {statusData.map((d) => <Cell key={d.name} fill={d.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </Col>
        <Col xs={24} lg={14}>
          <Card title="Progress project dan task">
            <div style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={progressData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                  <RTooltip />
                  <Legend />
                  <Bar dataKey="Project" fill="#22A7B8" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="Task" fill="#2F80ED" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
