"use client";

import { useState, type ReactNode } from "react";
import { App, Avatar, Button, Drawer, Popconfirm, Progress, Space, Tag, Tooltip, Typography } from "antd";
import {
  ApartmentOutlined,
  AuditOutlined,
  CalendarOutlined,
  CheckCircleFilled,
  DeleteOutlined,
  DownOutlined,
  EditOutlined,
  PlusOutlined,
  RightOutlined,
} from "@ant-design/icons";
import { getReviewStatusColor, projects, type Task } from "@/lib/mock-data";
import { useCategoryName, useStatusMeta } from "@/lib/master-store";
import { useSubtasks, useTaskStore } from "@/lib/task-store";
import { DUE_COLOR, formatDate, getDueInfo, initials, projectColor, useToday } from "@/lib/task-ui";
import { agi } from "@/app/providers";
import TaskStatusSwitch from "@/components/tasks/TaskStatus";
import PicAvatars from "@/components/tasks/PicAvatars";
import AttachmentsView from "@/components/tasks/AttachmentsView";

const { Text } = Typography;

export type TaskDetailDrawerProps = {
  /** id task yang dibuka; null = tertutup */
  taskId: string | null;
  onClose: () => void;
  onEdit: (task: Task) => void;
  onReview: (task: Task) => void;
  onAddSubtask: (parent: Task) => void;
  projectNameOf?: (projectId: string) => string;
  phaseNameOf?: (task: Task) => string;
};

const defaultProjectNameOf = (id: string) => projects.find((p) => p.id === id)?.name ?? "-";
const defaultPhaseNameOf = (t: Task) =>
  projects.find((p) => p.id === t.projectId)?.phases.find((ph) => ph.id === t.phaseId)?.name ?? "";

function Label({ children }: { children: string }) {
  return <div style={{ fontSize: 12, color: "#8C93A3", marginBottom: 4 }}>{children}</div>;
}

function Section({ title, extra, children }: { title: string; extra?: ReactNode; children: ReactNode }) {
  return (
    <section style={{ marginTop: 22 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <Text strong>{title}</Text>
        {extra}
      </div>
      {children}
    </section>
  );
}

function PicChips({ names }: { names: string[] }) {
  if (names.length === 0) return <Text type="secondary">Belum ada PIC</Text>;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {names.map((n) => (
        <span
          key={n}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "2px 10px 2px 3px", borderRadius: 999, background: agi[50], border: `1px solid ${agi[100]}` }}
        >
          <Avatar size={20} style={{ background: agi[200], color: agi[800], fontSize: 10 }}>
            {initials(n)}
          </Avatar>
          <span style={{ fontSize: 13 }}>{n}</span>
        </span>
      ))}
    </div>
  );
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

// Satu baris sub task yang bisa dibuka (expand) untuk melihat detail lengkapnya di tempat.
function SubtaskItem({
  task,
  today,
  open,
  onToggle,
  onEdit,
}: {
  task: Task;
  today: string;
  open: boolean;
  onToggle: () => void;
  onEdit: (t: Task) => void;
}) {
  const { message } = App.useApp();
  const { deleteTask } = useTaskStore();
  const { isDone, styleOf } = useStatusMeta();
  const st = styleOf(task.status);
  const done = isDone(task.status);
  const due = getDueInfo({ dueDate: task.dueDate, done }, today);

  return (
    <div
      style={{
        // Longhand semua (bukan border + borderLeft) supaya React tidak memperingatkan saat warna berubah.
        borderStyle: "solid",
        borderWidth: "1px 1px 1px 4px",
        borderColor: `${open ? st.border : "#E5E9EF"} ${open ? st.border : "#E5E9EF"} ${open ? st.border : "#E5E9EF"} ${st.main}`,
        borderRadius: 10,
        background: open ? st.soft : "#fff",
        transition: "background 120ms, border-color 120ms",
      }}
    >
      <div
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggle();
          }
        }}
        style={{ display: "grid", gridTemplateColumns: "14px minmax(0,1fr) auto auto", alignItems: "center", gap: 10, padding: "9px 12px", cursor: "pointer" }}
      >
        {open ? <DownOutlined style={{ fontSize: 10, color: "#8C93A3" }} /> : <RightOutlined style={{ fontSize: 10, color: "#8C93A3" }} />}
        <span
          style={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textDecoration: done ? "line-through" : undefined, color: done ? "#8C93A3" : undefined }}
          title={task.title}
        >
          {task.title}
        </span>
        <PicAvatars names={task.pics} max={2} size={20} />
        <span style={{ fontSize: 12, color: DUE_COLOR[due.state], whiteSpace: "nowrap" }}>{formatDate(task.dueDate, today)}</span>
      </div>

      {open && (
        <div style={{ padding: "2px 14px 14px 36px", display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12 }}>
            <div>
              <Label>Status</Label>
              <TaskStatusSwitch task={task} />
            </div>
            <div>
              <Label>Progress</Label>
              <Progress percent={task.progressPercent} size="small" strokeColor={st.main} />
            </div>
            <div>
              <Label>Rentang waktu</Label>
              <DueText task={task} today={today} />
            </div>
          </div>
          <div>
            <Label>PIC</Label>
            <PicChips names={task.pics} />
          </div>
          {task.description ? (
            <div>
              <Label>Deskripsi</Label>
              <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", lineHeight: 1.55 }}>{task.description}</div>
            </div>
          ) : (
            <Text type="secondary" style={{ fontSize: 12 }}>
              Belum ada deskripsi.
            </Text>
          )}
          {task.attachments.length > 0 && (
            <div>
              <Label>Lampiran</Label>
              <AttachmentsView items={task.attachments} thumb={72} />
            </div>
          )}
          <Space size={8}>
            <Button size="small" icon={<EditOutlined />} onClick={() => onEdit(task)}>
              Ubah
            </Button>
            <Popconfirm
              title="Hapus sub task ini?"
              description={task.title}
              okText="Hapus"
              cancelText="Batal"
              okButtonProps={{ danger: true }}
              onConfirm={() => {
                deleteTask(task.id);
                message.success("Sub task dihapus.");
              }}
            >
              <Button size="small" danger icon={<DeleteOutlined />}>
                Hapus
              </Button>
            </Popconfirm>
          </Space>
        </div>
      )}
    </div>
  );
}

function DrawerBody({
  task,
  onClose,
  onEdit,
  onReview,
  onAddSubtask,
}: Pick<TaskDetailDrawerProps, "onClose" | "onEdit" | "onReview" | "onAddSubtask"> & { task: Task }) {
  const { message } = App.useApp();
  const { deleteTask } = useTaskStore();
  const { styleOf, isDone } = useStatusMeta();
  const categoryNameOf = useCategoryName();
  const today = useToday();
  const kids = useSubtasks(task.id);
  const [openKids, setOpenKids] = useState<Set<string>>(() => new Set());

  const st = styleOf(task.status);
  const doneKids = kids.filter((k) => isDone(k.status)).length;
  const reviewed = !!task.reviewStatus && task.reviewStatus !== "Belum Direview";
  const allOpen = kids.length > 0 && openKids.size === kids.length;

  function toggle(id: string) {
    setOpenKids((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 16 }}>
        <div>
          <Label>Status</Label>
          <TaskStatusSwitch task={task} />
        </div>
        <div>
          <Label>{kids.length > 0 ? "Progress (dari sub task)" : "Progress"}</Label>
          <Progress percent={task.progressPercent} size="small" strokeColor={st.main} />
        </div>
        <div>
          <Label>Rentang waktu</Label>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <CalendarOutlined style={{ color: "#8C93A3" }} />
            <DueText task={task} today={today} />
          </span>
        </div>
        <div>
          <Label>Kategori</Label>
          <Tag style={{ marginInlineEnd: 0 }}>{categoryNameOf(task.category)}</Tag>
        </div>
      </div>

      <Section title={task.pics.length > 1 ? `PIC (${task.pics.length})` : "PIC"}>
        <PicChips names={task.pics} />
      </Section>

      <Section title="Deskripsi">
        {task.description ? (
          <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", lineHeight: 1.6 }}>{task.description}</div>
        ) : (
          <Text type="secondary">Belum ada deskripsi.</Text>
        )}
      </Section>

      {task.attachments.length > 0 && (
        <Section title={`Lampiran (${task.attachments.length})`}>
          <AttachmentsView items={task.attachments} />
        </Section>
      )}

      <Section
        title={kids.length > 0 ? `Sub Task · ${doneKids}/${kids.length} selesai` : "Sub Task"}
        extra={
          <Space size={4}>
            {kids.length > 1 && (
              <Button size="small" type="link" onClick={() => setOpenKids(allOpen ? new Set() : new Set(kids.map((k) => k.id)))}>
                {allOpen ? "Ciutkan semua" : "Buka semua"}
              </Button>
            )}
            <Button size="small" icon={<PlusOutlined />} onClick={() => onAddSubtask(task)}>
              Tambah
            </Button>
          </Space>
        }
      >
        {kids.length === 0 ? (
          <Text type="secondary">Belum ada sub task. Pecah pekerjaan ini jadi langkah-langkah yang lebih kecil lewat tombol Tambah.</Text>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {kids.map((k) => (
              <SubtaskItem key={k.id} task={k} today={today} open={openKids.has(k.id)} onToggle={() => toggle(k.id)} onEdit={onEdit} />
            ))}
          </div>
        )}
      </Section>

      <Section
        title="Review"
        extra={
          <Button size="small" icon={<AuditOutlined />} onClick={() => onReview(task)}>
            Ubah review
          </Button>
        }
      >
        <Space size={8} wrap>
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
      </Section>

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 28, paddingTop: 14, borderTop: "1px solid #EEF1F4" }}>
        <Popconfirm
          title="Hapus task ini?"
          description={kids.length > 0 ? `${task.title} — beserta ${kids.length} sub task-nya.` : task.title}
          okText="Hapus"
          cancelText="Batal"
          okButtonProps={{ danger: true }}
          onConfirm={() => {
            deleteTask(task.id);
            message.success("Task dihapus.");
            onClose();
          }}
        >
          <Button danger icon={<DeleteOutlined />}>
            Hapus
          </Button>
        </Popconfirm>
        <Button type="primary" icon={<EditOutlined />} onClick={() => onEdit(task)}>
          Ubah task
        </Button>
      </div>
    </>
  );
}

export default function TaskDetailDrawer({
  taskId,
  onClose,
  projectNameOf = defaultProjectNameOf,
  phaseNameOf = defaultPhaseNameOf,
  ...handlers
}: TaskDetailDrawerProps) {
  const { tasks } = useTaskStore();
  const { styleOf, nameOf } = useStatusMeta();
  const task = taskId ? tasks.find((t) => t.id === taskId) : undefined;
  const st = task ? styleOf(task.status) : undefined;
  const phase = task ? phaseNameOf(task) : "";

  return (
    <Drawer
      open={!!task}
      onClose={onClose}
      size={640}
      destroyOnHidden
      styles={{
        header: { borderBottom: `3px solid ${st?.main ?? "#DADFE7"}`, paddingBlock: 14, alignItems: "flex-start" },
        body: { paddingTop: 18 },
      }}
      title={
        task ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontWeight: 400 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: projectColor(task.projectId), flexShrink: 0 }} />
              <Text type="secondary" style={{ fontSize: 13 }}>
                {projectNameOf(task.projectId)}
              </Text>
              {phase && (
                <Tag color="cyan" variant="filled" style={{ marginInlineEnd: 0 }}>
                  {phase}
                </Tag>
              )}
              {task.parentId && (
                <Tooltip title="Sub task">
                  <ApartmentOutlined style={{ color: "#8C93A3" }} />
                </Tooltip>
              )}
              <Text type="secondary" style={{ fontSize: 12 }}>
                {nameOf(task.status)}
              </Text>
            </div>
            <div style={{ fontSize: 20, fontWeight: 600, lineHeight: 1.3, wordBreak: "break-word", whiteSpace: "normal" }}>{task.title}</div>
          </div>
        ) : null
      }
    >
      {task && <DrawerBody key={task.id} task={task} onClose={onClose} {...handlers} />}
    </Drawer>
  );
}
