"use client";

import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { Button, Dropdown, Progress, Tag, Tooltip, Typography, type MenuProps } from "antd";
import {
  AlignLeftOutlined,
  ApartmentOutlined,
  AuditOutlined,
  CalendarOutlined,
  CheckCircleFilled,
  CommentOutlined,
  DeleteOutlined,
  EditOutlined,
  MoreOutlined,
  PaperClipOutlined,
  PlusOutlined,
  ProjectOutlined,
} from "@ant-design/icons";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  pointerWithin,
  rectIntersection,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { getReviewStatusColor, type Task } from "@/lib/mock-data";
import { useCategoryName, useStatusMeta } from "@/lib/master-store";
import { useCommentStore } from "@/lib/comment-store";
import {
  buildColumns,
  columnId,
  dropTarget,
  isColumnId,
  moveAcross,
  settleDrop,
  statusOfColumnId,
  type Columns,
} from "@/lib/task-logic";
import { DUE_COLOR, formatDate, getDueInfo, projectColor, useToday } from "@/lib/task-ui";
import { useTaskStore } from "@/lib/task-store";
import { useTaskActions } from "@/lib/use-task-actions";
import { useTaskPermissions } from "@/lib/use-task-permissions";
import PicAvatars from "@/components/tasks/PicAvatars";
import { StatusBadge, StatusDot } from "@/components/tasks/TaskStatus";

const { Text } = Typography;

// ---------------------------------------------------------------------------
// Kartu task (tampilan saja — dipakai juga untuk "bayangan" saat di-drag)
// ---------------------------------------------------------------------------

type CardContext = {
  today: string;
  showProject: boolean;
  projectNameOf: (projectId: string) => string;
  phaseNameOf: (task: Task) => string;
  subtasksOf: (taskId: string) => Task[];
  commentCountOf: (taskId: string) => number;
};

function TaskCardView({
  task,
  ctx,
  actions,
  overlay,
  draggable = true,
}: {
  task: Task;
  ctx: CardContext;
  actions?: ReactNode;
  overlay?: boolean;
  draggable?: boolean;
}) {
  const { styleOf, isDone } = useStatusMeta();
  const categoryNameOf = useCategoryName();
  const st = styleOf(task.status);
  const done = isDone(task.status);
  const due = getDueInfo({ dueDate: task.dueDate, done }, ctx.today);
  const phaseName = ctx.phaseNameOf(task);
  const reviewed = !!task.reviewStatus && task.reviewStatus !== "Belum Direview";
  const subs = ctx.subtasksOf(task.id);
  const subsDone = subs.filter((s) => isDone(s.status)).length;
  const comments = ctx.commentCountOf(task.id);

  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 10,
        // Properti border dipisah (bukan shorthand + longhand) supaya React tidak memperingatkan
        // saat warna berubah ketika kartu pindah kolom.
        borderStyle: "solid",
        borderWidth: "1px 1px 1px 4px",
        borderColor: `${st.border} ${st.border} ${st.border} ${st.main}`,
        padding: "10px 12px 10px 10px",
        boxShadow: overlay ? "0 16px 32px rgba(16,49,60,0.28)" : "0 1px 2px rgba(16,49,60,0.07)",
        cursor: overlay ? "grabbing" : draggable ? "grab" : "pointer",
        transform: overlay ? "rotate(1.5deg)" : undefined,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {ctx.showProject && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: projectColor(task.projectId), flexShrink: 0 }} />
              <Text type="secondary" ellipsis style={{ fontSize: 12 }}>
                {ctx.projectNameOf(task.projectId)}
              </Text>
            </div>
          )}
          <div style={{ fontWeight: 500, lineHeight: 1.35, wordBreak: "break-word" }}>{task.title}</div>
        </div>
        {actions}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, margin: "8px 0 6px" }}>
        <Tag style={{ fontSize: 11, marginInlineEnd: 0 }}>{categoryNameOf(task.category)}</Tag>
        {phaseName && (
          <Tag color="cyan" variant="filled" style={{ fontSize: 11, marginInlineEnd: 0 }}>
            {phaseName}
          </Tag>
        )}
        {reviewed && (
          <Tag
            color={getReviewStatusColor(task.reviewStatus)}
            variant="filled"
            icon={task.reviewStatus === "Disetujui" ? <CheckCircleFilled /> : undefined}
            style={{ fontSize: 11, marginInlineEnd: 0 }}
          >
            {task.reviewStatus}
          </Tag>
        )}
      </div>

      {task.description && (
        <div
          style={{
            fontSize: 12,
            color: "#667085",
            marginBottom: 6,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {task.description}
        </div>
      )}

      {subs.length > 0 && (
        <div style={{ background: "#F7FAFB", borderRadius: 8, padding: "6px 8px", marginBottom: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#667085", marginBottom: 4 }}>
            <ApartmentOutlined /> Sub task {subsDone}/{subs.length}
          </div>
          <div style={{ display: "flex", gap: 2, marginBottom: 4 }}>
            {subs.map((s) => (
              <span key={s.id} style={{ flex: 1, height: 4, borderRadius: 2, background: isDone(s.status) ? st.main : "#E4EDF0" }} />
            ))}
          </div>
          {subs.slice(0, 3).map((s) => (
            <div
              key={s.id}
              style={{
                fontSize: 12,
                lineHeight: 1.5,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                color: isDone(s.status) ? "#99A1B7" : "#4B5675",
                textDecoration: isDone(s.status) ? "line-through" : undefined,
              }}
            >
              {s.title}
            </div>
          ))}
          {subs.length > 3 && <div style={{ fontSize: 11, color: "#99A1B7" }}>+{subs.length - 3} lainnya</div>}
        </div>
      )}

      <Progress percent={task.progressPercent} size="small" strokeColor={st.main} />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <PicAvatars names={task.pics} max={3} size={22} />
          {comments > 0 && (
            <span style={{ fontSize: 11, color: "#99A1B7" }}>
              <CommentOutlined /> {comments}
            </span>
          )}
          {task.attachments.length > 0 && (
            <span style={{ fontSize: 11, color: "#99A1B7" }}>
              <PaperClipOutlined /> {task.attachments.length}
            </span>
          )}
          {task.description && <AlignLeftOutlined style={{ fontSize: 11, color: "#99A1B7" }} />}
        </div>
        <Tooltip title={due.label || undefined}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: DUE_COLOR[due.state] }}>
            <CalendarOutlined />
            {formatDate(task.dueDate, ctx.today)}
            {due.state === "overdue" && (
              <Tag color="error" variant="filled" style={{ fontSize: 10, lineHeight: "16px", padding: "0 5px", marginInlineEnd: 0 }}>
                Terlambat
              </Tag>
            )}
          </span>
        </Tooltip>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Menu "⋮" pada kartu — isinya mengikuti hak akses pengguna
// ---------------------------------------------------------------------------

type CardHandlers = {
  onOpen: (task: Task) => void;
  onEdit: (task: Task) => void;
  onReview: (task: Task) => void;
  onDelete: (task: Task) => void;
  onOpenProject: (projectId: string) => void;
  onMove: (task: Task, statusId: string) => void;
};

function CardMenu({ task, handlers }: { task: Task; handlers: CardHandlers }) {
  const { statuses } = useStatusMeta();
  const perms = useTaskPermissions();
  const canEdit = perms.canUpdate(task);
  const canReview = perms.canReview(task);

  const items: MenuProps["items"] = [
    { key: "open", icon: <ProjectOutlined />, label: "Buka detail" },
    ...(canEdit ? [{ key: "edit", icon: <EditOutlined />, label: "Ubah" }] : []),
    ...(canReview ? [{ key: "review", icon: <AuditOutlined />, label: "Review" }] : []),
    { key: "project", icon: <ProjectOutlined />, label: "Buka Project" },
    ...(canEdit
      ? [
          { type: "divider" as const },
          {
            key: "move",
            label: "Pindahkan ke",
            children: statuses.filter((s) => s.id !== task.status).map((s) => ({ key: `move:${s.id}`, label: <StatusBadge status={s.id} /> })),
          },
          { type: "divider" as const },
          { key: "delete", icon: <DeleteOutlined />, label: "Hapus", danger: true },
        ]
      : []),
  ];

  // Klik/tekan di tombol & isi menu TIDAK boleh ikut memicu drag atau membuka detail
  // (event React tetap "naik" lewat portal ke kartu).
  const stop = {
    onMouseDown: (e: { stopPropagation: () => void }) => e.stopPropagation(),
    onTouchStart: (e: { stopPropagation: () => void }) => e.stopPropagation(),
  };

  return (
    <Dropdown
      trigger={["click"]}
      placement="bottomRight"
      menu={{
        items,
        onClick: ({ key, domEvent }) => {
          domEvent.stopPropagation();
          if (key === "open") handlers.onOpen(task);
          else if (key === "edit") handlers.onEdit(task);
          else if (key === "review") handlers.onReview(task);
          else if (key === "project") handlers.onOpenProject(task.projectId);
          else if (key === "delete") handlers.onDelete(task);
          else if (key.startsWith("move:")) handlers.onMove(task, key.slice(5));
        },
      }}
      popupRender={(menu) => <div {...stop}>{menu}</div>}
    >
      <Button type="text" size="small" icon={<MoreOutlined />} aria-label="Menu task" {...stop} onClick={(e) => e.stopPropagation()} />
    </Dropdown>
  );
}

// ---------------------------------------------------------------------------
// Kartu yang bisa di-drag (hanya kalau pengguna berhak mengubah task itu)
// ---------------------------------------------------------------------------

function SortableTaskCard({ task, ctx, handlers }: { task: Task; ctx: CardContext; handlers: CardHandlers }) {
  const perms = useTaskPermissions();
  const canDrag = perms.canUpdate(task);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id, disabled: !canDrag });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1, // yang tertinggal di tempat asal = "bayangan" pudar
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...(canDrag ? listeners : {})} onClick={() => handlers.onOpen(task)}>
      <TaskCardView task={task} ctx={ctx} draggable={canDrag} actions={<CardMenu task={task} handlers={handlers} />} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Kolom
// ---------------------------------------------------------------------------

function BoardColumn({
  statusId,
  ids,
  byId,
  ctx,
  handlers,
  isTarget,
  isDragging,
  canAdd,
  onAdd,
}: {
  statusId: string;
  ids: string[];
  byId: Map<string, Task>;
  ctx: CardContext;
  handlers: CardHandlers;
  isTarget: boolean; // kartu yang sedang di-drag sedang berada di kolom ini
  isDragging: boolean;
  canAdd: boolean;
  onAdd: (statusId: string) => void;
}) {
  const { setNodeRef } = useDroppable({ id: columnId(statusId) });
  const { styleOf, nameOf } = useStatusMeta();
  const st = styleOf(statusId);
  const name = nameOf(statusId);

  return (
    <section
      aria-label={`Kolom ${name}`}
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: 420,
        background: isTarget ? st.border : st.soft,
        borderStyle: "solid",
        borderWidth: "3px 1px 1px 1px",
        borderColor: `${st.main} ${isTarget ? st.main : st.border} ${isTarget ? st.main : st.border}`, // atas | kiri-kanan | bawah
        borderRadius: 12,
        transition: "background 120ms, border-color 120ms",
      }}
    >
      <header style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 10px 6px 12px" }}>
        <StatusDot status={statusId} size={10} />
        <Text strong style={{ color: st.text }}>
          {name}
        </Text>
        <span
          style={{
            minWidth: 22,
            textAlign: "center",
            padding: "0 7px",
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 600,
            lineHeight: "20px",
            color: st.text,
            background: "#fff",
            borderStyle: "solid",
            borderWidth: 1,
            borderColor: st.border,
          }}
        >
          {ids.length}
        </span>
        {canAdd && (
          <Tooltip title={`Tambah task di ${name}`}>
            <Button
              type="text"
              size="small"
              icon={<PlusOutlined />}
              aria-label={`Tambah task di ${name}`}
              onClick={() => onAdd(statusId)}
              style={{ marginInlineStart: "auto", color: st.text }}
            />
          </Tooltip>
        )}
      </header>

      <div ref={setNodeRef} style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8, padding: "4px 8px 10px" }}>
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          {ids.map((id) => {
            const task = byId.get(id);
            return task ? <SortableTaskCard key={id} task={task} ctx={ctx} handlers={handlers} /> : null;
          })}
        </SortableContext>
        {ids.length === 0 && (
          <div
            style={{
              flex: 1,
              minHeight: 96,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              padding: 12,
              borderStyle: "dashed",
              borderWidth: 1.5,
              borderColor: isDragging ? st.main : st.border,
              borderRadius: 10,
              color: st.text,
              fontSize: 12,
              opacity: 0.85,
            }}
          >
            {isDragging ? "Lepas di sini" : "Belum ada task"}
          </div>
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Board
// ---------------------------------------------------------------------------

export type TaskBoardProps = {
  /** task yang sudah difilter (project/fase/pencarian); sub task diabaikan, kartu hanya untuk task induk */
  tasks: Task[];
  /** tampilkan nama project di kartu (berguna saat melihat semua project) */
  showProject: boolean;
  projectNameOf: (projectId: string) => string;
  phaseNameOf: (task: Task) => string;
  /** tombol "+" di header kolom (hanya kalau pengguna boleh membuat task) */
  canAdd: boolean;
  onAdd: (statusId: string) => void;
  onOpen: (task: Task) => void;
  onEdit: (task: Task) => void;
  onReview: (task: Task) => void;
  onDelete: (task: Task) => void;
  onOpenProject: (projectId: string) => void;
};

export default function TaskBoard({
  tasks,
  showProject,
  projectNameOf,
  phaseNameOf,
  canAdd,
  onAdd,
  onOpen,
  onEdit,
  onReview,
  onDelete,
  onOpenProject,
}: TaskBoardProps) {
  const { tasks: allTasks } = useTaskStore();
  const { statuses } = useStatusMeta();
  const { comments } = useCommentStore();
  const actions = useTaskActions();
  const today = useToday();

  // Board hanya menampilkan task induk; sub task muncul sebagai ringkasan di kartu induknya.
  const parents = useMemo(() => tasks.filter((t) => !t.parentId), [tasks]);
  const byId = useMemo(() => new Map(parents.map((t) => [t.id, t])), [parents]);
  const statusIds = useMemo(() => statuses.map((s) => s.id), [statuses]);
  const baseCols = useMemo(() => buildColumns(parents, statusIds), [parents, statusIds]);
  const subsByParent = useMemo(() => {
    const m = new Map<string, Task[]>();
    for (const t of allTasks) if (t.parentId) m.set(t.parentId, [...(m.get(t.parentId) ?? []), t]);
    return m;
  }, [allTasks]);
  const commentCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of comments) m.set(c.taskId, (m.get(c.taskId) ?? 0) + 1);
    return m;
  }, [comments]);

  // Selama drag, susunan kolom "pratinjau" disimpan di sini; baru disimpan ke store saat dilepas.
  const [drag, setDrag] = useState<{ activeId: string; cols: Columns } | null>(null);
  const cols = drag?.cols ?? baseCols;
  const activeTask = drag ? byId.get(drag.activeId) : undefined;

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }), // geser 6px baru dianggap drag (klik biasa tetap jalan)
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }), // layar sentuh: tahan sebentar
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Cari tujuan drop: utamakan posisi pointer; kalau di area kolom (bukan di atas kartu),
  // pilih kartu terdekat di kolom itu.
  const collisionDetection: CollisionDetection = (args) => {
    const hits = pointerWithin(args);
    const collisions = hits.length > 0 ? hits : rectIntersection(args);
    const first = collisions[0];
    if (!first) return [];
    let overId = String(first.id);
    if (isColumnId(overId)) {
      const columnItems = cols[statusOfColumnId(overId)] ?? [];
      if (columnItems.length > 0) {
        const nearest = closestCenter({
          ...args,
          droppableContainers: args.droppableContainers.filter((c) => columnItems.includes(String(c.id))),
        })[0];
        if (nearest) overId = String(nearest.id);
      }
    }
    return [{ id: overId }];
  };

  function handleDragStart({ active }: DragStartEvent) {
    setDrag({ activeId: String(active.id), cols: baseCols });
  }

  function handleDragOver({ active, over }: DragOverEvent) {
    if (!over) return;
    const translated = active.rect.current.translated;
    const below = !!translated && translated.top + translated.height / 2 > over.rect.top + over.rect.height / 2;
    setDrag((prev) => {
      if (!prev) return prev;
      const next = moveAcross(prev.cols, String(active.id), String(over.id), below);
      return next === prev.cols ? prev : { ...prev, cols: next };
    });
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    const activeId = String(active.id);
    if (drag) {
      const settled = settleDrop(drag.cols, activeId, over ? String(over.id) : null);
      const target = dropTarget(settled, activeId);
      const before = dropTarget(baseCols, activeId);
      const task = byId.get(activeId);
      if (target && task && (target.statusId !== before?.statusId || target.beforeId !== before?.beforeId)) {
        // Penolakan (hak akses) dan peringatan "sub task belum selesai" ditangani hook ini.
        actions.move(task, target.statusId, target.beforeId);
      }
    }
    setDrag(null);
  }

  const ctx: CardContext = {
    today,
    showProject,
    projectNameOf,
    phaseNameOf,
    subtasksOf: (id) => subsByParent.get(id) ?? [],
    commentCountOf: (id) => commentCounts.get(id) ?? 0,
  };
  const handlers: CardHandlers = {
    onOpen,
    onEdit,
    onReview,
    onDelete,
    onOpenProject,
    onMove: (task, statusId) => actions.move(task, statusId),
  };

  return (
    <DndContext
      id="task-board" // id tetap -> menghindari hydration mismatch pada atribut aria bawaan dnd-kit
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setDrag(null)}
      accessibility={{
        screenReaderInstructions: {
          draggable:
            "Tekan spasi untuk mengangkat task. Pindahkan dengan tombol panah, tekan spasi lagi untuk melepas, atau Esc untuk membatalkan.",
        },
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${Math.max(statuses.length, 1)}, minmax(272px, 1fr))`,
          gap: 14,
          alignItems: "stretch",
          overflowX: "auto",
          paddingBottom: 8,
        }}
      >
        {statuses.map((s) => (
          <BoardColumn
            key={s.id}
            statusId={s.id}
            ids={cols[s.id] ?? []}
            byId={byId}
            ctx={ctx}
            handlers={handlers}
            isTarget={!!drag && (cols[s.id] ?? []).includes(drag.activeId)}
            isDragging={!!drag}
            canAdd={canAdd}
            onAdd={onAdd}
          />
        ))}
      </div>

      <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(0.2, 0, 0, 1)" }}>
        {activeTask ? <TaskCardView task={activeTask} ctx={ctx} overlay /> : null}
      </DragOverlay>
    </DndContext>
  );
}

