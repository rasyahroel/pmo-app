"use client";

import { useState } from "react";
import { App, Button, Form, Input, Modal, Popconfirm, Space, Tooltip, Typography } from "antd";
import { DeleteOutlined, EditOutlined, PlusOutlined } from "@ant-design/icons";
import DataTable from "@/components/common/DataTable";
import { useMasterStore, type MeetingCategoryDef } from "@/lib/master-store";
import { useMeetingStore } from "@/lib/meeting-store";
import { useAuditStore } from "@/lib/audit-store";

const { Text } = Typography;

// Master Data > Kategori Rapat. Rapat menyimpan ID kategori, jadi mengganti nama langsung berlaku di
// semua rapat; kategori yang masih dipakai rapat tidak bisa dihapus.
export default function MeetingCategoriesCrud() {
  const { message } = App.useApp();
  const { meetingCategories, addMeetingCategory, renameMeetingCategory, deleteMeetingCategory } = useMasterStore();
  const { meetings } = useMeetingStore();
  const { addLog } = useAuditStore();
  const [form] = Form.useForm<{ name: string }>();
  const [editing, setEditing] = useState<MeetingCategoryDef | "new" | null>(null);

  const log = (name: string, field: string, o: string, n: string) =>
    addLog({ projectName: "Master Data", entity: `Master · Kategori Rapat: ${name}`, field, oldValue: o, newValue: n });
  const usage = (id: string) => meetings.filter((m) => m.categoryId === id).length;

  function submit() {
    form.validateFields().then((v) => {
      const name = v.name.trim();
      if (editing === "new") {
        addMeetingCategory(name);
        log(name, "Kategori Rapat", "—", "Dibuat");
        message.success("Kategori Rapat ditambahkan.");
      } else if (editing) {
        renameMeetingCategory(editing.id, name);
        if (editing.name !== name) log(name, "Nama", editing.name, name);
        message.success("Kategori Rapat diperbarui.");
      }
      setEditing(null);
    }).catch(() => undefined);
  }

  return (
    <div>
      <DataTable
        rowKey="id"
        dataSource={meetingCategories}
        searchPlaceholder="Cari kategori rapat..."
        toolbar={<Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setEditing("new"); }}>Tambah Kategori Rapat</Button>}
        columns={[
          { title: "Nama", dataIndex: "name" },
          { title: "Dipakai", width: 110, sortable: false, searchable: false, render: (_: unknown, c: MeetingCategoryDef) => <Text type="secondary">{usage(c.id)} rapat</Text> },
          {
            title: "Aksi",
            width: 110,
            sortable: false,
            searchable: false,
            render: (_: unknown, c: MeetingCategoryDef) => {
              const used = usage(c.id);
              return (
                <Space>
                  <Button size="small" icon={<EditOutlined />} aria-label="Ubah" onClick={() => { form.setFieldsValue({ name: c.name }); setEditing(c); }} />
                  {used > 0 ? (
                    <Tooltip title={`Masih dipakai ${used} rapat. Ganti kategori rapatnya dulu.`}><Button size="small" danger icon={<DeleteOutlined />} aria-label="Hapus" disabled /></Tooltip>
                  ) : (
                    <Popconfirm title="Hapus kategori ini?" okText="Hapus" cancelText="Batal" okButtonProps={{ danger: true }} onConfirm={() => { deleteMeetingCategory(c.id); log(c.name, "Kategori Rapat", "Aktif", "Dihapus"); message.success("Kategori Rapat dihapus."); }}>
                      <Button size="small" danger icon={<DeleteOutlined />} aria-label="Hapus" />
                    </Popconfirm>
                  )}
                </Space>
              );
            },
          },
        ]}
      />
      <Modal title={editing === "new" ? "Tambah Kategori Rapat" : "Ubah Kategori Rapat"} open={editing !== null} onCancel={() => setEditing(null)} onOk={submit} okText="Simpan" cancelText="Batal" destroyOnHidden>
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="Nama"
            rules={[
              { required: true, whitespace: true, message: "Nama wajib diisi" },
              {
                validator: (_, value: string) =>
                  meetingCategories.some((c) => c.name.toLowerCase() === (value ?? "").trim().toLowerCase() && (editing === "new" || c.id !== (editing as MeetingCategoryDef).id))
                    ? Promise.reject(new Error("Nama kategori sudah ada"))
                    : Promise.resolve(),
              },
            ]}
          >
            <Input maxLength={40} autoFocus placeholder="mis. Kick-off" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
