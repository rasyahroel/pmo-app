"use client";

import { useMemo, useState } from "react";
import { App, Button, Checkbox, Collapse, DatePicker, Drawer, Empty, Form, Input, InputNumber, Select, Space, Typography } from "antd";
import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import dayjs, { type Dayjs } from "dayjs";
import AttachmentsField from "@/components/tasks/AttachmentsField";
import { StatusDot } from "@/components/tasks/TaskStatus";
import { projects } from "@/lib/mock-data";
import { useMasterStore } from "@/lib/master-store";
import { membersOfProject, phasesOfProject } from "@/lib/project-lookup";
import { parentProgress } from "@/lib/task-logic";
import { useTaskStore, type SubtaskInput } from "@/lib/task-store";
import type { Attachment, Task } from "@/lib/task-types";

const { Text } = Typography;
const DATE = "YYYY-MM-DD";

type SubValues = {
  id?: string;
  title?: string;
  statusId?: string;
  assignees?: string[];
  dueDate?: Dayjs;
  description?: string;
  attachments?: Attachment[];
  progressPercent?: number;
};

type FormValues = {
  title?: string;
  projectId?: string;
  phaseId?: string;
  statusId?: string;
  categoryId?: string;
  assignees?: string[];
  range?: [Dayjs, Dayjs];
  progressPercent?: number;
  description?: string;
  attachments?: Attachment[];
  subtasks?: SubValues[];
};

export type TaskFormDrawerProps = {
  /** null = task baru */
  task: Task | null;
  defaults?: { projectId?: string; statusId?: string };
  /** kunci pilihan project (dipakai di detail project) */
  lockProject?: boolean;
  /** fase milik project (default: dari data project). Detail project mengirim fase terbarunya. */
  phasesOf?: (projectId: string) => { id: string; name: string }[];
  membersOf?: (projectId: string) => string[];
  /** dipanggil setelah animasi tutup selesai -> parent melepas (unmount) drawer ini */
  onClosed: () => void;
};

export default function TaskFormDrawer({
  task,
  defaults,
  lockProject,
  phasesOf = phasesOfProject,
  membersOf = membersOfProject,
  onClosed,
}: TaskFormDrawerProps) {
  const { message } = App.useApp();
  const { tasks, saveTask } = useTaskStore();
  const { taskStatuses, taskCategories, doneStatusIds, defaultStatusId, firstDoneStatusId } = useMasterStore();
  const [form] = Form.useForm<FormValues>();
  const [open, setOpen] = useState(true);
  const [openKeys, setOpenKeys] = useState<string[]>([]);

  const [initialValues] = useState<FormValues>(() => {
    const projectId = task?.projectId ?? defaults?.projectId;
    const phaseList = projectId ? phasesOf(projectId) : [];
    const subs = task ? tasks.filter((t) => t.parentId === task.id) : [];
    return {
      title: task?.title,
      projectId,
      phaseId: task?.phaseId ?? (phaseList.length === 1 ? phaseList[0].id : undefined),
      statusId: task?.statusId ?? defaults?.statusId ?? defaultStatusId,
      categoryId: task?.categoryId ?? taskCategories[0]?.id,
      assignees: task?.assignees ?? [],
      range: task?.startDate && task?.dueDate ? [dayjs(task.startDate), dayjs(task.dueDate)] : undefined,
      progressPercent: task?.progressPercent ?? 0,
      description: task?.description,
      attachments: task?.attachments ?? [],
      subtasks: subs.map((s) => ({
        id: s.id,
        title: s.title,
        statusId: s.statusId,
        assignees: s.assignees,
        dueDate: s.dueDate ? dayjs(s.dueDate) : undefined,
        description: s.description,
        attachments: s.attachments,
        progressPercent: s.progressPercent,
      })),
    };
  });

  const projectId = Form.useWatch("projectId", form) ?? initialValues.projectId;
  const subtasks = Form.useWatch("subtasks", form) ?? initialValues.subtasks ?? [];
  const phaseOptions = useMemo(() => (projectId ? phasesOf(projectId) : []), [projectId, phasesOf]);
  const memberOptions = useMemo(
    () => (projectId ? membersOf(projectId) : []).map((m) => ({ label: m, value: m })),
    [projectId, membersOf],
  );
  const hasSubs = subtasks.length > 0;
  const autoProgress = parentProgress(
    subtasks.map((s) => ({ statusId: s.statusId ?? defaultStatusId, progressPercent: s.progressPercent ?? 0 })),
    (id) => doneStatusIds.has(id),
  );

  const statusOptions = taskStatuses.map((s) => ({
    value: s.id,
    label: (
      <Space size={8}>
        <StatusDot color={s.color} />
        {s.name}
      </Space>
    ),
  }));

  function close() {
    setOpen(false);
  }

  function onProjectChange(id: string) {
    const list = phasesOf(id);
    form.setFieldsValue({ phaseId: list.length === 1 ? list[0].id : undefined });
  }

  function onParentStatusChange(statusId: string) {
    if (!doneStatusIds.has(statusId)) return;
    const subs = form.getFieldValue("subtasks") as SubValues[] | undefined;
    if (!subs?.length) return;
    form.setFieldsValue({
      subtasks: subs.map((s) => (s.statusId && doneStatusIds.has(s.statusId) ? s : { ...s, statusId, progressPercent: 100 })),
    });
  }

  function toggleSubDone(index: number, checked: boolean) {
    const subs = [...((form.getFieldValue("subtasks") as SubValues[] | undefined) ?? [])];
    if (!subs[index]) return;
    subs[index] = checked
      ? { ...subs[index], statusId: firstDoneStatusId, progressPercent: 100 }
      : { ...subs[index], statusId: defaultStatusId, progressPercent: 0 };
    form.setFieldsValue({ subtasks: subs });
  }

  function submit() {
    form
      .validateFields()
      .then((v) => {
        const subs: SubtaskInput[] = (v.subtasks ?? []).map((s) => ({
          id: s.id,
          title: (s.title ?? "").trim(),
          description: s.description?.trim() || undefined,
          statusId: s.statusId ?? defaultStatusId,
          progressPercent: s.progressPercent ?? 0,
          assignees: s.assignees ?? [],
          dueDate: s.dueDate?.format(DATE),
          attachments: s.attachments ?? [],
        }));
        saveTask({
          id: task?.id,
          core: {
            title: (v.title ?? "").trim(),
            projectId: v.projectId!,
            phaseId: v.phaseId!,
            categoryId: v.categoryId!,
            statusId: v.statusId!,
            description: v.description?.trim() || undefined,
            assignees: v.assignees ?? [],
            startDate: v.range?.[0]?.format(DATE),
            dueDate: v.range?.[1]?.format(DATE),
            progressPercent: v.progressPercent ?? 0,
            attachments: v.attachments ?? [],
          },
          subtasks: subs,
        });
        message.success(task ? "Task diperbarui." : "Task ditambahkan.");
        close();
      })
      .catch((err: { errorFields?: { name: (string | number)[] }[] }) => {
        // Buka panel subtask yang berisi error supaya kelihatan.
        const bad = (err?.errorFields ?? [])
          .filter((f) => f.name[0] === "subtasks" && typeof f.name[1] === "number")
          .map((f) => String(f.name[1]));
        if (bad.length) setOpenKeys((prev) => Array.from(new Set([...prev, ...bad])));
      });
  }

  const statusRules = [{ required: true, message: "Wajib diisi" }];

  return (
    <Drawer
      title={task ? "Ubah Task" : "Tambah Task"}
      size={720}
      open={open}
      onClose={close}
      afterOpenChange={(o) => {
        if (!o) onClosed();
      }}
      destroyOnHidden
      footer={
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <Button onClick={close}>Batal</Button>
          <Button type="primary" onClick={submit}>
            Simpan
          </Button>
        </div>
      }
    >
      <Form form={form} layout="vertical" initialValues={initialValues} requiredMark="optional">
        <Form.Item name="title" label="Judul Task" rules={[{ required: true, whitespace: true, message: "Wajib diisi" }]}>
          <Input placeholder="Mis. Integrasi API rekening" />
        </Form.Item>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
          <Form.Item name="projectId" label="Project" rules={statusRules}>
            <Select
              showSearch
              optionFilterProp="label"
              disabled={lockProject}
              onChange={onProjectChange}
              placeholder="Pilih project"
              options={projects.map((p) => ({ value: p.id, label: p.name }))}
            />
          </Form.Item>
          <Form.Item
            name="phaseId"
            label="Fase"
            extra={projectId && phaseOptions.length === 0 ? "Project ini belum punya fase. Tambahkan fase di detail project dulu." : undefined}
            rules={[
              { required: true, message: "Wajib diisi" },
              {
                validator: (_, value) =>
                  !value || phaseOptions.some((f) => f.id === value)
                    ? Promise.resolve()
                    : Promise.reject(new Error("Fase tidak termasuk project ini")),
              },
            ]}
          >
            <Select
              disabled={!projectId || phaseOptions.length === 0}
              placeholder={projectId ? "Pilih fase" : "Pilih project dulu"}
              options={phaseOptions.map((f) => ({ value: f.id, label: f.name }))}
            />
          </Form.Item>
          <Form.Item name="statusId" label="Status" rules={statusRules}>
            <Select options={statusOptions} onChange={onParentStatusChange} />
          </Form.Item>
          <Form.Item name="categoryId" label="Kategori" rules={statusRules}>
            <Select options={taskCategories.map((c) => ({ value: c.id, label: c.name }))} />
          </Form.Item>
        </div>

        <Form.Item
          name="assignees"
          label="PIC (bisa lebih dari satu)"
          rules={[{ type: "array", min: 1, message: "Pilih atau ketik minimal satu PIC" }]}
        >
          <Select mode="tags" options={memberOptions} tokenSeparators={[","]} placeholder="Pilih anggota tim atau ketik nama lalu Enter" />
        </Form.Item>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
          <Form.Item name="range" label="Mulai – Tenggat">
            <DatePicker.RangePicker style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item
            label="Progress (%)"
            name={hasSubs ? undefined : "progressPercent"}
            extra={hasSubs ? "Dihitung otomatis dari subtask." : undefined}
          >
            {hasSubs ? (
              <InputNumber value={autoProgress} disabled style={{ width: "100%" }} />
            ) : (
              <InputNumber min={0} max={100} style={{ width: "100%" }} />
            )}
          </Form.Item>
        </div>

        <Form.Item name="description" label="Deskripsi">
          <Input.TextArea rows={3} placeholder="Detail pekerjaan, catatan, acuan..." />
        </Form.Item>

        <Form.Item name="attachments" label="Lampiran (link, gambar, file)">
          <AttachmentsField />
        </Form.Item>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "8px 0" }}>
          <Text strong>Subtask {hasSubs ? `(${subtasks.length})` : ""}</Text>
        </div>

        <Form.List name="subtasks">
          {(fields, { add, remove }) => (
            <>
              {fields.length === 0 && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Belum ada subtask" style={{ margin: "4px 0 12px" }} />}
              {fields.length > 0 && (
                <Collapse
                  size="small"
                  activeKey={openKeys}
                  onChange={(k) => setOpenKeys(Array.isArray(k) ? k : [k])}
                  style={{ marginBottom: 12 }}
                  items={fields.map((field, index) => {
                    const sub = subtasks[index];
                    const isDone = !!sub?.statusId && doneStatusIds.has(sub.statusId);
                    return {
                      key: String(field.name),
                      forceRender: true,
                      label: (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                          <span onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={isDone}
                              onChange={(e) => toggleSubDone(index, e.target.checked)}
                              aria-label="Tandai subtask selesai"
                            />
                          </span>
                          <span style={{ textDecoration: isDone ? "line-through" : undefined }}>
                            {sub?.title?.trim() || `Subtask ${index + 1}`}
                          </span>
                        </span>
                      ),
                      extra: (
                        <Button
                          type="text"
                          size="small"
                          danger
                          icon={<DeleteOutlined />}
                          aria-label="Hapus subtask"
                          onClick={(e) => {
                            e.stopPropagation();
                            remove(field.name);
                          }}
                        />
                      ),
                      children: (
                        <>
                          <Form.Item name={[field.name, "id"]} hidden>
                            <Input />
                          </Form.Item>
                          <Form.Item name={[field.name, "progressPercent"]} hidden>
                            <InputNumber />
                          </Form.Item>
                          <Form.Item name={[field.name, "title"]} label="Judul subtask" rules={[{ required: true, whitespace: true, message: "Wajib diisi" }]}>
                            <Input />
                          </Form.Item>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
                            <Form.Item name={[field.name, "statusId"]} label="Status" rules={statusRules}>
                              <Select options={statusOptions} />
                            </Form.Item>
                            <Form.Item name={[field.name, "dueDate"]} label="Tenggat">
                              <DatePicker style={{ width: "100%" }} />
                            </Form.Item>
                          </div>
                          <Form.Item name={[field.name, "assignees"]} label="PIC (opsional, bisa banyak)">
                            <Select mode="tags" options={memberOptions} tokenSeparators={[","]} placeholder="Pilih atau ketik nama" />
                          </Form.Item>
                          <Form.Item name={[field.name, "description"]} label="Deskripsi">
                            <Input.TextArea rows={2} />
                          </Form.Item>
                          <Form.Item name={[field.name, "attachments"]} label="Lampiran" style={{ marginBottom: 0 }}>
                            <AttachmentsField compact />
                          </Form.Item>
                        </>
                      ),
                    };
                  })}
                />
              )}
              <Button
                icon={<PlusOutlined />}
                onClick={() => {
                  add({ statusId: defaultStatusId, assignees: [], attachments: [], progressPercent: 0 });
                  setOpenKeys((prev) => [...prev, String(fields.length)]);
                }}
              >
                Tambah Subtask
              </Button>
            </>
          )}
        </Form.List>
      </Form>
    </Drawer>
  );
}
