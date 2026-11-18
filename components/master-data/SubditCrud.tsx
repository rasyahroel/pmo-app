"use client";

import { useState } from "react";
import { App, Button, Form, Input, Modal, Popconfirm, Select, Space, Tag, Tooltip, Typography } from "antd";
import { DeleteOutlined, EditOutlined, PlusOutlined } from "@ant-design/icons";
import DataTable from "@/components/common/DataTable";
import { useAuditStore } from "@/lib/audit-store";
import { useMasterStore, type SubditDef } from "@/lib/master-store";
import { subditUsage } from "@/lib/master-usage";
import { useUserStore } from "@/lib/user-store";

const { Text } = Typography;

type Row = SubditDef & { key: string; used: number };

// Subdit selalu milik satu Direktorat. Dropdown Subdit di form project/pegawai/user otomatis
// tersaring sesuai Direktorat yang dipilih.
export default function SubditCrud() {
  const { message } = App.useApp();
  const { users } = useUserStore();
  const { lists, subdits, employees, addSubdit, updateSubdit, deleteSubdit } = useMasterStore();
  const { addLog } = useAuditStore();
  const [editing, setEditing] = useState<SubditDef | "new" | null>(null);
  const [dirFilter, setDirFilter] = useState<string>("all");
  const [form] = Form.useForm<SubditDef>();

  const rows: Row[] = subdits
    .filter((s) => dirFilter === "all" || s.directorate === dirFilter)
    .map((s) => ({ ...s, key: `${s.directorate}|${s.subdirectorate}`, used: subditUsage(s, employees, users) }));
  const log = (s: SubditDef, field: string, o: string, n: string) =>
    addLog({ projectName: "Master Data", entity: `Master · Subdit: ${s.subdirectorate} (${s.directorate})`, field, oldValue: o, newValue: n });

  function open(t: SubditDef | "new") {
    form.setFieldsValue(t === "new" ? { directorate: dirFilter !== "all" ? dirFilter : undefined, subdirectorate: "" } : t);
    setEditing(t);
  }

  function submit() {
    form
      .validateFields()
      .then((v) => {
        const next = { directorate: v.directorate, subdirectorate: v.subdirectorate.trim() };
        const same = (a: SubditDef) => a.directorate === next.directorate && a.subdirectorate.toLowerCase() === next.subdirectorate.toLowerCase();
        const isSelf = editing && editing !== "new" && editing.directorate === next.directorate && editing.subdirectorate === next.subdirectorate;
        if (!isSelf && subdits.some(same) && !(editing && editing !== "new" && same(editing))) {
          form.setFields([{ name: "subdirectorate", errors: ["Subdit ini sudah ada di direktorat tersebut"] }]);
          return;
        }
        if (editing === "new") {
          addSubdit(next);
          log(next, "Subdit", "—", "Dibuat");
          message.success("Subdit ditambahkan.");
        } else if (editing) {
          updateSubdit(editing, next);
          if (editing.subdirectorate !== next.subdirectorate) log(next, "Nama", editing.subdirectorate, next.subdirectorate);
          if (editing.directorate !== next.directorate) log(next, "Direktorat", editing.directorate, next.directorate);
          message.success("Subdit diperbarui.");
        }
        setEditing(null);
      })
      .catch(() => undefined);
  }

  return (
    <div>
      <DataTable
        rowKey="key"
        dataSource={rows}
        searchPlaceholder="Cari subdit atau direktorat..."
        toolbar={
          <Space wrap>
            <Button icon={<PlusOutlined />} type="primary" onClick={() => open("new")}>
              Tambah Subdit
            </Button>
            <Select
              value={dirFilter}
              onChange={setDirFilter}
              style={{ minWidth: 240 }}
              options={[{ value: "all", label: "Semua direktorat" }, ...lists.directorates.map((d) => ({ value: d, label: d }))]}
            />
          </Space>
        }
        columns={[
          { title: "Subdit", dataIndex: "subdirectorate" },
          { title: "Direktorat", dataIndex: "directorate" },
          { title: "Dipakai", dataIndex: "used", width: 120, searchable: false, render: (v: number) => (v > 0 ? <Tag color="blue">{v}</Tag> : <Text type="secondary">belum dipakai</Text>) },
          {
            title: "Aksi",
            width: 110,
            sortable: false,
            searchable: false,
            render: (_: unknown, r: Row) => {
              const why = r.used > 0 ? `Dipakai ${r.used} data (project, pegawai, user) — tidak bisa diubah/dihapus selama masih dipakai.` : "";
              return (
                <Space>
                  <Tooltip title={why}>
                    <Button size="small" icon={<EditOutlined />} aria-label="Ubah subdit" disabled={!!why} onClick={() => open({ directorate: r.directorate, subdirectorate: r.subdirectorate })} />
                  </Tooltip>
                  {why ? (
                    <Tooltip title={why}>
                      <Button size="small" danger icon={<DeleteOutlined />} aria-label="Hapus subdit" disabled />
                    </Tooltip>
                  ) : (
                    <Popconfirm
                      title="Hapus subdit ini?"
                      description={r.subdirectorate}
                      okText="Hapus"
                      cancelText="Batal"
                      okButtonProps={{ danger: true }}
                      onConfirm={() => {
                        deleteSubdit(r);
                        log(r, "Subdit", "Aktif", "Dihapus");
                        message.success("Subdit dihapus.");
                      }}
                    >
                      <Button size="small" danger icon={<DeleteOutlined />} aria-label="Hapus subdit" />
                    </Popconfirm>
                  )}
                </Space>
              );
            },
          },
        ]}
      />
      <Modal title={editing === "new" ? "Tambah Subdit" : "Ubah Subdit"} open={editing !== null} onCancel={() => setEditing(null)} onOk={submit} okText="Simpan" cancelText="Batal" destroyOnHidden forceRender>
        <Form form={form} name="subdit" layout="vertical">
          <Form.Item name="directorate" label="Direktorat" rules={[{ required: true, message: "Pilih direktorat" }]}>
            <Select placeholder="Pilih direktorat" options={lists.directorates.map((d) => ({ label: d, value: d }))} />
          </Form.Item>
          <Form.Item name="subdirectorate" label="Nama Subdit" rules={[{ required: true, whitespace: true, message: "Nama wajib diisi" }]}>
            <Input placeholder="mis. Subdit Development" maxLength={80} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
