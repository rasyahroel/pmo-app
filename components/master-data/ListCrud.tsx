"use client";

import { useState } from "react";
import { App, Button, Form, Input, Modal, Popconfirm, Space, Tag, Tooltip, Typography } from "antd";
import { ArrowDownOutlined, ArrowUpOutlined, DeleteOutlined, EditOutlined, LockOutlined, PlusOutlined } from "@ant-design/icons";
import DataTable from "@/components/common/DataTable";
import { useAuditStore } from "@/lib/audit-store";
import { useMasterStore, type ListKey } from "@/lib/master-store";
import { USAGE_NOUN, listUsage } from "@/lib/master-usage";
import { useUserStore } from "@/lib/user-store";

const { Text } = Typography;

type Row = { name: string; used: number; locked: boolean };

// Daftar nama sederhana (Direktorat, Vendor, Kategori/Priority Project, Sistem Dependency, Level Approval,
// Role Project). Satu komponen untuk semuanya: nama unik, urutan bisa diatur, nilai yang masih dipakai
// tidak bisa diubah-nama/dihapus, dan setiap perubahan tercatat di Riwayat Perubahan.
export default function ListCrud({
  listKey,
  itemLabel,
  locked = [],
  lockedReason = "Nilai bawaan yang dipakai langsung oleh aplikasi.",
}: {
  listKey: ListKey;
  itemLabel: string;
  /** nilai yang tidak boleh diubah/dihapus karena dibaca langsung oleh kode */
  locked?: string[];
  lockedReason?: string;
}) {
  const { message } = App.useApp();
  const { users } = useUserStore();
  const { lists, employees, subdits, addListItem, renameListItem, deleteListItem, moveListItem } = useMasterStore();
  const { addLog } = useAuditStore();
  const items = lists[listKey];
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [form] = Form.useForm<{ name: string }>();

  const rows: Row[] = items.map((name) => ({ name, used: listUsage(listKey, name, { employees, subdits, users }), locked: locked.includes(name) }));
  const log = (name: string, field: string, o: string, n: string) =>
    addLog({ projectName: "Master Data", entity: `Master · ${itemLabel}: ${name}`, field, oldValue: o, newValue: n });

  function open(target: string | "new") {
    form.setFieldsValue({ name: target === "new" ? "" : target });
    setEditing(target);
  }

  function submit() {
    form
      .validateFields()
      .then(({ name }) => {
        const clean = name.trim();
        if (items.some((x) => x.toLowerCase() === clean.toLowerCase() && x !== editing)) {
          form.setFields([{ name: "name", errors: [`${itemLabel} sudah ada`] }]);
          return;
        }
        if (editing === "new") {
          addListItem(listKey, clean);
          log(clean, itemLabel, "—", "Dibuat");
          message.success(`${itemLabel} ditambahkan.`);
        } else if (editing && editing !== clean) {
          renameListItem(listKey, editing, clean);
          log(clean, "Nama", editing, clean);
          message.success(`${itemLabel} diperbarui.`);
        }
        setEditing(null);
      })
      .catch(() => undefined);
  }

  return (
    <div>
      <DataTable
        rowKey="name"
        dataSource={rows}
        pagination={rows.length > 10 ? undefined : false}
        searchPlaceholder={`Cari ${itemLabel.toLowerCase()}...`}
        locale={{ emptyText: `Belum ada ${itemLabel.toLowerCase()}.` }}
        toolbar={
          <Button icon={<PlusOutlined />} type="primary" onClick={() => open("new")}>
            Tambah {itemLabel}
          </Button>
        }
        columns={[
          {
            title: "Urutan",
            width: 100,
            sortable: false,
            searchable: false,
            render: (_: unknown, r: Row) => {
              const i = items.indexOf(r.name);
              return (
                <Space size={0}>
                  <Button size="small" type="text" icon={<ArrowUpOutlined />} aria-label="Naikkan" disabled={i === 0} onClick={() => moveListItem(listKey, r.name, -1)} />
                  <Button size="small" type="text" icon={<ArrowDownOutlined />} aria-label="Turunkan" disabled={i === items.length - 1} onClick={() => moveListItem(listKey, r.name, 1)} />
                </Space>
              );
            },
          },
          {
            title: "Nama",
            dataIndex: "name",
            render: (v: string, r: Row) => (
              <Space size={6}>
                {v}
                {r.locked && (
                  <Tooltip title={lockedReason}>
                    <Tag icon={<LockOutlined />} style={{ marginInlineEnd: 0 }}>
                      bawaan
                    </Tag>
                  </Tooltip>
                )}
              </Space>
            ),
          },
          {
            title: "Dipakai",
            dataIndex: "used",
            width: 130,
            searchable: false,
            render: (v: number) => (v > 0 ? <Tag color="blue">{v}</Tag> : <Text type="secondary">belum dipakai</Text>),
          },
          {
            title: "Aksi",
            width: 110,
            sortable: false,
            searchable: false,
            render: (_: unknown, r: Row) => {
              const why = r.locked ? lockedReason : r.used > 0 ? `Dipakai ${r.used} ${USAGE_NOUN[listKey]} — tidak bisa diubah/dihapus selama masih dipakai.` : "";
              return (
                <Space>
                  <Tooltip title={why}>
                    <Button size="small" icon={<EditOutlined />} aria-label={`Ubah ${itemLabel}`} disabled={!!why} onClick={() => open(r.name)} />
                  </Tooltip>
                  {why ? (
                    <Tooltip title={why}>
                      <Button size="small" danger icon={<DeleteOutlined />} aria-label={`Hapus ${itemLabel}`} disabled />
                    </Tooltip>
                  ) : (
                    <Popconfirm
                      title={`Hapus ${itemLabel.toLowerCase()} ini?`}
                      description={r.name}
                      okText="Hapus"
                      cancelText="Batal"
                      okButtonProps={{ danger: true }}
                      onConfirm={() => {
                        deleteListItem(listKey, r.name);
                        log(r.name, itemLabel, "Aktif", "Dihapus");
                        message.success(`${itemLabel} dihapus.`);
                      }}
                    >
                      <Button size="small" danger icon={<DeleteOutlined />} aria-label={`Hapus ${itemLabel}`} />
                    </Popconfirm>
                  )}
                </Space>
              );
            },
          },
        ]}
      />
      <Modal
        title={editing === "new" ? `Tambah ${itemLabel}` : `Ubah ${itemLabel}`}
        open={editing !== null}
        onCancel={() => setEditing(null)}
        onOk={submit}
        okText="Simpan"
        cancelText="Batal"
        destroyOnHidden
        forceRender
      >
        <Form form={form} name={`list-${listKey}`} layout="vertical">
          <Form.Item name="name" label="Nama" rules={[{ required: true, whitespace: true, message: "Nama wajib diisi" }]}>
            <Input placeholder={`Nama ${itemLabel.toLowerCase()}`} maxLength={80} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
