"use client";

import { useMemo } from "react";
import Link from "next/link";
import dayjs from "dayjs";
import { Card, Empty, Progress, Table, Typography } from "antd";
import { projects, type Project, type Task } from "@/lib/mock-data";
import { canAccessProject } from "@/lib/access";
import { useCurrentUser } from "@/lib/acting-user";
import { useStatusMeta } from "@/lib/master-store";
import { useProjectStructure } from "@/lib/project-structure";
import { useTaskStore } from "@/lib/task-store";
import { useTaskPermissions } from "@/lib/use-task-permissions";
import { DUE_COLOR, getDueInfo, useToday } from "@/lib/task-ui";
import { StatusBadge } from "@/components/tasks/TaskStatus";
import PicAvatars from "@/components/tasks/PicAvatars";

const { Text } = Typography;

export function DueChip({ date, done, today }: { date: string; done: boolean; today: string }) {
  const due = getDueInfo({ dueDate: date, done }, today);
  // "25 Sep 2026 · telat 54 hari" -> tanggal di baris atas, keterangan di baris bawah agar kolom tidak melebar.
  const [main, note] = due.label.split(" · ");
  return (
    <span style={{ color: DUE_COLOR[due.state], display: "inline-flex", flexDirection: "column", lineHeight: 1.35, whiteSpace: "nowrap" }}>
      <span style={{ fontWeight: due.state === "overdue" ? 600 : 400 }}>{main}</span>
      {note && <span style={{ fontSize: 12 }}>{note}</span>}
    </span>
  );
}

export type PicRow = { name: string; total: number; open: number; late: number; avg: number; next?: string };

// Data pribadi & cakupan project untuk Dashboard, dihitung dari store task dan tim project,
// sehingga otomatis sinkron dengan Task Board dan detail project.
//
// Cakupan project (siapa melihat project apa) = aturan akses project: Administrator semua; selain itu
// pembuat, PMO/Developer tim project, atau PIC salah satu task di project itu.
export function useMyWork() {
  const me = useCurrentUser();
  const { tasks } = useTaskStore();
  const { isDone } = useStatusMeta();
  const { phasesOf, pmoOf, developersOf } = useProjectStructure();
  const perms = useTaskPermissions();
  const today = useToday();

  return useMemo(() => {
    const todayD = dayjs(today);
    const late = (t: Task) => !!today && dayjs(t.dueDate).isBefore(todayD, "day");
    const myTasks = tasks.filter((t) => perms.isPic(t));
    const active = myTasks.filter((t) => !isDone(t.status));
    const overdue = active.filter(late);
    const soon = active.filter((t) => {
      if (!today) return false;
      const d = dayjs(t.dueDate).diff(todayD, "day");
      return d >= 0 && d <= 7;
    });

    const scope: Project[] = projects.filter(
      (p) => perms.canManage(p.id) || canAccessProject(me, { ...p, pmo: pmoOf(p.id), developers: developersOf(p.id) }) || myTasks.some((t) => t.projectId === p.id),
    );
    const inScope = new Set(scope.map((p) => p.id));

    const projectRows = scope.map((p) => {
      const pTasks = tasks.filter((t) => t.projectId === p.id && !t.parentId);
      const open = pTasks.filter((t) => !isDone(t.status));
      const phases = phasesOf(p.id);
      const targets = phases.map((ph) => ph.targetLiveDate).filter(Boolean).sort();
      return {
        project: p,
        phase: phases[phases.length - 1] ?? p.phases[p.phases.length - 1],
        taskProgress: pTasks.length ? Math.round(pTasks.reduce((s, t) => s + t.progressPercent, 0) / pTasks.length) : null,
        total: pTasks.length,
        open: open.length,
        late: open.filter(late).length,
        target: targets[targets.length - 1] as string | undefined,
        mine: myTasks.filter((t) => t.projectId === p.id).length,
        pmoNames: pmoOf(p.id).map((m) => m.name),
        managed: perms.canManage(p.id),
      };
    });

    // Progress per PIC — hanya project yang saya pegang sebagai PMO (atau semua kalau Administrator).
    const managed = new Set(scope.filter((p) => perms.canManage(p.id)).map((p) => p.id));
    const picMap = new Map<string, Task[]>();
    for (const t of tasks) {
      if (!managed.has(t.projectId)) continue;
      for (const n of t.pics) picMap.set(n, [...(picMap.get(n) ?? []), t]);
    }
    const picRows: PicRow[] = Array.from(picMap.entries())
      .map(([name, list]) => {
        const open = list.filter((t) => !isDone(t.status));
        return { name, total: list.length, open: open.length, late: open.filter(late).length, avg: list.length ? Math.round(list.reduce((s, t) => s + t.progressPercent, 0) / list.length) : 0, next: open.map((t) => t.dueDate).sort()[0] };
      })
      .sort((a, b) => b.late - a.late || b.open - a.open);

    const scopedTasks = tasks.filter((t) => inScope.has(t.projectId));
    const managedLate = tasks.filter((t) => managed.has(t.projectId) && !isDone(t.status) && late(t)).length;
    return { myTasks, active, overdue, soon, scope, inScope, projectRows, picRows, managedCount: managed.size, managedLate, scopedTasks, byId: new Map(tasks.map((t) => [t.id, t])), today };
  }, [tasks, isDone, perms, today, pmoOf, phasesOf, developersOf, me]);
}

export type MyWorkData = ReturnType<typeof useMyWork>;

export function MyTasksCard({ data }: { data: MyWorkData }) {
  const { isDone } = useStatusMeta();
  const today = data.today;
  return (
    <Card title="Task Saya" extra={<Link href="/tasks">Buka Task Board</Link>} styles={{ body: { paddingTop: 8 } }} style={{ height: "100%" }}>
      {data.myTasks.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Belum ada task yang ditujukan ke kamu sebagai PIC." />
      ) : (
        <Table<Task>
          rowKey="id"
          size="small"
          pagination={false}
          scroll={{ x: 640, y: 330 }}
          dataSource={[...data.myTasks].sort((a, b) => Number(isDone(a.status)) - Number(isDone(b.status)) || a.dueDate.localeCompare(b.dueDate))}
          columns={[
            {
              title: "Task",
              width: 260,
              render: (_, t) => {
                const parent = t.parentId ? data.byId.get(t.parentId) : undefined;
                const project = projects.find((p) => p.id === t.projectId);
                return (
                  <div>
                    <Link href={`/tasks/${parent?.id ?? t.id}`} style={{ fontWeight: 500, color: "inherit" }}>
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
            { title: "Progress", width: 110, render: (_, t) => <Progress percent={t.progressPercent} size="small" /> },
            { title: "Target", width: 130, render: (_, t) => <DueChip date={t.dueDate} done={isDone(t.status)} today={today} /> },
            { title: "Status", width: 120, render: (_, t) => <StatusBadge status={t.status} /> },
          ]}
        />
      )}
    </Card>
  );
}

export function PicProgressCard({ data }: { data: MyWorkData }) {
  if (data.managedCount === 0) return null;
  const today = data.today;
  return (
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
            { title: "PIC", dataIndex: "name", render: (v: string) => <PicAvatars names={[v]} size={22} />, width: 70 },
            { title: "Nama", dataIndex: "name" },
            { title: "Task", dataIndex: "total", width: 80 },
            { title: "Aktif", dataIndex: "open", width: 80 },
            { title: "Terlambat", dataIndex: "late", width: 100, render: (v: number) => (v ? <Text style={{ color: "#C4153F", fontWeight: 600 }}>{v}</Text> : <Text type="secondary">0</Text>) },
            { title: "Rata-rata progress", dataIndex: "avg", width: 180, render: (v: number) => <Progress percent={v} size="small" /> },
            { title: "Target terdekat", dataIndex: "next", width: 130, render: (v?: string) => (v ? <DueChip date={v} done={false} today={today} /> : <Text type="secondary">—</Text>) },
          ]}
        />
      )}
    </Card>
  );
}
