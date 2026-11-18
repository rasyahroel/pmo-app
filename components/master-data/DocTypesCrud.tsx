"use client";

import { useState } from "react";
import { App, Button, Form, Input, Modal, Popconfirm, Space, Tag, Tooltip, Typography } from "antd";
import { DeleteOutlined, EditOutlined, PlusOutlined } from "@ant-design/icons";
import DataTable from "@/components/common/DataTable";
import { useAuditStore } from "@/lib/audit-store";
import { useMasterStore, type DocTypeDef } from "@/lib/master-store";
import { docTypeUsage } from "@/lib/master-usage";

const { Text } = Typography;
type Row = DocTypeDef & { used: number };

// Jenis dokumen (BR, CR, FSD, PO, ...). Kode dipakai sebagai kunci dokumen, jadi tidak bisa diubah
// setelah dibuat; deskripsi boleh diubah kapan saja.
export default function DocTypesCrud() {
  const { message } = App.useApp();
  const { documentTypes, addDocumentType, updateDocumentType, deleteDocumentType } = useMasterStore();
  const { addLog } = useAuditStore();
  const [editing, setEditing] = useState<DocTypeDef | "new" | null>(null);
  const [form] = Form.useForm<DocTypeDef>();
  const rows: Row[] = documentTypes.map((d) => ({ ...d, used: docTypeUsage(d.type) }));
  const log = (type: string, field: string, o: string, n: string) =>
    addLog({ projectName: "Master Data", entity: `Master · Jenis Dokumen: ${type}`, field, oldValue: o, newValue: n });

  function open(t: DocTypeDef | "new") {
    form.setFieldsValue(t === "new" ? { type: "", description: "" } : t);
    setEditing(t);
  }

  function submit() {
    form
      .validateFields()
      .then((v) => {
        const type = v.type.trim().toUpperCase();
        const description = v.description.trim();
        if (editing === "new") {
          if (documentTypes.some((d) => d.type.toLowerCase() === type.toLowerCase())) {
            form.setFields([{ name: "type", errors: ["Kode sudah ada"] }]);
            return;
          }
          addDocumentType({ type, description });
          log(type, "Jenis Dokumen", "—", "Dibuat");
        } else if (editing) {
          updateDocumentType(editing.type, { description });
          if (editing.description !== description) log(editing.type, "Deskripsi", editing.description, description);
        }
        message.success("Jenis dokumen disimpan.");
        setEditing(null);
      })
      .catch(() => undefined);
  }

  return (
    <div>
      <DataTable
        rowKey="type"
        dataSource={rows}
        pagination={false}
        searchPlaceholder="Cari kode atau deskripsi..."
        toolbar={
          <Button icon={<PlusOutlined />} type="primary" onClick={() => open("new")}>
            Tambah Jenis Dokumen
          </Button>
        }
        columns={[
          { title: "Kode", dataIndex: "type", width: 120, render: (v: string) => <Tag>{v}</Tag> },
          { title: "Deskripsi", dataIndex: "description" },
          { title: "Dipakai", dataIndex: "used", width: 120, searchable: false, render: (v: number) => (v > 0 ? <Tag color="blue">{v} dokumen</Tag> : <Text type="secondary">belum dipakai</Text>) },
          {
            title: "Aksi",
            width: 110,
            sortable: false,
            searchable: false,
            render: (_: unknown, r: Row) => (
              <Space>
                <Button size="small" icon={<EditOutlined />} aria-label="Ubah jenis dokumen" onClick={() => open({ type: r.type, description: r.description })} />
                {r.used > 0 ? (
                  <Tooltip title={`Dipakai ${r.used} dokumen — hapus dokumennya dulu.`}>
                    <Button size="small" danger icon={<DeleteOutlined />} aria-label="Hapus jenis dokumen" disabled />
                  </Tooltip>
                ) : (
                  <Popconfirm
                    title="Hapus jenis dokumen ini?"
                    description={`${r.type} — ${r.description}`}
                    okText="Hapus"
                    cancelText="Batal"
                    okButtonProps={{ danger: true }}
                    onConfirm={() => {
                      deleteDocumentType(r.type);
                      log(r.type, "Jenis Dokumen", "Aktif", "Dihapus");
                      message.success("Jenis dokumen dihapus.");
                    }}
                  >
                    <Button size="small" danger icon={<DeleteOutlined />} aria-label="Hapus jenis dokumen" />
                  </Popconfirm>
                )}
              </Space>
            ),
          },
        ]}
      />
      <Modal title={editing === "new" ? "Tambah Jenis Dokumen" : "Ubah Jenis Dokumen"} open={editing !== null} onCancel={() => setEditing(null)} onOk={submit} okText="Simpan" cancelText="Batal" destroyOnHidden forceRender>
        <Form form={form} name="doc-type" layout="vertical">
          <Form.Item
            name="type"
            label="Kode"
            rules={[{ required: true, whitespace: true, message: "Kode wajib diisi" }, { max: 10, message: "Maksimal 10 karakter" }]}
            extra={editing !== "new" ? "Kode tidak bisa diubah karena dipakai sebagai kunci dokumen." : "Singkat, mis. BR, CR, FSD. Otomatis huruf besar."}
          >
            <Input placeholder="mis. SRS" disabled={editing !== "new"} maxLength={10} />
          </Form.Item>
          <Form.Item name="description" label="Deskripsi" rules={[{ required: true, whitespace: true, message: "Deskripsi wajib diisi" }]}>
            <Input placeholder="mis. Software Requirement Specification" maxLength={80} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
