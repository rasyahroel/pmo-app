"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Alert, App, Button, Card, Col, Empty, Popconfirm, Progress, Result, Row, Space, Tabs, Tag, Timeline, Typography } from "antd";
import {
  ApartmentOutlined,
  ArrowLeftOutlined,
  AuditOutlined,
  CalendarOutlined,
  CheckCircleFilled,
  CommentOutlined,
  DeleteOutlined,
  EditOutlined,
  HistoryOutlined,
  MessageOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import { getReviewStatusColor, type Task } from "@/lib/mock-data";
import { useCategoryName, useStatusMeta } from "@/lib/master-store";
import { useSubtasks, useTaskStore } from "@/lib/task-store";
import { useAuditStore, projectNameById } from "@/lib/audit-store";
import { useCommentStore } from "@/lib/comment-store";
import { DUE_COLOR, formatDate, getDueInfo, projectColor, useToday } from "@/lib/task-ui";
import { projects } from "@/lib/mock-data";
import TaskStatusSwitch from "@/components/tasks/TaskStatus";
import { useTaskPermissions } from "@/lib/use-task-permissions";
import { PicChips } from "@/components/tasks/PicAvatars";
import AttachmentsView from "@/components/tasks/AttachmentsView";
import TaskComments from "@/components/tasks/TaskComments";
import TaskFormModal from "@/components/tasks/TaskFormModal";
import TaskReviewModal from "@/components/tasks/TaskReviewModal";

const { Text, Title } = Typography;

const fmtTime = (iso: string) => new Date(iso).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });

function Label({ children }: { children: string }) {
  return <div style={{ fontSize: 12, color: "#8C93A3", marginBottom: 4 }}>{children}</div>;
}

function DueText({ task, today }: { task: Task; today: string }) {
  const { isDone } = useStatusMeta();
  const due = getDueInfo({ dueDate: task.dueDate, done: isDone(task.status) }, today);
  return (
    <span style={{ color: DUE_COLOR[due.state], fontWeight: due.state === "overdue" ? 600 : 400 }}>
      {formatDate(task.startDate, today)} — {formatDate(task.dueDate, today)}
      {due.label && <span style={{ marginInlineStart: 6, fontSize: 12 }}>({due.label})</span>}
    </span>
  );
}

// Satu sub task ditampilkan LENGKAP (deskripsi, PIC, lampiran) tanpa perlu dibuka satu-satu.
function SubtaskCard({ task, today, onEdit }: { task: Task; today: string; onEdit: (t: Task) => void }) {
  const { message } = App.useApp();
  const { deleteTask } = useTaskStore();
  const { styleOf, isDone } = useStatusMeta();
  const { comments } = useCommentStore();
  const perms = useTaskPermissions();
  const canEdit = perms.canUpdate(task);
  const st = styleOf(task.status);
  const done = isDone(task.status);
  const commentCount = comments.filter((c) => c.taskId === task.id).length;

  return (
    <div
      style={{
        borderStyle: "solid",
        borderWidth: "1px 1px 1px 4px",
        borderColor: `${st.border} ${st.border} ${st.border} ${st.main}`,
        borderRadius: 12,
        background: "#fff",
        padding: "14px 16px",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <Link
          href={`/tasks/${task.id}`}
          style={{
            fontWeight: 600,
            fontSize: 15,
            color: done ? "#8C93A3" : "inherit",
            textDecoration: done ? "line-through" : undefined,
            flex: 1,
            minWidth: 200,
          }}
        >
          {task.title}
        </Link>
        <TaskStatusSwitch task={task} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginTop: 12 }}>
        <div>
          <Label>PIC</Label>
          <PicChips names={task.pics} />
        </div>
        <div>
          <Label>Rentang waktu</Label>
          <DueText task={task} today={today} />
        </div>
        <div>
          <Label>Progress</Label>
          <Progress percent={task.progressPercent} size="small" strokeColor={st.main} />
        </div>
      </div>

      {task.description && (
        <div style={{ marginTop: 12 }}>
          <Label>Deskripsi</Label>
          <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", lineHeight: 1.6 }}>{task.description}</div>
        </div>
      )}

      {task.attachments.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <Label>Lampiran</Label>
          <AttachmentsView items={task.attachments} thumb={72} />
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14, gap: 8, flexWrap: "wrap" }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          <MessageOutlined /> {commentCount} komentar
        </Text>
        <Space size={6}>
          <Link href={`/tasks/${task.id}`}>
            <Button size="small">Buka detail & komentar</Button>
          </Link>
          {canEdit && (
            <Button size="small" icon={<EditOutlined />} onClick={() => onEdit(task)}>
              Ubah
            </Button>
          )}
          {canEdit && (
          <Popconfirm
            title="Hapus sub task ini?"
            description={task.title}
            okText="Hapus"
            cancelText="Batal"
            okButtonProps={{ danger: true }}
            onConfirm={() => {
              const res = deleteTask(task.id);
              if (res.ok) message.success("Sub task dihapus.");
              else message.warning(res.reason);
            }}
          >
            <Button size="small" danger icon={<DeleteOutlined />} aria-label="Hapus sub task" />
          </Popconfirm>
          )}
        </Space>
      </div>
    </div>
  );
}

export default function TaskDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { message } = App.useApp();
  const { tasks, deleteTask } = useTaskStore();
  const { styleOf, nameOf, isDone } = useStatusMeta();
  const categoryNameOf = useCategoryName();
  const { logs } = useAuditStore();
  const { comments } = useCommentStore();
  const perms = useTaskPermissions();
  const today = useToday();

  const task = tasks.find((t) => t.id === params.id);
  const parent = task?.parentId ? tasks.find((t) => t.id === task.parentId) : undefined;
  const kids = useSubtasks(task?.id);
  const [form, setForm] = useState<{ task: Task | null; parentId?: string } | null>(null);
  const [reviewTask, setReviewTask] = useState<Task | null>(null);

  // Aktivitas task ini + sub task-nya, terbaru di atas.
  const activity = useMemo(() => {
    if (!task) return [];
    const ids = new Set([task.id, ...kids.map((k) => k.id)]);
    return logs.filter((l) => l.taskId && ids.has(l.taskId)).sort((a, b) => b.changedAt.localeCompare(a.changedAt));
  }, [logs, task, kids]);

  if (!task) {
    return (
      <Result
        status="404"
        title="Task tidak ditemukan"
        subTitle="Task ini mungkin sudah dihapus, atau halaman dimuat ulang (data contoh disimpan di memori)."
        extra={
          <Link href="/tasks">
            <Button type="primary">Kembali ke Task Board</Button>
          </Link>
        }
      />
    );
  }

  const st = styleOf(task.status);
  const canEdit = perms.canUpdate(task);
  const isSub = !!task.parentId;
  const commentCount = comments.filter((c) => c.taskId === task.id).length;
  const doneKids = kids.filter((k) => isDone(k.status)).length;
  const projectName = projectNameById(task.projectId);
  const phaseName = projects.find((p) => p.id === task.projectId)?.phases.find((ph) => ph.id === task.phaseId)?.name;
  const reviewed = !!task.reviewStatus && task.reviewStatus !== "Belum Direview";
  const backHref = parent ? `/tasks/${parent.id}` : "/tasks";

  const tabItems = [
    ...(!isSub
      ? [
          {
            key: "subtasks",
            label: (
              <span>
                <ApartmentOutlined /> Sub Task ({doneKids}/{kids.length})
              </span>
            ),
            children: (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 12, flexWrap: "wrap" }}>
                  <Text type="secondary">
                    {kids.length === 0
                      ? "Pecah pekerjaan ini jadi langkah-langkah yang lebih kecil."
                      : `${doneKids} dari ${kids.length} sub task selesai — progress task ini dihitung dari sub task.`}
                  </Text>
                  {perms.canCreateSub(task) && (
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => setForm({ task: null, parentId: task.id })}>
                      Tambah sub task
                    </Button>
                  )}
                </div>
                {kids.length === 0 ? (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Belum ada sub task." />
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {kids.map((k) => (
                      <SubtaskCard key={k.id} task={k} today={today} onEdit={(t) => setForm({ task: t, parentId: task.id })} />
                    ))}
                  </div>
                )}
              </div>
            ),
          },
        ]
      : []),
    {
      key: "comments",
      label: (
        <span>
          <CommentOutlined /> Komentar ({commentCount})
        </span>
      ),
      children: <TaskComments taskId={task.id} />,
    },
    {
      key: "activity",
      label: (
        <span>
          <HistoryOutlined /> Aktivitas ({activity.length})
        </span>
      ),
      children:
        activity.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Belum ada aktivitas tercatat untuk task ini." />
        ) : (
          <div>
            <Timeline
              items={activity.map((l) => ({
                content: (
                  <div>
                    <Text strong>
                      {l.field}
                      {l.taskId !== task.id && <Text type="secondary" style={{ fontWeight: 400 }}> · {l.entity}</Text>}
                    </Text>
                    <div style={{ wordBreak: "break-word" }}>
                      <Text type="secondary" delete={l.oldValue !== "—"}>
                        {l.oldValue}
                      </Text>
                      {" → "}
                      <Text>{l.newValue}</Text>
                    </div>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {l.changedBy} · {fmtTime(l.changedAt)}
                    </Text>
                  </div>
                ),
              }))}
            />
            <Link href="/audit-trail">Lihat semua di Riwayat Perubahan →</Link>
          </div>
        ),
    },
  ];

  return (
    <div>
      <Link href={backHref} style={{ display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
        <ArrowLeftOutlined /> {parent ? `Kembali ke ${parent.title}` : "Kembali ke Task Board"}
      </Link>

      {!canEdit && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          title="Kamu bisa melihat dan berkomentar di task ini. Hanya PIC task dan PMO project yang bisa mengubahnya."
        />
      )}

      <Card styles={{ body: { padding: "18px 22px" } }} style={{ borderTop: `4px solid ${st.main}`, marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 260 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
              <span style={{ width: 9, height: 9, borderRadius: "50%", background: projectColor(task.projectId) }} />
              <Link href={`/projects/${task.projectId}`} style={{ color: "#6B7280" }}>
                {projectName}
              </Link>
              {phaseName && (
                <Tag color="cyan" variant="filled" style={{ marginInlineEnd: 0 }}>
                  {phaseName}
                </Tag>
              )}
              <Tag style={{ marginInlineEnd: 0 }}>{categoryNameOf(task.category)}</Tag>
              {isSub && (
                <Tag icon={<ApartmentOutlined />} style={{ marginInlineEnd: 0 }}>
                  Sub task
                </Tag>
              )}
            </div>
            <Title level={3} style={{ margin: 0, wordBreak: "break-word" }}>
              {task.title}
            </Title>
            {parent && (
              <Text type="secondary" style={{ fontSize: 13 }}>
                Bagian dari <Link href={`/tasks/${parent.id}`}>{parent.title}</Link>
              </Text>
            )}
          </div>
          <Space wrap align="start">
            {perms.canReview(task) && (
              <Button icon={<AuditOutlined />} onClick={() => setReviewTask(task)}>
                Review
              </Button>
            )}
            {canEdit && (
              <Button type="primary" icon={<EditOutlined />} onClick={() => setForm({ task, parentId: task.parentId })}>
                Ubah
              </Button>
            )}
            {canEdit && (
            <Popconfirm
              title={isSub ? "Hapus sub task ini?" : "Hapus task ini?"}
              description={kids.length > 0 ? `${task.title} — beserta ${kids.length} sub task-nya.` : task.title}
              okText="Hapus"
              cancelText="Batal"
              okButtonProps={{ danger: true }}
              onConfirm={() => {
                const res = deleteTask(task.id);
                if (!res.ok) {
                  message.warning(res.reason);
                  return;
                }
                message.success(isSub ? "Sub task dihapus." : "Task dihapus.");
                router.push(backHref);
              }}
            >
              <Button danger icon={<DeleteOutlined />} aria-label="Hapus" />
            </Popconfirm>
            )}
          </Space>
        </div>
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={17}>
          <Space orientation="vertical" size={16} style={{ width: "100%" }}>
            <Card title="Deskripsi & lampiran" size="small">
              {task.description ? (
                <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", lineHeight: 1.65 }}>{task.description}</div>
              ) : (
                <Text type="secondary">Belum ada deskripsi.</Text>
              )}
              {task.attachments.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <Label>{`Lampiran (${task.attachments.length})`}</Label>
                  <AttachmentsView items={task.attachments} />
                </div>
              )}
            </Card>

            <Card styles={{ body: { paddingTop: 4 } }}>
              <Tabs defaultActiveKey={!isSub && kids.length > 0 ? "subtasks" : "comments"} items={tabItems} />
            </Card>
          </Space>
        </Col>

        <Col xs={24} xl={7}>
          <Card title="Informasi" size="small">
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <Label>Status</Label>
                <TaskStatusSwitch task={task} />
              </div>
              <div>
                <Label>{kids.length > 0 ? "Progress (dari sub task)" : "Progress"}</Label>
                <Progress percent={task.progressPercent} size="small" strokeColor={st.main} />
              </div>
              <div>
                <Label>{task.pics.length > 1 ? `PIC (${task.pics.length})` : "PIC"}</Label>
                <PicChips names={task.pics} />
              </div>
              <div>
                <Label>Rentang waktu</Label>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <CalendarOutlined style={{ color: "#8C93A3" }} />
                  <DueText task={task} today={today} />
                </span>
              </div>
              <div>
                <Label>Review</Label>
                <Space size={6} wrap>
                  <Tag
                    color={getReviewStatusColor(task.reviewStatus)}
                    icon={task.reviewStatus === "Disetujui" ? <CheckCircleFilled /> : undefined}
                    style={{ marginInlineEnd: 0 }}
                  >
                    {task.reviewStatus ?? "Belum Direview"}
                  </Tag>
                  {reviewed && task.reviewedBy && (
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {task.reviewedBy}
                      {task.reviewedAt ? ` · ${formatDate(task.reviewedAt, today)}` : ""}
                    </Text>
                  )}
                </Space>
              </div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Status saat ini: {nameOf(task.status)}
              </Text>
            </div>
          </Card>
        </Col>
      </Row>

      <TaskFormModal open={form !== null} task={form?.task ?? null} parentId={form?.parentId} onClose={() => setForm(null)} />
      <TaskReviewModal task={reviewTask} onClose={() => setReviewTask(null)} />
    </div>
  );
}
