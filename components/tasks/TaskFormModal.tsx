"use client";

import { useMemo, useState } from "react";
import {
  Alert,
  App,
  Button,
  Col,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Progress,
  Row,
  Select,
  Slider,
  Space,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import { DeleteOutlined, EditOutlined, PlusOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { projects, type Task, type TaskAttachment, type TaskStatus } from "@/lib/mock-data";
import { useMasterStore, useStatusMeta } from "@/lib/master-store";
import { DUE_COLOR, formatDate, getDueInfo, projectColor, useToday } from "@/lib/task-ui";
import { useSubtasks, useTaskStore, type TaskPatch } from "@/lib/task-store";
import { useTaskActions } from "@/lib/use-task-actions";
import { useTaskPermissions } from "@/lib/use-task-permissions";
import { useProjectStructure } from "@/lib/project-structure";
import TaskStatusSwitch, { StatusDot } from "@/components/tasks/TaskStatus";
import PicAvatars from "@/components/tasks/PicAvatars";
import AttachmentsField from "@/components/tasks/AttachmentsField";

const { Text } = Typography;

type PhaseOption = { id: string; name: string };

type FormValues = {
  title: string;
  projectId: string;
  phaseId?: string;
  category: string;
  pics: string[];
  status: TaskStatus;
  progressPercent: number;
  range: [dayjs.Dayjs, dayjs.Dayjs];
  description?: string;
  attachments: TaskAttachment[];
};

export type TaskFormModalProps = {
  open: boolean;
  /** null = tambah baru */
  task: Task | null;
  /** diisi = form ini untuk SUB TASK dari task tersebut (project/fase/kategori mengikuti induk) */
  parentId?: string;
  /** nilai awal untuk task baru (mis. dari tombol "+" di kolom / filter project yang aktif) */
  defaults?: { projectId?: string; status?: TaskStatus };
  /** kunci pilihan project (dipakai di tab detail project) */
  lockProject?: boolean;
  /** sumber daftar fase & anggota tim; default-nya dari data project (mock) */
  phasesOf?: (projectId: string) => PhaseOption[];
  membersOf?: (projectId: string) => string[];
  onClose: () => void;
};

function SectionTitle({ children, extra }: { children: string; extra?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "18px 0 8px" }}>
      <Text strong>{children}</Text>
      {extra}
    </div>
  );
}

// Slider + kotak angka yang terhubung ke satu nilai form.
function ProgressField({ value = 0, onChange }: { value?: number; onChange?: (v: number) => void }) {
  return (
    <Row gutter={16} align="middle" wrap={false}>
      <Col flex="auto">
        <Slider min={0} max={100} step={5} value={value} onChange={onChange} />
      </Col>
      <Col flex="104px">
        <InputNumber
          min={0}
          max={100}
          value={value}
          suffix="%"
          style={{ width: "100%" }}
          onChange={(v) => onChange?.(v ?? 0)}
        />
      </Col>
    </Row>
  );
}

// ---------------------------------------------------------------------------
// Daftar sub task di dalam form task induk
// ---------------------------------------------------------------------------
function SubtaskSection({ parent, onOpen }: { parent: Task; onOpen: (task: Task | null) => void }) {
  const { message } = App.useApp();
  const { addTask, deleteTask } = useTaskStore();
  const { statuses, isDone } = useStatusMeta();
  const today = useToday();
  const kids = useSubtasks(parent.id);
  const perms = useTaskPermissions();
  const canAddSub = perms.canCreateSub(parent);
  const [title, setTitle] = useState("");

  const doneCount = kids.filter((k) => isDone(k.status)).length;
  const firstOpenStatus = statuses.find((s) => !s.isDone)?.id ?? statuses[0]?.id;

  // Tambah cepat: cukup judul. PIC & tanggal diwarisi dari induk, bisa dirinci setelahnya.
  function quickAdd() {
    const t = title.trim();
    if (!t || !firstOpenStatus) return;
    const res = addTask({
      parentId: parent.id,
      projectId: parent.projectId,
      phaseId: parent.phaseId,
      category: parent.category,
      title: t,
      status: firstOpenStatus,
      pics: parent.pics,
      startDate: parent.startDate,
      dueDate: parent.dueDate,
      attachments: [],
    });
    if (!res.ok) {
      message.warning(res.reason);
      return;
    }
    setTitle("");
  }

  return (
    <>
      <SectionTitle
        extra={
          kids.length > 0 ? (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {doneCount} dari {kids.length} selesai
            </Text>
          ) : undefined
        }
      >
        Sub Task
      </SectionTitle>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {kids.map((k) => {
          const due = getDueInfo({ dueDate: k.dueDate, done: isDone(k.status) }, today);
          return (
            <div
              key={k.id}
              style={{
                display: "grid",
                gridTemplateColumns: "auto minmax(0, 1fr) auto auto auto",
                alignItems: "center",
                gap: 10,
                padding: "6px 10px",
                border: "1px solid #E5E9EF",
                borderRadius: 8,
                background: "#FAFCFD",
              }}
            >
              <TaskStatusSwitch task={k} />
              <a
                onClick={() => onOpen(k)}
                style={{ color: "inherit", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                title={k.title}
              >
                {k.title}
              </a>
              <PicAvatars names={k.pics} max={2} size={20} />
              <span style={{ fontSize: 12, color: DUE_COLOR[due.state], whiteSpace: "nowrap" }}>
                {formatDate(k.dueDate, today)}
              </span>
              <Space size={0}>
                {perms.canUpdate(k) && (
                <Tooltip title="Ubah sub task">
                  <Button size="small" type="text" icon={<EditOutlined />} aria-label="Ubah sub task" onClick={() => onOpen(k)} />
                </Tooltip>
                )}
                {perms.canUpdate(k) && (
                <Popconfirm
                  title="Hapus sub task ini?"
                  description={k.title}
                  okText="Hapus"
                  cancelText="Batal"
                  okButtonProps={{ danger: true }}
                  onConfirm={() => {
                    const res = deleteTask(k.id);
                    if (res.ok) message.success("Sub task dihapus.");
                    else message.warning(res.reason);
                  }}
                >
                  <Button size="small" type="text" danger icon={<DeleteOutlined />} aria-label="Hapus sub task" />
                </Popconfirm>
                )}
              </Space>
            </div>
          );
        })}
      </div>

      {canAddSub && (
      <Space.Compact style={{ width: "100%", marginTop: kids.length > 0 ? 8 : 0 }}>
        <Input
          placeholder="Tulis judul sub task, lalu Enter"
          value={title}
          maxLength={160}
          onChange={(e) => setTitle(e.target.value)}
          onPressEnter={(e) => {
            e.preventDefault();
            quickAdd();
          }}
        />
        <Button icon={<PlusOutlined />} onClick={quickAdd} disabled={!title.trim()}>
          Tambah
        </Button>
        <Button onClick={() => onOpen(null)}>Dengan detail…</Button>
      </Space.Compact>
      )}
    </>
  );
}

// Badan form dipisah supaya tiap kali modal dibuka form-nya dibuat ulang dari nol
// (tidak ada sisa nilai dari task sebelumnya, dan tidak butuh useEffect untuk reset).
function TaskFormBody({
  task,
  parentId,
  defaults,
  lockProject,
  phasesOf: phasesOfProp,
  membersOf: membersOfProp,
  onClose,
  onCreated,
}: Omit<TaskFormModalProps, "open"> & { onCreated?: (task: Task) => void }) {
  const { message } = App.useApp();
  const { tasks, addTask } = useTaskStore();
  const actions = useTaskActions();
  const { taskCategories } = useMasterStore();
  const { statuses, isDone } = useStatusMeta();
  const perms = useTaskPermissions();
  const structure = useProjectStructure();
  // Fase & anggota selalu dari struktur project terkini (sinkron dengan halaman detail project),
  // kecuali pemanggil memberi sumber sendiri.
  const phasesOf = useMemo<(projectId: string) => PhaseOption[]>(
    () => phasesOfProp ?? ((id) => structure.phasesOf(id).map((ph) => ({ id: ph.id, name: ph.name }))),
    [phasesOfProp, structure],
  );
  const membersOf = useMemo<(projectId: string) => string[]>(
    () => membersOfProp ?? ((id) => structure.memberNamesOf(id)),
    [membersOfProp, structure],
  );
  const [form] = Form.useForm<FormValues>();
  const [sub, setSub] = useState<{ task: Task | null } | null>(null);

  const parent = parentId ? tasks.find((t) => t.id === parentId) : undefined;
  const isSub = !!parentId;
  const liveTask = task ? tasks.find((t) => t.id === task.id) ?? task : null;
  const kids = useSubtasks(liveTask?.id);
  const hasKids = kids.length > 0;

  const [initialValues] = useState<Partial<FormValues>>(() => {
    const firstStatus = statuses[0]?.id;
    if (task) {
      // Fase milik task bisa saja sudah tidak ada di project-nya (mis. fase dihapus):
      // kosongkan supaya pengguna memilih ulang dari fase yang valid.
      const validPhase = phasesOf(task.projectId).some((p) => p.id === task.phaseId);
      return {
        title: task.title,
        projectId: task.projectId,
        phaseId: validPhase ? task.phaseId : undefined,
        category: task.category,
        pics: task.pics,
        status: task.status,
        progressPercent: task.progressPercent,
        range: [dayjs(task.startDate), dayjs(task.dueDate)],
        description: task.description,
        attachments: task.attachments,
      };
    }
    if (parent) {
      return {
        projectId: parent.projectId,
        phaseId: parent.phaseId,
        category: parent.category,
        status: statuses.find((s) => !s.isDone)?.id ?? firstStatus,
        pics: parent.pics,
        range: [dayjs(parent.startDate), dayjs(parent.dueDate)],
        progressPercent: 0,
        attachments: [],
      };
    }
    // Hanya project yang boleh dibuatkan task oleh pengguna ini (PMO project / Administrator).
    const pid = defaults?.projectId && perms.canCreateIn(defaults.projectId) ? defaults.projectId : undefined;
    const phases = pid ? phasesOf(pid) : [];
    return {
      projectId: pid,
      phaseId: phases[phases.length - 1]?.id, // fase terakhir = fase yang paling mungkin sedang berjalan
      status: defaults?.status ?? firstStatus,
      progressPercent: 0,
      pics: [],
      attachments: [],
    };
  });

  const projectId = Form.useWatch("projectId", form) ?? initialValues.projectId;
  const phases = useMemo(() => (projectId ? phasesOf(projectId) : []), [projectId, phasesOf]);
  const members = useMemo(() => Array.from(new Set(projectId ? membersOf(projectId) : [])), [projectId, membersOf]);
  const phaseMissing = !!task && !!initialValues.projectId && initialValues.phaseId === undefined && !isSub;

  function buildPayload(v: FormValues) {
    const pics = Array.from(new Set((v.pics ?? []).map((p) => p.trim()).filter(Boolean)));
    return {
      title: v.title.trim(),
      description: v.description?.trim() || undefined,
      projectId: v.projectId,
      phaseId: v.phaseId as string,
      category: v.category,
      pics,
      status: v.status,
      progressPercent: isDone(v.status) ? 100 : v.progressPercent,
      startDate: v.range[0].format("YYYY-MM-DD"),
      dueDate: v.range[1].format("YYYY-MM-DD"),
      attachments: v.attachments ?? [],
    };
  }

  function submit(thenAddSubtasks = false) {
    form
      .validateFields()
      .then((v) => {
        const payload = buildPayload(v);
        if (liveTask) {
          // Task induk yang punya sub task: progress dihitung otomatis, jangan ditimpa dari form.
          const patch: TaskPatch = { ...payload };
          if (hasKids) delete patch.progressPercent;
          // Kalau status "selesai" tapi sub task belum, hook menampilkan peringatan + konfirmasi dulu.
          actions.update(liveTask, patch, () => {
            message.success(isSub ? "Sub task diperbarui." : "Task diperbarui.");
            onClose();
          });
          return;
        }
        const created = addTask({ ...payload, parentId });
        if (!created.ok) {
          message.warning(created.reason);
          return;
        }
        message.success(isSub ? "Sub task ditambahkan." : "Task ditambahkan.");
        if (thenAddSubtasks) onCreated?.(created.task);
        else onClose();
      })
      .catch(() => undefined); // validasi gagal: pesan error sudah tampil di form, tidak perlu dilempar lagi
  }

  return (
    <>
      <Form
        form={form}
        layout="vertical"
        initialValues={initialValues}
        requiredMark="optional"
        onValuesChange={(changed) => {
          // Pilih project lain -> fase ikut ke fase terakhir project itu (selalu fase milik project itu).
          if ("projectId" in changed) {
            const list = changed.projectId ? phasesOf(changed.projectId as string) : [];
            form.setFieldsValue({ phaseId: list[list.length - 1]?.id });
          }
          // Status "selesai" -> progress otomatis 100.
          if (changed.status && isDone(changed.status as string)) form.setFieldsValue({ progressPercent: 100 });
        }}
      >
        <Form.Item name="title" label={isSub ? "Judul Sub Task" : "Judul Task"} rules={[{ required: true, whitespace: true, message: "Wajib diisi" }]}>
          <Input placeholder={isSub ? "mis. Validasi data batch 1" : "mis. Integrasi API rekening"} autoFocus maxLength={160} />
        </Form.Item>

        {isSub && parent ? (
          <div style={{ marginBottom: 16, display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Sub task dari
            </Text>
            <Tag style={{ marginInlineEnd: 0 }}>{parent.title}</Tag>
            <Text type="secondary" style={{ fontSize: 12 }}>
              · project, fase, dan kategori mengikuti task induk
            </Text>
          </div>
        ) : (
          <>
            <Row gutter={12}>
              <Col xs={24} sm={14}>
                <Form.Item name="projectId" label="Project" rules={[{ required: true, message: "Wajib diisi" }]}>
                  <Select
                    showSearch
                    // PIC (bukan PMO) tidak bisa memindahkan task ke project lain.
                    disabled={lockProject || (!!task && !perms.canManage(task.projectId))}
                    placeholder="Pilih project"
                    optionFilterProp="text"
                    options={projects
                      .filter((p) => (task ? perms.canManage(p.id) || p.id === task.projectId : perms.canCreateIn(p.id)))
                      .map((p) => ({
                      value: p.id,
                      text: p.name,
                      label: (
                        <Space size={8}>
                          <span style={{ width: 8, height: 8, borderRadius: "50%", background: projectColor(p.id), display: "inline-block" }} />
                          {p.name}
                        </Space>
                      ),
                    }))}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} sm={10}>
                <Form.Item
                  name="phaseId"
                  label="Fase"
                  extra={projectId && phases.length > 0 ? `Project ini punya ${phases.length} fase.` : undefined}
                  rules={[
                    { required: true, message: "Wajib diisi" },
                    {
                      // Penjaga relasi: fase harus benar-benar milik project yang dipilih.
                      validator: (_, value) =>
                        !value || phases.some((p) => p.id === value)
                          ? Promise.resolve()
                          : Promise.reject(new Error("Fase ini bukan milik project yang dipilih")),
                    },
                  ]}
                >
                  <Select
                    placeholder={projectId ? "Pilih fase" : "Pilih project dulu"}
                    disabled={!projectId || phases.length === 0}
                    options={phases.map((p) => ({ label: p.name, value: p.id }))}
                    notFoundContent="Project ini belum punya fase."
                  />
                </Form.Item>
              </Col>
            </Row>
            {projectId && phases.length === 0 && (
              <Alert
                type="warning"
                showIcon
                style={{ marginBottom: 16 }}
                title="Project ini belum punya fase. Tambahkan fase di detail project dulu sebelum membuat task."
              />
            )}
            {phaseMissing && phases.length > 0 && (
              <Alert
                type="warning"
                showIcon
                style={{ marginBottom: 16 }}
                title="Fase task ini sudah tidak ada di project-nya. Pilih fase yang sesuai."
              />
            )}

            <Form.Item name="category" label="Kategori" rules={[{ required: true, message: "Wajib diisi" }]}>
              <Select placeholder="Pilih kategori" options={taskCategories.map((c) => ({ label: c.name, value: c.id }))} />
            </Form.Item>
          </>
        )}

        <Row gutter={12}>
          <Col xs={24} sm={12}>
            <Form.Item name="status" label="Status" rules={[{ required: true, message: "Wajib diisi" }]}>
              <Select
                options={statuses.map((s) => ({
                  value: s.id,
                  label: (
                    <Space size={8}>
                      <StatusDot status={s.id} />
                      {s.name}
                    </Space>
                  ),
                }))}
              />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item name="range" label="Rentang Waktu (mulai — jatuh tempo)" rules={[{ required: true, message: "Wajib diisi" }]}>
              <DatePicker.RangePicker style={{ width: "100%" }} />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item
          name="pics"
          label="PIC"
          extra={members.length > 0 ? "Bisa lebih dari satu. Pilih dari anggota tim project, atau ketik nama lain lalu Enter." : "Bisa lebih dari satu. Ketik nama lalu Enter."}
          rules={[{ required: true, type: "array", min: 1, message: "Minimal satu PIC" }]}
        >
          <Select
            mode="tags"
            tokenSeparators={[","]}
            placeholder="Pilih atau ketik nama penanggung jawab"
            options={members.map((m) => ({ value: m, label: m }))}
          />
        </Form.Item>

        {hasKids && liveTask ? (
          <Form.Item label="Progress" extra="Dihitung otomatis dari rata-rata progress sub task.">
            <Progress percent={liveTask.progressPercent} size="small" />
          </Form.Item>
        ) : (
          <Form.Item name="progressPercent" label="Progress">
            <ProgressField />
          </Form.Item>
        )}

        <Form.Item name="description" label="Deskripsi">
          <Input.TextArea
            autoSize={{ minRows: 3, maxRows: 10 }}
            maxLength={2000}
            showCount
            placeholder="Detail pekerjaan, acuan, catatan, atau hal yang perlu diperhatikan…"
          />
        </Form.Item>

        <SectionTitle>Lampiran</SectionTitle>
        <Form.Item name="attachments" noStyle>
          <AttachmentsField />
        </Form.Item>

        {!isSub && liveTask && <SubtaskSection parent={liveTask} onOpen={(t) => setSub({ task: t })} />}
        {!isSub && !liveTask && (
          <>
            <SectionTitle>Sub Task</SectionTitle>
            <Text type="secondary" style={{ fontSize: 13 }}>
              Simpan task ini dulu untuk menambah sub task — atau pakai tombol “Simpan &amp; tambah sub task”.
            </Text>
          </>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
          <Button onClick={onClose}>Batal</Button>
          {!isSub && !liveTask && <Button onClick={() => submit(true)}>Simpan &amp; tambah sub task</Button>}
          <Button type="primary" onClick={() => submit(false)}>
            Simpan
          </Button>
        </div>
      </Form>

      {!isSub && liveTask && (
        <TaskFormModal
          open={sub !== null}
          task={sub?.task ?? null}
          parentId={liveTask.id}
          phasesOf={phasesOf}
          membersOf={membersOf}
          onClose={() => setSub(null)}
        />
      )}
    </>
  );
}

export default function TaskFormModal({ open, task, parentId, onClose, ...rest }: TaskFormModalProps) {
  const { tasks } = useTaskStore();
  // Setelah "Simpan & tambah sub task", modal yang sama berpindah ke mode ubah task yang baru dibuat.
  const [createdId, setCreatedId] = useState<string | null>(null);
  const live = createdId ? (tasks.find((t) => t.id === createdId) ?? null) : task;

  function close() {
    setCreatedId(null);
    onClose();
  }

  const noun = parentId ? "Sub Task" : "Task";
  return (
    <Modal
      title={live ? `Ubah ${noun}` : `Tambah ${noun}`}
      open={open}
      onCancel={close}
      footer={null}
      destroyOnHidden
      width={720}
      styles={{ body: { maxHeight: "74vh", overflowY: "auto", paddingInlineEnd: 6 } }}
    >
      {/* key: form dibuat ulang untuk tiap task yang dibuka */}
      <TaskFormBody
        key={live?.id ?? "new"}
        task={live}
        parentId={parentId}
        onClose={close}
        onCreated={(t) => setCreatedId(t.id)}
        {...rest}
      />
    </Modal>
  );
}
