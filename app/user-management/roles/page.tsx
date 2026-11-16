"use client";

import { useState } from "react";
import {
  Collapse, Table, Typography, Space, Checkbox, Button, Modal,
  Form, Input, Popconfirm, message,
} from "antd";
import { PlusOutlined, DeleteOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import PageSkeleton from "@/components/layout/PageSkeleton";
import { roles as initialRoles, type Role, type RolePermission } from "@/lib/mock-data";

const { Text } = Typography;

type PermKey = "view" | "create" | "edit" | "delete";

export default function UserManagementRolesPage() {
  const [roles, setRoles] = useState<Role[]>(initialRoles);
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm<{ name: string; description: string }>();

  function togglePermission(roleId: string, menuKey: string, key: PermKey) {
    setRoles((prev) =>
      prev.map((role) =>
        role.id !== roleId
          ? role
          : {
            ...role,
            permissions: role.permissions.map((p) =>
              p.menuKey === menuKey ? { ...p, [key]: !p[key] } : p
            ),
          }
      )
    );
  }

  function handleDeleteRole(id: string) {
    setRoles((prev) => prev.filter((r) => r.id !== id));
    message.success("Role dihapus.");
  }

  function handleAddRole() {
    form.validateFields().then((values) => {
      const base = initialRoles[0]?.permissions ?? [];
      const newRole: Role = {
        id: `role-${Date.now()}`,
        name: values.name,
        description: values.description,
        memberCount: 0,
        permissions: base.map((p) => ({ ...p, view: false, create: false, edit: false, delete: false })),
      };
      setRoles((prev) => [...prev, newRole]);
      message.success("Role ditambahkan. Atur akses menunya di bawah.");
      setOpen(false);
      form.resetFields();
    });
  }

  return (
    <PageSkeleton path="/user-management/roles">
      <Button icon={<PlusOutlined />} type="primary" onClick={() => setOpen(true)} style={{ marginBottom: 12 }}>
        Tambah Role
      </Button>

      <Collapse
        items={roles.map((role) => ({
          key: role.id,
          label: (
            <Space>
              <Text strong>{role.name}</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>{role.memberCount} pengguna</Text>
            </Space>
          ),
          extra: (
            <Popconfirm
              title="Hapus role ini?"
              onConfirm={(e) => {
                e?.stopPropagation();
                handleDeleteRole(role.id);
              }}
              onCancel={(e) => e?.stopPropagation()}
              okText="Hapus"
              cancelText="Batal"
            >
              <Button size="small" danger icon={<DeleteOutlined />} onClick={(e) => e.stopPropagation()} />
            </Popconfirm>
          ),
          children: (
            <div>
              <Text type="secondary">{role.description}</Text>
              <Table
                scroll={{ x: "max-content" }}
                style={{ marginTop: 12 }}
                rowKey="menuKey"
                size="small"
                pagination={false}
                dataSource={role.permissions}
                columns={(["view", "create", "edit", "delete"] as PermKey[]).reduce<ColumnsType<RolePermission>>(
                  (cols, key) => [
                    ...cols,
                    {
                      title: key[0].toUpperCase() + key.slice(1),
                      dataIndex: key,
                      width: 80,
                      render: (checked: boolean, r: RolePermission) => (
                        <Checkbox
                          checked={checked}
                          onChange={() => togglePermission(role.id, r.menuKey, key)}
                        />
                      ),
                    },
                  ],
                  [{ title: "Menu", dataIndex: "menuLabel" }]
                )}
              />
            </div>
          ),
        }))}
      />

      <Modal
        title="Tambah Role"
        open={open}
        onCancel={() => setOpen(false)}
        onOk={handleAddRole}
        okText="Simpan"
        cancelText="Batal"
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="Nama Role" rules={[{ required: true, message: "Wajib diisi" }]}>
            <Input placeholder="mis. Vendor Partner" />
          </Form.Item>
          <Form.Item name="description" label="Deskripsi" rules={[{ required: true, message: "Wajib diisi" }]}>
            <Input.TextArea rows={2} placeholder="Peran dan cakupan akses role ini" />
          </Form.Item>
        </Form>
        <Text type="secondary" style={{ fontSize: 12 }}>
          Akses per menu (View/Create/Edit/Delete) diatur setelah role dibuat, lewat ceklis di tabel.
        </Text>
      </Modal>
    </PageSkeleton>
  );
}
