"use client";

import { useState } from "react";
import { App, Button, Form, Input, Modal, Popconfirm, Select, Space, Tag, Tooltip, Typography } from "antd";
import { DeleteOutlined, EditOutlined, PlusOutlined } from "@ant-design/icons";
import DataTable from "@/components/common/DataTable";
import { useAuditStore } from "@/lib/audit-store";
import { useMasterLists } from "@/lib/master-store";
import { useMasterStore } from "@/lib/master-store";
import { employeeUsage } from "@/lib/master-usage";
import type { Employee } from "@/lib/mock-data";

const { Text } = Typography;
type FormValues = { name: string; directorate: string; subdirectorate: string; roles: string[] };
type Row = Employee & { used: number };

// Master PEGAWAI — orang yang bisa dipilih jadi PMO/Developer/User/QA/Security saat menambah anggota
// tim project. Bukan akun login (itu di Manajemen User); pegawai di sini belum tentu pernah membuka aplikasi.
export default function EmployeesCrud() {
  const { message } = App.useApp();
  const { employees, addEmployee, updateEmployee, deleteEmployee, lists } = useMasterStore();
  const { getSubditOptions } = useMasterLists();
  const { addLog } = useAuditStore();
  const [editing, setEditing] = useState<Employee | "new" | null>(null);
  const [form] = Form.useForm<FormValues>();
  const directorate = Form.useWatch("directorate", form);

  const rows: Row[] = employees.map((e) => ({ ...e, used: employeeUsage(e.id) }));
  const log = (name: string, field: string, o: string, n: string) =>
    addLog({ projectName: "Master Data", entity: `Master · Pegawai: ${name}`, field, oldValue: o, newValue: n });

  function open(t: Employee | "new") {
    form.setFieldsValue(t === "new" ? { name: "", directorate: undefined, subdirectorate: undefined, roles: [] } : { name: t.name, directorate: t.directorate, subdirectorate: t.subdirectorate, roles: t.roles });
    setEditing(t);
  }

  function submit() {
    form
      .validateFields()
      .then((v) => {
        const name = v.name.trim();
        const excludeId = editing && editing !== "new" ? editing.id : null;
        if (employees.some((e) => e.name.toLowerCase() === name.toLowerCase() && e.id !== excludeId)) {
          form.setFields([{ name: "name", errors: ["Nama pegawai sudah ada"] }]);
          return;
        }
        if (editing === "new") {
          addEmployee({ name, directorate: v.directorate, subdirectorate: v.subdirectorate, roles: v.roles });
          log(name, "Pegawai", "—", "Dibuat");
        } else if (editing) {
          updateEmployee(editing.id, { name, directorate: v.directorate, subdirectorate: v.subdirectorate, roles: v.roles });
          if (editing.name !== name) log(name, "Nama", editing.name, name);
          if (editing.directorate !== v.directorate) log(name, "Direktorat", editing.directorate, v.directorate);
          if (editing.subdirectorate !== v.subdirectorate) log(name, "Subdit", editing.subdirectorate, v.subdirectorate);
          if (editing.roles.join(",") !== v.roles.join(",")) log(name, "Bisa jadi role", editing.roles.join(", "), v.roles.join(", "));
        }
        message.success("Pegawai disimpan.");
        setEditing(null);
      })
      .catch(() => undefined);
  }

  return (
    <div>
      <DataTable
        rowKey="id"
        dataSource={rows}
        searchPlaceholder="Cari nama, direktorat, subdit, role..."
        toolbar={
          <Button icon={<PlusOutlined />} type="primary" onClick={() => open("new")}>
            Tambah Pegawai
          </Button>
        }
        columns={[
          {
            title: "Nama",
            dataIndex: "name",
            render: (v: string, r: Row) => (
              <Space size={6}>
                {v}
                {r.userId && (
                  <Tooltip title="Punya akun login aplikasi (lihat Manajemen User)">
                    <Tag color="cyan" style={{ marginInlineEnd: 0 }}>
                      akun
                    </Tag>
                  </Tooltip>
                )}
              </Space>
            ),
          },
          { title: "Direktorat", dataIndex: "directorate", filterable: true },
          { title: "Subdit", dataIndex: "subdirectorate", filterable: true },
          { title: "Bisa jadi role", dataIndex: "roles", filterable: true, render: (v: string[]) => <Space size={4} wrap>{v.map((x) => <Tag key={x} style={{ marginInlineEnd: 0 }}>{x}</Tag>)}</Space> },
          { title: "Di project", dataIndex: "used", width: 110, searchable: false, render: (v: number) => (v > 0 ? <Tag color="blue">{v}</Tag> : <Text type="secondary">—</Text>) },
          {
            title: "Aksi",
            width: 110,
            sortable: false,
            searchable: false,
            render: (_: unknown, r: Row) => {
              const why = r.used > 0 ? `Terdaftar di ${r.used} project — keluarkan dulu dari tim project.` : r.userId ? "Punya akun login — nonaktifkan/hapus akunnya di Manajemen User dulu." : "";
              return (
                <Space>
                  <Button size="small" icon={<EditOutlined />} aria-label="Ubah pegawai" onClick={() => open(r)} />
                  {why ? (
                    <Tooltip title={why}>
                      <Button size="small" danger icon={<DeleteOutlined />} aria-label="Hapus pegawai" disabled />
                    </Tooltip>
                  ) : (
                    <Popconfirm
                      title="Hapus pegawai ini?"
                      description={r.name}
                      okText="Hapus"
                      cancelText="Batal"
                      okButtonProps={{ danger: true }}
                      onConfirm={() => {
                        deleteEmployee(r.id);
                        log(r.name, "Pegawai", "Aktif", "Dihapus");
                        message.success("Pegawai dihapus.");
                      }}
                    >
                      <Button size="small" danger icon={<DeleteOutlined />} aria-label="Hapus pegawai" />
                    </Popconfirm>
                  )}
                </Space>
              );
            },
          },
        ]}
      />
      <Modal title={editing === "new" ? "Tambah Pegawai" : "Ubah Pegawai"} open={editing !== null} onCancel={() => setEditing(null)} onOk={submit} okText="Simpan" cancelText="Batal" destroyOnHidden forceRender>
        <Form form={form} name="employee" layout="vertical">
          <Form.Item
            name="name"
            label="Nama"
            rules={[{ required: true, whitespace: true, message: "Wajib diisi" }]}
            extra={editing && editing !== "new" && employeeUsage(editing.id) > 0 ? "Nama yang sudah tercatat di tim project tidak ikut berubah di project tersebut." : undefined}
          >
            <Input placeholder="Nama lengkap" maxLength={80} />
          </Form.Item>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
            <Form.Item name="directorate" label="Direktorat" rules={[{ required: true, message: "Wajib diisi" }]}>
              <Select placeholder="Pilih direktorat" options={lists.directorates.map((d) => ({ label: d, value: d }))} onChange={() => form.setFieldsValue({ subdirectorate: undefined })} />
            </Form.Item>
            <Form.Item name="subdirectorate" label="Subdit" rules={[{ required: true, message: "Wajib diisi" }]}>
              <Select placeholder={directorate ? "Pilih subdit" : "Pilih direktorat dulu"} disabled={!directorate} options={getSubditOptions(directorate).map((s) => ({ label: s.subdirectorate, value: s.subdirectorate }))} />
            </Form.Item>
          </div>
          <Form.Item name="roles" label="Bisa dipilih jadi role" rules={[{ required: true, message: "Pilih minimal satu role" }]}>
            <Select mode="multiple" placeholder="Pilih role" options={lists.projectRoles.map((r) => ({ label: r, value: r }))} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
