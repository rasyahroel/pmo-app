"use client";

import { useState } from "react";
import { App, Button, Form, Input, Modal, Popconfirm, Space, Tooltip } from "antd";
import { DeleteOutlined, EditOutlined, PlusOutlined } from "@ant-design/icons";
import DataTable from "@/components/common/DataTable";
import { useAuditStore } from "@/lib/audit-store";
import { useMasterStore } from "@/lib/master-store";
import type { TaskCategoryDef } from "@/lib/mock-data";
import { useTaskStore } from "@/lib/task-store";

// Master "Kategori Task". Task menyimpan ID kategori, jadi mengganti nama tidak memutus data.
export default function TaskCategoriesCrud() {
  const { message } = App.useApp();
  const { taskCategories, addTaskCategory, updateTaskCategory, deleteTaskCategory } = useMasterStore();
  const { tasks } = useTaskStore();
  const { addLog } = useAuditStore();
  const [editing, setEditing] = useState<TaskCategoryDef | "new" | null>(null);
  const [form] = Form.useForm<{ name: string }>();

  const usage = (id: string) => tasks.filter((t) => !t.parentId && t.category === id).length;
  const log = (name: string, field: string, o: string, n: string) =>
    addLog({ projectName: "Master Data", entity: `Master · Kategori Task: ${name}`, field, oldValue: o, newValue: n });

  function openModal(target: TaskCategoryDef | "new") {
    form.setFieldsValue({ name: target === "new" ? "" : target.name });
    setEditing(target);
  }

  function submit() {
    form
      .validateFields()
      .then(({ name }) => {
        const clean = name.trim();
        const editingId = editing === "new" ? null : editing?.id;
        if (taskCategories.some((c) => c.name.toLowerCase() === clean.toLowerCase() && c.id !== editingId)) {
          form.setFields([{ name: "name", errors: ["Kategori sudah ada"] }]);
          return;
        }
        if (editing === "new") {
          addTaskCategory(clean);
          log(clean, "Kategori Task", "—", "Dibuat");
        } else if (editing) {
          updateTaskCategory(editing.id, clean);
          if (editing.name !== clean) log(clean, "Nama", editing.name, clean);
        }
        message.success("Kategori task disimpan.");
        setEditing(null);
      })
      .catch(() => undefined);
  }

  return (
    <div>
      <DataTable
        rowKey="id"
        dataSource={taskCategories}
        searchPlaceholder="Cari kategori task..."
        toolbar={
          <Button icon={<PlusOutlined />} type="primary" onClick={() => openModal("new")}>
            Tambah Kategori Task
          </Button>
        }
        columns={[
          { title: "Nama", dataIndex: "name" },
          { title: "Dipakai", width: 110, sortable: false, searchable: false, render: (_: unknown, r: TaskCategoryDef) => `${usage(r.id)} task` },
          {
            title: "Aksi",
            width: 120,
            sortable: false,
            searchable: false,
            render: (_: unknown, r: TaskCategoryDef) => {
              const used = usage(r.id);
              return (
                <Space>
                  <Button size="small" icon={<EditOutlined />} aria-label="Ubah kategori" onClick={() => openModal(r)} />
                  {used > 0 ? (
                    <Tooltip title={`Masih dipakai ${used} task. Pindahkan task-nya ke kategori lain dulu.`}>
                      <Button size="small" danger icon={<DeleteOutlined />} aria-label="Hapus kategori" disabled />
                    </Tooltip>
                  ) : (
                    <Popconfirm
                      title="Hapus kategori ini?"
                      okText="Hapus"
                      cancelText="Batal"
                      okButtonProps={{ danger: true }}
                      onConfirm={() => {
                        deleteTaskCategory(r.id);
                        log(r.name, "Kategori Task", "Aktif", "Dihapus");
                        message.success("Kategori dihapus.");
                      }}
                    >
                      <Button size="small" danger icon={<DeleteOutlined />} aria-label="Hapus kategori" />
                    </Popconfirm>
                  )}
                </Space>
              );
            },
          },
        ]}
      />
      <Modal
        title={editing === "new" ? "Tambah Kategori Task" : "Ubah Kategori Task"}
        open={editing !== null}
        onCancel={() => setEditing(null)}
        onOk={submit}
        okText="Simpan"
        cancelText="Batal"
        destroyOnHidden
        forceRender
      >
        <Form form={form} name="task-category" layout="vertical">
          <Form.Item name="name" label="Nama" rules={[{ required: true, whitespace: true, message: "Nama wajib diisi" }]}>
            <Input placeholder="Nama kategori task" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
