"use client";

import { useMemo } from "react";
import Link from "next/link";
import dayjs from "dayjs";
import { Card, Col, Empty, Progress, Row, Statistic, Table, Tag, Typography } from "antd";
import { projects, type Project, type Task } from "@/lib/mock-data";
import { canAccessProject, currentUser } from "@/lib/access";
import { useStatusMeta } from "@/lib/master-store";
import { useProjectStructure } from "@/lib/project-structure";
import { useTaskStore } from "@/lib/task-store";
import { useTaskPermissions } from "@/lib/use-task-permissions";
import { DUE_COLOR, formatDate, getDueInfo, useToday } from "@/lib/task-ui";
import { StatusBadge } from "@/components/tasks/TaskStatus";
import PicAvatars from "@/components/tasks/PicAvatars";

const { Text } = Typography;

function DueChip({ date, done, today }: { date: string; done: boolean; today: string }) {
  const due = getDueInfo({ dueDate: date, done }, today);
  return (
    <span style={{ color: DUE_COLOR[due.state], fontWeight: due.state === "overdue" ? 600 : 400, whiteSpace: "nowrap" }}>
      {formatDate(date, today)}
      {due.label && <span style={{ fontSize: 12 }}> · {due.label}</span>}
    </span>
  );
}

// Ringkasan pribadi di dashboard: task yang saya pegang sebagai PIC, project yang terkait dengan
// saya (progress & target), dan — kalau saya PMO — progress tiap PIC di project yang saya pegang.
// Semua dihitung dari store task, jadi otomatis sinkron dengan Task Board & detail project.
export default function MyWork() {
  const { tasks } = useTaskStore();
  const { isDone } = useStatusMeta();
  const { phasesOf, pmoOf } = useProjectStructure();
  const perms = useTaskPermissions();
  const today = useToday();

  const data = useMemo(() => {
    const myTasks = tasks.filter((t) => perms.isPic(t));
    const active = myTasks.filter((t) => !isDone(t.status));
    const overdue = active.filter((t) => dayjs(t.dueDate).isBefore(dayjs(today), "day"));
    const soon = active.filter((t) => {
      const d = dayjs(t.dueDate).diff(dayjs(today), "day");
      return d >= 0 && d <= 7;
    });

    const byId = new Map(tasks.map((t) => [t.id, t]));
    const projectCards = projects
      .filter(
        (p) =>
          perms.canManage(p.id) ||
          canAccessProject(currentUser, { ...p, pmo: pmoOf(p.id) }) ||
          myTasks.some((t) => t.projectId === p.id),
      )
      .map((p: Project) => {
        const pTasks = tasks.filter((t) => t.projectId === p.id && !t.parentId);
        const taskProgress = pTasks.length ? Math.round(pTasks.reduce((s, t) => s + t.progressPercent, 0) / pTasks.length) : null;
        const open = pTasks.filter((t) => !isDone(t.status));
        const late = open.filter((t) => dayjs(t.dueDate).isBefore(dayjs(today), "day")).length;
        const targets = phasesOf(p.id).map((ph) => ph.targetLiveDate).filter(Boolean).sort();
        return {
          project: p,
          taskProgress,
          total: pTasks.length,
          open: open.length,
          late,
          target: targets[targets.length - 1],
          mine: myTasks.filter((t) => t.projectId === p.id).length,
          pmoNames: pmoOf(p.id).map((m) => m.name),
        };
      });

    // Progress per PIC — hanya project yang saya pegang sebagai PMO (atau semua kalau Administrator).
    const managed = new Set(projects.filter((p) => perms.canManage(p.id)).map((p) => p.id));
    const picMap = new Map<string, { name: string; tasks: Task[] }>();
    for (const t of tasks) {
      if (!managed.has(t.projectId)) continue;
      for (const n of t.pics) {
        const row = picMap.get(n) ?? { name: n, tasks: [] };
        row.tasks.push(t);
        picMap.set(n, row);
      }
    }
    const picRows = Array.from(picMap.values())
      .map((r) => {
        const open = r.tasks.filter((t) => !isDone(t.status));
        const late = open.filter((t) => dayjs(t.dueDate).isBefore(dayjs(today), "day")).length;
        const avg = r.tasks.length ? Math.round(r.tasks.reduce((s, t) => s + t.progressPercent, 0) / r.tasks.length) : 0;
        const next = open.map((t) => t.dueDate).sort()[0];
        return { name: r.name, total: r.tasks.length, open: open.length, late, avg, next };
      })
      .sort((a, b) => b.late - a.late || b.open - a.open);

    return { myTasks, active, overdue, soon, projectCards, picRows, byId, managedCount: managed.size };
  }, [tasks, isDone, perms, today, pmoOf, phasesOf]);

  return (
    <div style={{ marginBottom: 24 }}>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="Task Saya (aktif)" value={data.active.length} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="Terlambat" value={data.overdue.length} styles={{ content: { color: data.overdue.length ? "#C4153F" : undefined } }} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="Jatuh Tempo ≤ 7 Hari" value={data.soon.length} styles={{ content: { color: data.soon.length ? "#9A6200" : undefined } }} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="Project Saya" value={data.projectCards.length} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={15}>
          <Card title="Task Saya" styles={{ body: { paddingTop: 8 } }}>
            {data.myTasks.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Belum ada task yang ditujukan ke kamu sebagai PIC." />
            ) : (
              <Table<Task>
                rowKey="id"
                size="small"
                pagination={false}
                scroll={{ x: "max-content" }}
                dataSource={[...data.myTasks].sort((a, b) => Number(isDone(a.status)) - Number(isDone(b.status)) || a.dueDate.localeCompare(b.dueDate))}
                columns={[
                  {
                    title: "Task",
                    render: (_, t) => {
                      const parent = t.parentId ? data.byId.get(t.parentId) : undefined;
                      const project = projects.find((p) => p.id === t.projectId);
                      return (
                        <div>
                          <Link href={`/tasks/${t.id}`} style={{ fontWeight: 500, color: "inherit" }}>
                            {t.title}
                          </Link>
                          <div>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              {project?.name}
                              {parent ? ` · sub task dari ${parent.title}` : ""}
                            </Text>
                          </div>
                        </div>
                      );
                    },
                  },
                  { title: "PIC", width: 100, render: (_, t) => <PicAvatars names={t.pics} max={3} size={22} /> },
                  { title: "Progress", width: 140, render: (_, t) => <Progress percent={t.progressPercent} size="small" /> },
                  { title: "Target", width: 190, render: (_, t) => <DueChip date={t.dueDate} done={isDone(t.status)} today={today} /> },
                  { title: "Status", width: 130, render: (_, t) => <StatusBadge status={t.status} /> },
                ]}
              />
            )}
          </Card>
        </Col>

        <Col xs={24} xl={9}>
          <Card title="Project Saya">
            {data.projectCards.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Belum ada project terkait." />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {data.projectCards.map((c) => (
                  <div key={c.project.id} style={{ paddingBottom: 14, borderBottom: "1px solid #F0F1F5" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                      <Link href={`/projects/${c.project.id}`} style={{ fontWeight: 600, color: "inherit" }}>
                        {c.project.name}
                      </Link>
                      {c.mine > 0 && <Tag color="cyan" variant="filled" style={{ marginInlineEnd: 0 }}>{c.mine} task saya</Tag>}
                    </div>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      PMO: {c.pmoNames.join(", ") || "—"}
                    </Text>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 8 }}>
                      <div>
                        <Text type="secondary" style={{ fontSize: 12 }}>Progress project</Text>
                        <Progress percent={c.project.overallProgress} size="small" />
                      </div>
                      <div>
                        <Text type="secondary" style={{ fontSize: 12 }}>Progress task</Text>
                        {c.taskProgress === null ? (
                          <div><Text type="secondary">Belum ada task</Text></div>
                        ) : (
                          <Progress percent={c.taskProgress} size="small" strokeColor="#2F80ED" />
                        )}
                      </div>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginTop: 6, fontSize: 12 }}>
                      <span>
                        Target live:{" "}
                        {c.target ? <DueChip date={c.target} done={c.project.overallProgress >= 100} today={today} /> : "—"}
                      </span>
                      <span style={{ color: c.late ? "#C4153F" : "#6B7280" }}>
                        {c.open} task aktif{c.late ? ` · ${c.late} terlambat` : ""}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {data.managedCount > 0 && (
        <Card title="Progress PIC di Project yang Saya Pegang" style={{ marginTop: 16 }} styles={{ body: { paddingTop: 8 } }}>
          {data.picRows.length === 0 ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Belum ada task di project yang kamu pegang." />
          ) : (
            <Table
              rowKey="name"
              size="small"
              pagination={false}
              scroll={{ x: "max-content" }}
              dataSource={data.picRows}
              columns={[
                { title: "PIC", dataIndex: "name", render: (v: string) => <PicAvatars names={[v]} size={22} /> , width: 70 },
                { title: "Nama", dataIndex: "name" },
                { title: "Task", dataIndex: "total", width: 80 },
                { title: "Aktif", dataIndex: "open", width: 80 },
                {
                  title: "Terlambat",
                  dataIndex: "late",
                  width: 100,
                  render: (v: number) => (v ? <Text style={{ color: "#C4153F", fontWeight: 600 }}>{v}</Text> : <Text type="secondary">0</Text>),
                },
                { title: "Rata-rata progress", dataIndex: "avg", width: 180, render: (v: number) => <Progress percent={v} size="small" /> },
                { title: "Target terdekat", dataIndex: "next", width: 170, render: (v?: string) => (v ? <DueChip date={v} done={false} today={today} /> : <Text type="secondary">—</Text>) },
              ]}
            />
          )}
        </Card>
      )}
    </div>
  );
}
