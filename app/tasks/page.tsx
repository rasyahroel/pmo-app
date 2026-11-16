"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { App, Button, Input, Select, Space, Tag, Typography } from "antd";
import { ArrowRightOutlined, PlusOutlined, SearchOutlined } from "@ant-design/icons";
import PageSkeleton from "@/components/layout/PageSkeleton";
import TaskBoard from "@/components/tasks/TaskBoard";
import TaskDetailDrawer from "@/components/tasks/TaskDetailDrawer";
import TaskFormModal from "@/components/tasks/TaskFormModal";
import TaskReviewModal from "@/components/tasks/TaskReviewModal";
import { projects, type Task } from "@/lib/mock-data";
import { useMasterStore, useStatusMeta } from "@/lib/master-store";
import { useProjectStructure } from "@/lib/project-structure";
import { getDueInfo, projectColor, useToday } from "@/lib/task-ui";
import { useTaskStore } from "@/lib/task-store";
import { useTaskPermissions } from "@/lib/use-task-permissions";

const { Text } = Typography;

const ALL = "all";

const projectNameOf = (id: string) => projects.find((p) => p.id === id)?.name ?? "-";

function TaskBoardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { modal, message } = App.useApp();
  const { tasks, deleteTask } = useTaskStore();
  const { taskCategories } = useMasterStore();
  const { statuses, isDone } = useStatusMeta();
  const { phasesOf } = useProjectStructure();
  const perms = useTaskPermissions();
  const today = useToday();

  // Project aktif disimpan di URL (?projectId=...) -> bisa di-bookmark / dibuka dari tab Task di detail project.
  const rawProject = searchParams.get("projectId");
  const projectId = rawProject && projects.some((p) => p.id === rawProject) ? rawProject : ALL;

  const [phaseFilter, setPhaseFilter] = useState<{ projectId: string; phaseId: string } | null>(null);
  const phaseId = phaseFilter && phaseFilter.projectId === projectId ? phaseFilter.phaseId : ALL;
  const [category, setCategory] = useState<string | undefined>();
  const [search, setSearch] = useState("");

  const [form, setForm] = useState<{ task: Task | null; parentId?: string; status?: string } | null>(null);
  const [reviewTask, setReviewTask] = useState<Task | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const selectedProject = projects.find((p) => p.id === projectId);
  const phaseNameOf = (t: Task) => phasesOf(t.projectId).find((ph) => ph.id === t.phaseId)?.name ?? "";

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const subs = new Map<string, Task[]>();
    for (const t of tasks) if (t.parentId) subs.set(t.parentId, [...(subs.get(t.parentId) ?? []), t]);
    const catName = (id: string) => taskCategories.find((c) => c.id === id)?.name ?? "";
    return tasks.filter((t) => {
      if (t.parentId) return false; // papan hanya menampilkan task induk
      if (projectId !== ALL && t.projectId !== projectId) return false;
      if (phaseId !== ALL && t.phaseId !== phaseId) return false;
      if (category && t.category !== category) return false;
      if (q) {
        const haystack = [
          t.title,
          ...t.pics,
          catName(t.category),
          projectNameOf(t.projectId),
          phasesOf(t.projectId).find((ph) => ph.id === t.phaseId)?.name ?? "",
          ...(subs.get(t.id) ?? []).flatMap((s) => [s.title, ...s.pics]),
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [tasks, projectId, phaseId, category, search, taskCategories, phasesOf]);

  const overdueCount = visible.filter((t) => getDueInfo({ dueDate: t.dueDate, done: isDone(t.status) }, today).state === "overdue").length;
  const filtersActive = projectId !== ALL || phaseId !== ALL || !!category || search.trim() !== "";

  // Jumlah task yang belum selesai per project -> ditampilkan di pilihan project.
  const openCountByProject = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of tasks) if (!t.parentId && !isDone(t.status)) m.set(t.projectId, (m.get(t.projectId) ?? 0) + 1);
    return m;
  }, [tasks, isDone]);

  const defaultStatus = statuses.find((s) => !s.isDone)?.id ?? statuses[0]?.id;
  const canAdd = projectId === ALL ? perms.canCreateAny : perms.canCreateIn(projectId);

  function selectProject(id: string) {
    router.replace(id === ALL ? "/tasks" : `/tasks?projectId=${id}`, { scroll: false });
  }

  function resetFilters() {
    selectProject(ALL);
    setCategory(undefined);
    setSearch("");
  }

  function confirmDelete(task: Task) {
    const kids = tasks.filter((t) => t.parentId === task.id).length;
    modal.confirm({
      title: "Hapus task ini?",
      content: kids > 0 ? `"${task.title}" dan ${kids} sub task-nya akan dihapus.` : `"${task.title}" akan dihapus.`,
      okText: "Hapus",
      okButtonProps: { danger: true },
      cancelText: "Batal",
      onOk: () => {
        const res = deleteTask(task.id);
        if (res.ok) message.success("Task dihapus.");
        else message.warning(res.reason);
      },
    });
  }

  return (
    <PageSkeleton path="/tasks">
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <Select
          value={projectId}
          onChange={selectProject}
          style={{ width: 280 }}
          showSearch
          optionFilterProp="text"
          options={[
            { value: ALL, text: "Semua Project", label: <b>Semua Project</b> },
            ...projects.map((p) => ({
              value: p.id,
              text: p.name,
              label: (
                <Space size={8} style={{ width: "100%", justifyContent: "space-between" }}>
                  <Space size={8}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: projectColor(p.id), display: "inline-block" }} />
                    {p.name}
                  </Space>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {openCountByProject.get(p.id) ?? 0} aktif
                  </Text>
                </Space>
              ),
            })),
          ]}
        />
        {selectedProject && (
          <Select
            value={phaseId}
            onChange={(v) => setPhaseFilter({ projectId, phaseId: v })}
            style={{ width: 160 }}
            options={[{ value: ALL, label: "Semua Fase" }, ...phasesOf(selectedProject.id).map((ph) => ({ value: ph.id, label: ph.name }))]}
          />
        )}
        <Select
          value={category}
          onChange={setCategory}
          allowClear
          placeholder="Semua Kategori"
          style={{ width: 190 }}
          options={taskCategories.map((c) => ({ label: c.name, value: c.id }))}
        />
        <Input
          allowClear
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          prefix={<SearchOutlined style={{ color: "rgba(0,0,0,0.35)" }} />}
          placeholder="Cari task, sub task, PIC, kategori..."
          style={{ width: 260 }}
        />
        {canAdd && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setForm({ task: null, status: defaultStatus })}
            style={{ marginInlineStart: "auto" }}
          >
            Tambah Task
          </Button>
        )}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, marginBottom: 14, minHeight: 24 }}>
        <Text type="secondary">
          {visible.length} task{projectId === ALL ? " dari semua project" : ""}
        </Text>
        {overdueCount > 0 && (
          <Tag color="error" variant="filled">
            {overdueCount} terlambat
          </Tag>
        )}
        {selectedProject && (
          <Button
            type="link"
            size="small"
            icon={<ArrowRightOutlined />}
            iconPlacement="end"
            onClick={() => router.push(`/projects/${selectedProject.id}`)}
            style={{ padding: 0 }}
          >
            Buka detail project
          </Button>
        )}
        {filtersActive && (
          <Button type="link" size="small" onClick={resetFilters} style={{ padding: 0 }}>
            Reset filter
          </Button>
        )}
        <Text type="secondary" style={{ marginInlineStart: "auto", fontSize: 12 }}>
          Tarik kartu ke kolom lain untuk mengganti status · klik kartu untuk melihat detail
        </Text>
      </div>

      <TaskBoard
        tasks={visible}
        showProject={projectId === ALL}
        projectNameOf={projectNameOf}
        phaseNameOf={phaseNameOf}
        canAdd={canAdd}
        onAdd={(status) => setForm({ task: null, status })}
        onOpen={(t) => setOpenId(t.id)}
        onEdit={(task) => setForm({ task })}
        onReview={setReviewTask}
        onDelete={confirmDelete}
        onOpenProject={(id) => router.push(`/projects/${id}`)}
      />

      <TaskDetailDrawer
        taskId={openId}
        onClose={() => setOpenId(null)}
        onEdit={(task) => setForm({ task })}
        onReview={setReviewTask}
        onAddSubtask={(parent) => setForm({ task: null, parentId: parent.id })}
        projectNameOf={projectNameOf}
        phaseNameOf={phaseNameOf}
      />
      <TaskFormModal
        open={form !== null}
        task={form?.task ?? null}
        parentId={form?.parentId}
        defaults={{ projectId: projectId === ALL ? undefined : projectId, status: form?.status }}
        onClose={() => setForm(null)}
      />
      <TaskReviewModal task={reviewTask} onClose={() => setReviewTask(null)} />
    </PageSkeleton>
  );
}

// useSearchParams() wajib dibungkus Suspense di Next.js (supaya halaman tetap bisa di-prerender).
export default function TasksPage() {
  return (
    <Suspense fallback={null}>
      <TaskBoardPage />
    </Suspense>
  );
}
