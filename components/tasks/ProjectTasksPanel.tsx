"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { App, Button, Card, Popconfirm, Progress, Space, Tag, Tooltip, Typography } from "antd";
import { AuditOutlined, DeleteOutlined, EditOutlined, ExportOutlined, PlusOutlined } from "@ant-design/icons";
import DataTable, { type DataColumn } from "@/components/common/DataTable";
import PicAvatars from "@/components/tasks/PicAvatars";
import TaskFormModal from "@/components/tasks/TaskFormModal";
import TaskReviewModal from "@/components/tasks/TaskReviewModal";
import TaskStatusSwitch, { StatusDot } from "@/components/tasks/TaskStatus";
import { getReviewStatusColor, type Task } from "@/lib/mock-data";
import { useCategoryName, useMasterStore, useStatusMeta } from "@/lib/master-store";
import { DUE_COLOR, formatDate, getDueInfo, useToday } from "@/lib/task-ui";
import { useTaskStore } from "@/lib/task-store";
import { useTaskPermissions } from "@/lib/use-task-permissions";

const { Text } = Typography;

type Row = Task & { children?: Task[] };

// Tab "Task & Rapat" di detail project — bagian Task.
// Datanya SAMA dengan menu Task Board (satu store): tambah/ubah/hapus/pindah status dari sini
// langsung tampil di Task Board, dan sebaliknya. Tombol mengikuti hak akses pengguna.
export default function ProjectTasksPanel({
  projectId,
  phases,
  members,
}: {
  projectId: string;
  /** fase milik project ini (state detail project, bisa lebih baru dari data awal) */
  phases: { id: string; name: string }[];
  /** nama anggota tim — saran untuk kolom PIC */
  members: string[];
}) {
  const { message } = App.useApp();
  const { tasks, deleteTask } = useTaskStore();
  const { taskCategories } = useMasterStore();
  const { statuses, styleOf, isDone, nameOf } = useStatusMeta();
  const categoryNameOf = useCategoryName();
  const perms = useTaskPermissions();
  const today = useToday();
  const [form, setForm] = useState<{ task: Task | null } | null>(null);
  const [reviewTask, setReviewTask] = useState<Task | null>(null);

  // Baris tabel = task induk; sub task jadi baris anak (bisa dibuka-tutup).
  const rows = useMemo<Row[]>(() => {
    const mine = tasks.filter((t) => t.projectId === projectId);
    return mine
      .filter((t) => !t.parentId)
      .map((t) => {
        const kids = mine.filter((k) => k.parentId === t.id);
        return kids.length > 0 ? { ...t, children: kids } : t;
      });
  }, [tasks, projectId]);
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(r.status, (m.get(r.status) ?? 0) + 1);
    return m;
  }, [rows]);

  const editTargetOf = (t: Task) => (t.parentId ? (tasks.find((x) => x.id === t.parentId) ?? t) : t);

  const columns: DataColumn<Row>[] = [
    {
      title: "Task",
      dataIndex: "title",
      render: (v: string, t) => (
        <Link href={`/tasks/${t.id}`} style={{ color: "inherit", fontWeight: t.parentId ? 400 : 500 }}>
          {v}
        </Link>
      ),
    },
    {
      title: "Fase",
      dataIndex: "phaseId",
      width: 90,
      filters: phases.map((p) => ({ text: p.name, value: p.id })),
      onFilter: (value, t) => t.phaseId === value,
      searchValue: (t) => phases.find((p) => p.id === t.phaseId)?.name ?? t.phaseId,
      render: (v: string) => phases.find((p) => p.id === v)?.name ?? v,
    },
    {
      title: "Kategori",
      dataIndex: "category",
      width: 150,
      sortable: false,
      filters: taskCategories.map((c) => ({ text: c.name, value: c.id })),
      onFilter: (value, t) => t.category === value,
      searchValue: (t) => categoryNameOf(t.category),
      render: (v: string, t) => (t.parentId ? null : <Tag style={{ fontSize: 11 }}>{categoryNameOf(v)}</Tag>),
    },
    {
      title: "Status",
      dataIndex: "status",
      width: 140,
      sortable: false,
      filters: statuses.map((s) => ({ text: s.name, value: s.id })),
      onFilter: (value, t) => t.status === value,
      searchValue: (t) => nameOf(t.status),
      render: (_: unknown, t) => <TaskStatusSwitch task={t} />, // klik untuk ganti status
    },
    {
      title: "Progress",
      dataIndex: "progressPercent",
      width: 120,
      searchable: false,
      render: (v: number, t) => <Progress percent={v} size="small" strokeColor={styleOf(t.status).main} />,
    },
    {
      title: "PIC",
      dataIndex: "pics",
      width: 110,
      sortable: false,
      searchValue: (t) => t.pics.join(" "),
      render: (v: string[]) => <PicAvatars names={v} max={3} size={22} />,
    },
    {
      title: "Due",
      dataIndex: "dueDate",
      width: 130,
      render: (v: string, t) => {
        const due = getDueInfo({ dueDate: v, done: isDone(t.status) }, today);
        return (
          <Tooltip title={due.label || undefined}>
            <span style={{ color: DUE_COLOR[due.state], fontWeight: due.state === "overdue" ? 600 : 400 }}>{formatDate(v, today)}</span>
          </Tooltip>
        );
      },
    },
    {
      title: "Review",
      width: 190,
      searchValue: (t) => `${t.reviewStatus ?? "Belum Direview"} ${t.reviewedBy ?? ""}`,
      render: (_: unknown, t) =>
        t.parentId ? null : (
          <Space orientation="vertical" size={0}>
            <Tag color={getReviewStatusColor(t.reviewStatus)} style={{ marginInlineEnd: 0 }}>
              {t.reviewStatus ?? "Belum Direview"}
            </Tag>
            {t.reviewedBy && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                {t.reviewedBy}
                {t.reviewedAt ? ` · ${formatDate(t.reviewedAt, today)}` : ""}
              </Text>
            )}
          </Space>
        ),
    },
    {
      title: "",
      key: "actions",
      width: 100,
      fixed: "right",
      render: (_: unknown, t) => (
        <Space size={0}>
          {perms.canUpdate(t) && (
            <Tooltip title="Ubah task">
              <Button size="small" type="text" icon={<EditOutlined />} aria-label="Ubah task" onClick={() => setForm({ task: editTargetOf(t) })} />
            </Tooltip>
          )}
          {!t.parentId && perms.canReview(t) && (
            <Tooltip title="Review">
              <Button size="small" type="text" icon={<AuditOutlined />} aria-label="Review task" onClick={() => setReviewTask(t)} />
            </Tooltip>
          )}
          {perms.canUpdate(t) && (
            <Popconfirm
              title={t.parentId ? "Hapus sub task ini?" : "Hapus task ini? Sub task-nya ikut terhapus."}
              description={t.title}
              okText="Hapus"
              cancelText="Batal"
              okButtonProps={{ danger: true }}
              onConfirm={() => {
                const res = deleteTask(t.id);
                if (res.ok) message.success(t.parentId ? "Sub task dihapus." : "Task dihapus.");
                else message.warning(res.reason);
              }}
            >
              <Button size="small" type="text" danger icon={<DeleteOutlined />} aria-label="Hapus task" />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <Card
      title="Task terkait project ini"
      size="small"
      extra={
        <Link href={`/tasks?projectId=${projectId}`}>
          <Button size="small" icon={<ExportOutlined />}>
            Buka di Task Board
          </Button>
        </Link>
      }
    >
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        {statuses.map((s) => {
          const st = styleOf(s.id);
          return (
            <span
              key={s.id}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "2px 10px",
                borderRadius: 999,
                fontSize: 12,
                color: st.text,
                background: st.soft,
                borderStyle: "solid",
                borderWidth: 1,
                borderColor: st.border,
              }}
            >
              <StatusDot status={s.id} size={7} />
              {s.name}
              <b>{counts.get(s.id) ?? 0}</b>
            </span>
          );
        })}
      </div>

      <DataTable
        rowKey="id"
        size="small"
        dataSource={rows}
        expandable={{ defaultExpandAllRows: true }}
        defaultPageSize={10}
        searchPlaceholder="Cari task, fase, kategori, PIC..."
        locale={{ emptyText: "Belum ada task." }}
        scroll={{ x: 1050 }}
        toolbar={
          perms.canCreateIn(projectId) ? (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setForm({ task: null })}>
              Tambah Task
            </Button>
          ) : undefined
        }
        columns={columns}
      />
      <Text type="secondary" style={{ display: "block", fontSize: 12, marginTop: 8 }}>
        Data task sama dengan menu Task Board — perubahan di sini langsung tampil di sana, dan sebaliknya.
      </Text>

      <TaskFormModal
        open={form !== null}
        task={form?.task ?? null}
        defaults={{ projectId }}
        lockProject
        phasesOf={() => phases}
        membersOf={() => members}
        onClose={() => setForm(null)}
      />
      <TaskReviewModal task={reviewTask} onClose={() => setReviewTask(null)} />
    </Card>
  );
}
