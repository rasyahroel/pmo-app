"use client";

import { useState } from "react";
import { Button, Modal, Form, Input, Switch, Space, Popconfirm, Tag, message } from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";
import type { TestType } from "@/lib/mock-data";
import DataTable from "@/components/common/DataTable";

type Item = { type: TestType; requiresPrevious: boolean; allowParallel: boolean };

export default function TestTypesCrud({ initialItems }: { initialItems: Item[] }) {
  const [items, setItems] = useState(initialItems);
  const [open, setOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [form] = Form.useForm<Item>();

  function openCreate() {
    setEditingIndex(null);
    form.resetFields();
    form.setFieldsValue({ requiresPrevious: false, allowParallel: false } as Partial<Item>);
    setOpen(true);
  }

  function openEdit(index: number) {
    setEditingIndex(index);
    form.setFieldsValue(items[index]);
    setOpen(true);
  }

  function handleDelete(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
    message.success("Jenis testing dihapus.");
  }

  function handleSubmit() {
    form.validateFields().then((values) => {
      if (editingIndex === null) {
        setItems((prev) => [...prev, values]);
        message.success("Jenis testing ditambahkan.");
      } else {
        setItems((prev) => prev.map((v, i) => (i === editingIndex ? values : v)));
        message.success("Jenis testing diperbarui.");
      }
      setOpen(false);
    });
  }

  return (
    <div>
      <DataTable
        rowKey="index"
        dataSource={items.map((v, index) => ({ ...v, index }))}
        searchPlaceholder="Cari jenis testing..."
        toolbar={
          <Button icon={<PlusOutlined />} type="primary" onClick={openCreate}>
            Tambah Jenis Testing
          </Button>
        }
        columns={[
          { title: "Jenis", dataIndex: "type", width: 120, render: (v) => <Tag>{v}</Tag> },
          {
            title: "Wajib Menunggu Testing Sebelumnya",
            dataIndex: "requiresPrevious",
            filters: [{ text: "Ya", value: true }, { text: "Tidak", value: false }],
            onFilter: (value, r) => r.requiresPrevious === value,
            searchable: false,
            render: (v) => (v ? <Tag color="gold">Ya</Tag> : <Tag>Tidak</Tag>),
          },
          {
            title: "Boleh Paralel",
            dataIndex: "allowParallel",
            filters: [{ text: "Ya", value: true }, { text: "Tidak", value: false }],
            onFilter: (value, r) => r.allowParallel === value,
            searchable: false,
            render: (v) => (v ? <Tag color="green">Ya</Tag> : <Tag>Tidak</Tag>),
          },
          {
            title: "Aksi",
            width: 120,
            render: (_, r) => (
              <Space>
                <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r.index)} />
                <Popconfirm
                  title="Hapus jenis testing ini?"
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
        title={editingIndex === null ? "Tambah Jenis Testing" : "Ubah Jenis Testing"}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={handleSubmit}
        okText="Simpan"
        cancelText="Batal"
      >
        <Form form={form} layout="vertical">
          <Form.Item name="type" label="Nama Jenis" rules={[{ required: true, message: "Wajib diisi" }]}>
            <Input placeholder="mis. Regression Test" />
          </Form.Item>
          <Form.Item name="requiresPrevious" label="Wajib menunggu testing sebelumnya" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="allowParallel" label="Boleh berjalan paralel" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
