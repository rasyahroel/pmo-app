"use client";

import { useState } from "react";
import {
  Tag, Avatar, Typography, Button, Modal, Form, Input,
  Select, Switch, Space, Popconfirm, message, Row, Col,
} from "antd";
import { UserOutlined, PlusOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";
import PageSkeleton from "@/components/layout/PageSkeleton";
import DataTable from "@/components/common/DataTable";
import { appUsers as initialUsers, masterDirektorat, getSubditOptions, roles, type AppUser } from "@/lib/mock-data";

const { Text } = Typography;

type FormValues = {
  name: string;
  email: string;
  directorate: string;
  subdirectorate: string;
  roles: string[];
  active: boolean;
};

export default function UserManagementUsersPage() {
  const [users, setUsers] = useState<AppUser[]>(initialUsers);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form] = Form.useForm<FormValues>();
  const directorate = Form.useWatch("directorate", form);

  function openCreate() {
    setEditingId(null);
    form.resetFields();
    setOpen(true);
  }

  function openEdit(u: AppUser) {
    setEditingId(u.id);
    form.setFieldsValue(u);
    setOpen(true);
  }

  function handleDelete(id: string) {
    setUsers((prev) => prev.filter((u) => u.id !== id));
    message.success("Pengguna dihapus.");
  }

  function handleSubmit() {
    form.validateFields().then((values) => {
      if (editingId === null) {
        setUsers((prev) => [...prev, { id: `u-${Date.now()}`, ...values }]);
        message.success("Pengguna ditambahkan.");
      } else {
        setUsers((prev) => prev.map((u) => (u.id === editingId ? { ...u, ...values } : u)));
        message.success("Pengguna diperbarui.");
      }
      setOpen(false);
    });
  }

  return (
    <PageSkeleton path="/user-management/users">
      <DataTable
        rowKey="id"
        scroll={{ x: "max-content" }}
        dataSource={users}
        searchPlaceholder="Cari nama, email, direktorat, subdit, role..."
        toolbar={
          <Button icon={<PlusOutlined />} type="primary" onClick={openCreate}>
            Tambah Pengguna
          </Button>
        }
        columns={[
          {
            title: "Nama",
            dataIndex: "name",
            searchValue: (r) => `${r.name} ${r.email}`,
            render: (v, r) => (
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Avatar size="small" icon={<UserOutlined />} />
                <div>
                  <div style={{ fontWeight: 500 }}>{v}</div>
                  <Text type="secondary" style={{ fontSize: 12 }}>{r.email}</Text>
                </div>
              </div>
            ),
          },
          {
            title: "Direktorat / Subdit",
            width: 280,
            dataIndex: "directorate",
            filterable: true,
            searchValue: (r) => `${r.directorate} ${r.subdirectorate}`,
            render: (_, r) => (
              <Text style={{ fontSize: 13 }}>{r.directorate} · {r.subdirectorate}</Text>
            ),
          },
          {
            title: "Role",
            dataIndex: "roles",
            width: 180,
            filterable: true,
            render: (v: string[]) => v.map((r) => <Tag key={r}>{r}</Tag>),
          },
          {
            title: "Status",
            dataIndex: "active",
            width: 100,
            searchable: false,
            filters: [{ text: "Aktif", value: true }, { text: "Nonaktif", value: false }],
            onFilter: (value, r) => r.active === value,
            render: (v) => (v ? <Tag color="green">Aktif</Tag> : <Tag color="red">Nonaktif</Tag>),
          },
          {
            title: "Aksi",
            width: 100,
            render: (_, r) => (
              <Space>
                <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
                <Popconfirm title="Hapus pengguna ini?" onConfirm={() => handleDelete(r.id)} okText="Hapus" cancelText="Batal">
                  <Button size="small" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />

      <Modal
        title={editingId === null ? "Tambah Pengguna" : "Ubah Pengguna"}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={handleSubmit}
        okText="Simpan"
        cancelText="Batal"
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="Nama" rules={[{ required: true, message: "Wajib diisi" }]}>
            <Input placeholder="Nama lengkap" />
          </Form.Item>
          <Form.Item
            name="email"
            label="Email"
            rules={[{ required: true, type: "email", message: "Email tidak valid" }]}
          >
            <Input placeholder="nama@company.co.id" />
          </Form.Item>
          <Row gutter={12}>
            <Col xs={24} sm={12}>
              <Form.Item name="directorate" label="Direktorat" rules={[{ required: true, message: "Wajib diisi" }]}>
                <Select
                  options={masterDirektorat.map((d) => ({ label: d, value: d }))}
                  onChange={() => form.setFieldsValue({ subdirectorate: undefined })}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="subdirectorate" label="Subdit" rules={[{ required: true, message: "Wajib diisi" }]}>
                <Select
                  placeholder={directorate ? "Pilih subdit" : "Pilih direktorat dulu"}
                  disabled={!directorate}
                  options={getSubditOptions(directorate).map((s) => ({ label: s.subdirectorate, value: s.subdirectorate }))}
                />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="roles" label="Role" rules={[{ required: true, message: "Wajib diisi" }]}>
            <Select mode="multiple" options={roles.map((r) => ({ label: r.name, value: r.name }))} />
          </Form.Item>
          <Form.Item name="active" label="Status Aktif" valuePropName="checked" initialValue={true}>
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </PageSkeleton>
  );
}
