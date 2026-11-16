"use client";

import { useState } from "react";
import { Button, Modal, Form, Input, Space, Popconfirm, message } from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";
import DataTable from "@/components/common/DataTable";

export default function SimpleListCrud({
  initialItems,
  itemLabel,
}: {
  initialItems: string[];
  itemLabel: string;
}) {
  const [items, setItems] = useState(initialItems);
  const [open, setOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [form] = Form.useForm<{ name: string }>();

  function openCreate() {
    setEditingIndex(null);
    form.resetFields();
    setOpen(true);
  }

  function openEdit(index: number) {
    setEditingIndex(index);
    form.setFieldsValue({ name: items[index] });
    setOpen(true);
  }

  function handleDelete(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
    message.success(`${itemLabel} dihapus.`);
  }

  function handleSubmit() {
    form.validateFields().then((values) => {
      if (editingIndex === null) {
        setItems((prev) => [...prev, values.name]);
        message.success(`${itemLabel} ditambahkan.`);
      } else {
        setItems((prev) => prev.map((v, i) => (i === editingIndex ? values.name : v)));
        message.success(`${itemLabel} diperbarui.`);
      }
      setOpen(false);
    });
  }

  const dataSource = items.map((name, index) => ({ name, index }));

  return (
    <div>
      <DataTable
        rowKey="index"
        dataSource={dataSource}
        searchPlaceholder={`Cari ${itemLabel.toLowerCase()}...`}
        toolbar={
          <Button icon={<PlusOutlined />} type="primary" onClick={openCreate}>
            Tambah {itemLabel}
          </Button>
        }
        columns={[
          { title: "Nama", dataIndex: "name" },
          {
            title: "Aksi",
            width: 120,
            render: (_, r) => (
              <Space>
                <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r.index)} />
                <Popconfirm
                  title={`Hapus ${itemLabel} ini?`}
                  onConfirm={() => handleDelete(r.index)}
                  okText="Hapus"
                  cancelText="Batal"
                >
                  <Button size="small" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />

      <Modal
        title={editingIndex === null ? `Tambah ${itemLabel}` : `Ubah ${itemLabel}`}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={handleSubmit}
        okText="Simpan"
        cancelText="Batal"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="Nama"
            rules={[{ required: true, message: "Nama wajib diisi" }]}
          >
            <Input placeholder={`Nama ${itemLabel.toLowerCase()}`} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
