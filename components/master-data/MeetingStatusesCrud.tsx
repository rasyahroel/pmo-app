"use client";

import { useState } from "react";
import { App, Button, ColorPicker, Form, Input, Modal, Popconfirm, Select, Space, Tag, Tooltip, Typography } from "antd";
import { ArrowDownOutlined, ArrowUpOutlined, DeleteOutlined, EditOutlined, PlusOutlined } from "@ant-design/icons";
import DataTable from "@/components/common/DataTable";
import { useMasterStore, type MeetingStatusDef, type MeetingStatusKind } from "@/lib/master-store";
import { useMeetingStore } from "@/lib/meeting-store";
import { useAuditStore } from "@/lib/audit-store";
import { deriveStatusStyle } from "@/lib/task-ui";

const { Text } = Typography;
const PRESETS = ["#2F80ED", "#17C653", "#F8285A", "#F6B100", "#8B5CF6", "#22A7B8", "#F97316", "#7C8798"];
const KIND_LABEL: Record<MeetingStatusKind, string> = {
  planned: "Terjadwal (belum berlangsung)",
  done: "Selesai (sudah berlangsung)",
  cancelled: "Batal / ditunda",
};

type FormValues = { name: string; color: string | { toHexString: () => string }; kind: MeetingStatusKind };

// Master Data > Status Rapat. `kind` memberi arti pada status (terjadwal / selesai / batal) sehingga
// nama dan warnanya bebas diubah tanpa merusak Dashboard dan filter rapat.
export default function MeetingStatusesCrud() {
  const { message } = App.useApp();
  const { meetingStatuses, addMeetingStatus, updateMeetingStatus, deleteMeetingStatus, moveMeetingStatus } = useMasterStore();
  const { meetings } = useMeetingStore();
  const { addLog } = useAuditStore();
  const [form] = Form.useForm<FormValues>();
  const [editing, setEditing] = useState<MeetingStatusDef | "new" | null>(null);

  const log = (name: string, field: string, o: string, n: string) =>
    addLog({ projectName: "Master Data", entity: `Master · Status Rapat: ${name}`, field, oldValue: o, newValue: n });
  const usage = (id: string) => meetings.filter((m) => m.statusId === id).length;
  const countKind = (k: MeetingStatusKind) => meetingStatuses.filter((s) => s.kind === k).length;

  function submit() {
    form.validateFields().then((v) => {
      const color = typeof v.color === "string" ? v.color : v.color.toHexString();
      const name = v.name.trim();
      if (editing === "new") {
        addMeetingStatus({ name, color, kind: v.kind });
        log(name, "Status Rapat", "—", "Dibuat");
        message.success("Status ditambahkan.");
      } else if (editing) {
        updateMeetingStatus(editing.id, { name, color, kind: v.kind });
        if (editing.name !== name) log(name, "Nama", editing.name, name);
        if (editing.kind !== v.kind) log(name, "Arti status", KIND_LABEL[editing.kind], KIND_LABEL[v.kind]);
        message.success("Status diperbarui.");
      }
      setEditing(null);
    }).catch(() => undefined);
  }

  return (
    <div>
      <DataTable
        rowKey="id"
        dataSource={meetingStatuses}
        pagination={false}
        searchPlaceholder="Cari status rapat..."
        toolbar={
          <Space>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); form.setFieldsValue({ color: PRESETS[0], kind: "planned" }); setEditing("new"); }}>
              Tambah Status Rapat
            </Button>
            <Text type="secondary" style={{ fontSize: 12 }}>Urutan di sini = urutan pada pilihan status.</Text>
          </Space>
        }
        columns={[
          {
            title: "Urutan",
            width: 96,
            sortable: false,
            searchable: false,
            render: (_: unknown, s: MeetingStatusDef) => {
              const i = meetingStatuses.findIndex((x) => x.id === s.id);
              return (
                <Space size={0}>
                  <Button size="small" type="text" icon={<ArrowUpOutlined />} aria-label="Naikkan" disabled={i === 0} onClick={() => moveMeetingStatus(s.id, -1)} />
                  <Button size="small" type="text" icon={<ArrowDownOutlined />} aria-label="Turunkan" disabled={i === meetingStatuses.length - 1} onClick={() => moveMeetingStatus(s.id, 1)} />
                </Space>
              );
            },
          },
          {
            title: "Status",
            dataIndex: "name",
            sortable: false,
            render: (_: unknown, s: MeetingStatusDef) => {
              const st = deriveStatusStyle(s.color);
              return <Tag style={{ color: st.text, background: st.soft, borderColor: st.border, marginInlineEnd: 0 }}>{s.name}</Tag>;
            },
          },
          { title: "Arti", dataIndex: "kind", width: 240, sortable: false, render: (k: MeetingStatusKind) => <Text type="secondary">{KIND_LABEL[k]}</Text> },
          { title: "Dipakai", width: 100, sortable: false, searchable: false, render: (_: unknown, s: MeetingStatusDef) => <Text type="secondary">{usage(s.id)} rapat</Text> },
          {
            title: "Aksi",
            width: 110,
            sortable: false,
            searchable: false,
            render: (_: unknown, s: MeetingStatusDef) => {
              const used = usage(s.id);
              const lastOfKind = countKind(s.kind) <= 1;
              const reason = used > 0 ? `Masih dipakai ${used} rapat. Ubah status rapatnya dulu.` : lastOfKind ? "Harus ada minimal satu status untuk tiap arti." : "";
              return (
                <Space>
                  <Button size="small" icon={<EditOutlined />} aria-label="Ubah" onClick={() => { form.setFieldsValue({ name: s.name, color: s.color, kind: s.kind }); setEditing(s); }} />
                  {reason ? (
                    <Tooltip title={reason}><Button size="small" danger icon={<DeleteOutlined />} aria-label="Hapus" disabled /></Tooltip>
                  ) : (
                    <Popconfirm title="Hapus status ini?" okText="Hapus" cancelText="Batal" okButtonProps={{ danger: true }} onConfirm={() => { deleteMeetingStatus(s.id); log(s.name, "Status Rapat", "Aktif", "Dihapus"); message.success("Status dihapus."); }}>
                      <Button size="small" danger icon={<DeleteOutlined />} aria-label="Hapus" />
                    </Popconfirm>
                  )}
                </Space>
              );
            },
          },
        ]}
      />

      <Modal title={editing === "new" ? "Tambah Status Rapat" : "Ubah Status Rapat"} open={editing !== null} onCancel={() => setEditing(null)} onOk={submit} okText="Simpan" cancelText="Batal" destroyOnHidden>
        <Form form={form} layout="vertical" requiredMark="optional">
          <Form.Item
            name="name"
            label="Nama Status"
            rules={[
              { required: true, whitespace: true, message: "Wajib diisi" },
              {
                validator: (_, value: string) =>
                  meetingStatuses.some((s) => s.name.toLowerCase() === (value ?? "").trim().toLowerCase() && (editing === "new" || s.id !== (editing as MeetingStatusDef).id))
                    ? Promise.reject(new Error("Nama status sudah ada"))
                    : Promise.resolve(),
              },
            ]}
          >
            <Input maxLength={30} autoFocus placeholder="mis. Ditunda" />
          </Form.Item>
          <Form.Item name="color" label="Warna" rules={[{ required: true, message: "Wajib diisi" }]}>
            <ColorPicker format="hex" showText presets={[{ label: "Warna saran", colors: PRESETS }]} />
          </Form.Item>
          <Form.Item
            name="kind"
            label="Arti status"
            extra="Dipakai Dashboard dan filter: Terjadwal tampil di Rapat Mendatang, Selesai dihitung untuk pengingat hasil rapat (MOM)."
            rules={[
              { required: true, message: "Wajib diisi" },
              {
                validator: (_, value: MeetingStatusKind) => {
                  // jangan sampai suatu arti tidak punya status sama sekali
                  if (editing && editing !== "new" && editing.kind !== value && countKind(editing.kind) <= 1) {
                    return Promise.reject(new Error(`Ini satu-satunya status "${KIND_LABEL[editing.kind]}".`));
                  }
                  return Promise.resolve();
                },
              },
            ]}
          >
            <Select options={(Object.keys(KIND_LABEL) as MeetingStatusKind[]).map((k) => ({ value: k, label: KIND_LABEL[k] }))} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
