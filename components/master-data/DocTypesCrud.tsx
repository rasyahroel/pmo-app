"use client";

import { useState } from "react";
import { Button, Modal, Form, Input, Space, Popconfirm, Tag, message } from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";
import DataTable from "@/components/common/DataTable";
import type { DocType } from "@/lib/mock-data";

type Item = { type: DocType; description: string };

export default function DocTypesCrud({ initialItems }: { initialItems: Item[] }) {
  const [items, setItems] = useState(initialItems);
  const [open, setOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [form] = Form.useForm<Item>();

  function openCreate() {
    setEditingIndex(null);
    form.resetFields();
    setOpen(true);
  }

  function openEdit(index: number) {
    setEditingIndex(index);
    form.setFieldsValue(items[index]);
    setOpen(true);
  }

  function handleDelete(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
    message.success("Jenis dokumen dihapus.");
  }

  function handleSubmit() {
    form.validateFields().then((values) => {
      if (editingIndex === null) {
        setItems((prev) => [...prev, values]);
        message.success("Jenis dokumen ditambahkan.");
      } else {
        setItems((prev) => prev.map((v, i) => (i === editingIndex ? values : v)));
        message.success("Jenis dokumen diperbarui.");
      }
      setOpen(false);
    });
  }

  const dataSource = items.map((v, index) => ({ ...v, index }));

  return (
    <div>
      <DataTable
        rowKey="index"
        dataSource={dataSource}
        searchPlaceholder="Cari kode/deskripsi..."
        toolbar={
          <Button icon={<PlusOutlined />} type="primary" onClick={openCreate}>
            Tambah Jenis Dokumen
          </Button>
        }
        columns={[
          { title: "Kode", dataIndex: "type", width: 100, render: (v) => <Tag>{v}</Tag> },
          { title: "Deskripsi", dataIndex: "description" },
          {
            title: "Aksi",
            width: 120,
            render: (_, r) => (
              <Space>
                <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r.index)} />
                <Popconfirm
                  title="Hapus jenis dokumen ini?"
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
        title={editingIndex === null ? "Tambah Jenis Dokumen" : "Ubah Jenis Dokumen"}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={handleSubmit}
        okText="Simpan"
        cancelText="Batal"
      >
        <Form form={form} layout="vertical">
          <Form.Item name="type" label="Kode" rules={[{ required: true, message: "Kode wajib diisi" }]}>
            <Input placeholder="mis. BR" />
          </Form.Item>
          <Form.Item
            name="description"
            label="Deskripsi"
            rules={[{ required: true, message: "Deskripsi wajib diisi" }]}
          >
            <Input placeholder="mis. Business Requirement" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
