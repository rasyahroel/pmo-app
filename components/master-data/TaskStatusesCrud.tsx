"use client";

import { useState } from "react";
import { App, Button, ColorPicker, Form, Input, Modal, Popconfirm, Space, Switch, Tooltip, Typography } from "antd";
import { ArrowDownOutlined, ArrowUpOutlined, DeleteOutlined, EditOutlined, PlusOutlined } from "@ant-design/icons";
import DataTable from "@/components/common/DataTable";
import { StatusBadge } from "@/components/tasks/TaskStatus";
import { useAuditStore } from "@/lib/audit-store";
import { useMasterStore } from "@/lib/master-store";
import type { TaskStatusDef } from "@/lib/mock-data";
import { STATUS_COLOR_PRESETS } from "@/lib/task-ui";
import { useTaskStore } from "@/lib/task-store";

const { Text } = Typography;

type Values = { name: string; color: string | { toHexString: () => string }; isDone: boolean };

// Master "Status Task": urutan = urutan kolom Task Board. Saklar "Dianggap selesai" memberi arti
// pada status (progress otomatis 100%, tidak dihitung terlambat, menutup sub task); nama & warna bebas.
export default function TaskStatusesCrud() {
  const { message } = App.useApp();
  const { taskStatuses, addTaskStatus, updateTaskStatus, deleteTaskStatus, moveTaskStatus } = useMasterStore();
  const { tasks } = useTaskStore();
  const { addLog } = useAuditStore();
  const [editing, setEditing] = useState<TaskStatusDef | "new" | null>(null);
  const [form] = Form.useForm<Values>();

  const usage = (id: string) => tasks.filter((t) => t.status === id).length;
  const doneCount = taskStatuses.filter((s) => s.isDone).length;
  const log = (name: string, field: string, o: string, n: string) =>
    addLog({ projectName: "Master Data", entity: `Master · Status Task: ${name}`, field, oldValue: o, newValue: n });

  function openModal(target: TaskStatusDef | "new") {
    form.setFieldsValue(
      target === "new"
        ? { name: "", color: STATUS_COLOR_PRESETS[1], isDone: false }
        : { name: target.name, color: target.color, isDone: target.isDone },
    );
    setEditing(target);
  }

  function submit() {
    form
      .validateFields()
      .then((v) => {
        const name = v.name.trim();
        const color = typeof v.color === "string" ? v.color : v.color.toHexString().toUpperCase();
        const editingId = editing === "new" ? null : editing?.id;
        if (taskStatuses.some((s) => s.name.toLowerCase() === name.toLowerCase() && s.id !== editingId)) {
          form.setFields([{ name: "name", errors: ["Status sudah ada"] }]);
          return;
        }
        // Harus selalu ada minimal satu status "dianggap selesai".
        if (editing && editing !== "new" && editing.isDone && !v.isDone && doneCount <= 1) {
          form.setFields([{ name: "isDone", errors: ['Harus ada minimal satu status "dianggap selesai"'] }]);
          return;
        }
        if (editing === "new") {
          addTaskStatus({ name, color, isDone: v.isDone });
          log(name, "Status Task", "—", "Dibuat");
        } else if (editing) {
          updateTaskStatus(editing.id, { name, color, isDone: v.isDone });
          if (editing.name !== name) log(name, "Nama", editing.name, name);
          if (editing.isDone !== v.isDone) log(name, "Dianggap selesai", editing.isDone ? "Ya" : "Tidak", v.isDone ? "Ya" : "Tidak");
        }
        message.success("Status task disimpan.");
        setEditing(null);
      })
      .catch(() => undefined);
  }

  return (
    <div>
      <DataTable
        rowKey="id"
        dataSource={taskStatuses}
        pagination={false}
        searchPlaceholder="Cari status task..."
        toolbar={
          <Space>
            <Button icon={<PlusOutlined />} type="primary" onClick={() => openModal("new")}>
              Tambah Status Task
            </Button>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Urutan di sini = urutan kolom di Task Board.
            </Text>
          </Space>
        }
        columns={[
          {
            title: "Urutan",
            width: 100,
            sortable: false,
            searchable: false,
            render: (_: unknown, r: TaskStatusDef) => {
              const i = taskStatuses.findIndex((s) => s.id === r.id);
              return (
                <Space size={0}>
                  <Button size="small" type="text" icon={<ArrowUpOutlined />} aria-label="Naikkan" disabled={i === 0} onClick={() => moveTaskStatus(r.id, -1)} />
                  <Button size="small" type="text" icon={<ArrowDownOutlined />} aria-label="Turunkan" disabled={i === taskStatuses.length - 1} onClick={() => moveTaskStatus(r.id, 1)} />
                </Space>
              );
            },
          },
          { title: "Status", dataIndex: "name", sortable: false, render: (_: unknown, r: TaskStatusDef) => <StatusBadge status={r.id} /> },
          {
            title: "Dianggap selesai",
            dataIndex: "isDone",
            width: 150,
            sortable: false,
            searchable: false,
            render: (v: boolean) => <Text type="secondary">{v ? "Ya" : "Tidak"}</Text>,
          },
          { title: "Dipakai", width: 100, sortable: false, searchable: false, render: (_: unknown, r: TaskStatusDef) => <Text type="secondary">{usage(r.id)} task</Text> },
          {
            title: "Aksi",
            width: 110,
            sortable: false,
            searchable: false,
            render: (_: unknown, r: TaskStatusDef) => {
              const used = usage(r.id);
              const reason =
                used > 0
                  ? `Masih dipakai ${used} task. Pindahkan task-nya ke status lain dulu.`
                  : taskStatuses.length <= 1
                    ? "Harus ada minimal satu status."
                    : r.isDone && doneCount <= 1
                      ? 'Harus ada minimal satu status "dianggap selesai".'
                      : "";
              return (
                <Space>
                  <Button size="small" icon={<EditOutlined />} aria-label="Ubah status" onClick={() => openModal(r)} />
                  {reason ? (
                    <Tooltip title={reason}>
                      <Button size="small" danger icon={<DeleteOutlined />} aria-label="Hapus status" disabled />
                    </Tooltip>
                  ) : (
                    <Popconfirm
                      title="Hapus status ini?"
                      okText="Hapus"
                      cancelText="Batal"
                      okButtonProps={{ danger: true }}
                      onConfirm={() => {
                        deleteTaskStatus(r.id);
                        log(r.name, "Status Task", "Aktif", "Dihapus");
                        message.success("Status dihapus.");
                      }}
                    >
                      <Button size="small" danger icon={<DeleteOutlined />} aria-label="Hapus status" />
                    </Popconfirm>
                  )}
                </Space>
              );
            },
          },
        ]}
      />

      <Modal
        title={editing === "new" ? "Tambah Status Task" : "Ubah Status Task"}
        open={editing !== null}
        onCancel={() => setEditing(null)}
        onOk={submit}
        okText="Simpan"
        cancelText="Batal"
        destroyOnHidden
        forceRender
      >
        <Form form={form} name="task-status" layout="vertical">
          <Form.Item name="name" label="Nama Status" rules={[{ required: true, whitespace: true, message: "Nama wajib diisi" }]}>
            <Input placeholder="Mis. In Review" />
          </Form.Item>
          <Form.Item name="color" label="Warna" extra="Satu warna utama; warna latar kolom, tepi kartu, dan teks diturunkan otomatis.">
            <ColorPicker showText presets={[{ label: "Saran", colors: STATUS_COLOR_PRESETS }]} />
          </Form.Item>
          <Form.Item
            name="isDone"
            label="Dianggap selesai"
            valuePropName="checked"
            extra="Task di status ini otomatis 100%, tidak dihitung terlambat, dan menutup sub task-nya."
          >
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
