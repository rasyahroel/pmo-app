"use client";

import { useState } from "react";
import { App, Button, Form, Input, Modal, Popconfirm, Space, Switch, Tag, Tooltip, Typography } from "antd";
import { ArrowDownOutlined, ArrowUpOutlined, DeleteOutlined, EditOutlined, PlusOutlined } from "@ant-design/icons";
import DataTable from "@/components/common/DataTable";
import { useAuditStore } from "@/lib/audit-store";
import { useMasterStore, type TestTypeDef } from "@/lib/master-store";
import { gateOf } from "@/lib/test-logic";
import { useTestStore } from "@/lib/test-store";

const { Text } = Typography;

// Master "Jenis Testing". Urutan = urutan alur pengujian; dua saklar mengatur aturan yang
// ditegakkan di menu Pengujian (lihat lib/test-logic.ts).
export default function TestTypesCrud() {
  const { message } = App.useApp();
  const { testTypes, addTestType, updateTestType, deleteTestType, moveTestType } = useMasterStore();
  const { records } = useTestStore();
  const { addLog } = useAuditStore();
  const [editing, setEditing] = useState<TestTypeDef | "new" | null>(null);
  const [form] = Form.useForm<TestTypeDef>();

  const usage = (type: string) => records.filter((r) => r.type === type).length;
  const log = (type: string, field: string, o: string, n: string) =>
    addLog({ projectName: "Master Data", entity: `Master · Jenis Testing: ${type}`, field, oldValue: o, newValue: n });
  const yn = (v: boolean) => (v ? "Ya" : "Tidak");

  function openModal(t: TestTypeDef | "new") {
    form.setFieldsValue(t === "new" ? { type: "", requiresPrevious: false, allowParallel: false } : t);
    setEditing(t);
  }

  function submit() {
    form
      .validateFields()
      .then((v) => {
        const type = v.type.trim();
        if (editing === "new") {
          if (testTypes.some((t) => t.type.toLowerCase() === type.toLowerCase())) {
            form.setFields([{ name: "type", errors: ["Jenis testing sudah ada"] }]);
            return;
          }
          addTestType({ type, requiresPrevious: v.requiresPrevious, allowParallel: v.allowParallel });
          log(type, "Jenis Testing", "—", "Dibuat");
        } else if (editing) {
          updateTestType(editing.type, { requiresPrevious: v.requiresPrevious, allowParallel: v.allowParallel });
          if (editing.requiresPrevious !== v.requiresPrevious) log(editing.type, "Wajib menunggu sebelumnya", yn(editing.requiresPrevious), yn(v.requiresPrevious));
          if (editing.allowParallel !== v.allowParallel) log(editing.type, "Boleh paralel", yn(editing.allowParallel), yn(v.allowParallel));
        }
        message.success("Jenis testing disimpan.");
        setEditing(null);
      })
      .catch(() => undefined);
  }

  return (
    <div>
      <DataTable
        rowKey="type"
        dataSource={testTypes}
        pagination={false}
        searchPlaceholder="Cari jenis testing..."
        toolbar={
          <Space wrap>
            <Button icon={<PlusOutlined />} type="primary" onClick={() => openModal("new")}>
              Tambah Jenis Testing
            </Button>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Urutan di sini = urutan alur pengujian di menu Pengujian.
            </Text>
          </Space>
        }
        columns={[
          {
            title: "Urutan",
            width: 100,
            sortable: false,
            searchable: false,
            render: (_: unknown, r: TestTypeDef) => {
              const i = testTypes.findIndex((t) => t.type === r.type);
              return (
                <Space size={0}>
                  <Button size="small" type="text" icon={<ArrowUpOutlined />} aria-label="Naikkan" disabled={i === 0} onClick={() => moveTestType(r.type, -1)} />
                  <Button size="small" type="text" icon={<ArrowDownOutlined />} aria-label="Turunkan" disabled={i === testTypes.length - 1} onClick={() => moveTestType(r.type, 1)} />
                </Space>
              );
            },
          },
          { title: "Jenis", dataIndex: "type", width: 120, render: (v: string) => <Tag>{v}</Tag> },
          {
            title: "Wajib menunggu testing sebelumnya",
            dataIndex: "requiresPrevious",
            filters: [{ text: "Ya", value: true }, { text: "Tidak", value: false }],
            onFilter: (value, r) => r.requiresPrevious === value,
            searchable: false,
            render: (v: boolean, r: TestTypeDef) =>
              v ? (
                <Space size={6}>
                  <Tag color="gold">Ya</Tag>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {gateOf(testTypes, r.type) ? `menunggu ${gateOf(testTypes, r.type)} Passed` : "tidak ada pengantar di atasnya"}
                  </Text>
                </Space>
              ) : (
                <Tag>Tidak</Tag>
              ),
          },
          {
            title: "Boleh paralel",
            dataIndex: "allowParallel",
            filters: [{ text: "Ya", value: true }, { text: "Tidak", value: false }],
            onFilter: (value, r) => r.allowParallel === value,
            searchable: false,
            render: (v: boolean) => (v ? <Tag color="green">Ya</Tag> : <Tag>Tidak</Tag>),
          },
          { title: "Dipakai", width: 100, sortable: false, searchable: false, render: (_: unknown, r: TestTypeDef) => <Text type="secondary">{usage(r.type)} data</Text> },
          {
            title: "Aksi",
            width: 110,
            sortable: false,
            searchable: false,
            render: (_: unknown, r: TestTypeDef) => {
              const used = usage(r.type);
              return (
                <Space>
                  <Button size="small" icon={<EditOutlined />} aria-label="Ubah jenis testing" onClick={() => openModal(r)} />
                  {used > 0 ? (
                    <Tooltip title={`Masih dipakai ${used} data pengujian. Hapus datanya dulu.`}>
                      <Button size="small" danger icon={<DeleteOutlined />} aria-label="Hapus jenis testing" disabled />
                    </Tooltip>
                  ) : (
                    <Popconfirm
                      title="Hapus jenis testing ini?"
                      okText="Hapus"
                      cancelText="Batal"
                      okButtonProps={{ danger: true }}
                      onConfirm={() => {
                        deleteTestType(r.type);
                        log(r.type, "Jenis Testing", "Aktif", "Dihapus");
                        message.success("Jenis testing dihapus.");
                      }}
                    >
                      <Button size="small" danger icon={<DeleteOutlined />} aria-label="Hapus jenis testing" />
                    </Popconfirm>
                  )}
                </Space>
              );
            },
          },
        ]}
      />

      <Modal
        title={editing === "new" ? "Tambah Jenis Testing" : "Ubah Jenis Testing"}
        open={editing !== null}
        onCancel={() => setEditing(null)}
        onOk={submit}
        okText="Simpan"
        cancelText="Batal"
        destroyOnHidden
        forceRender
      >
        <Form form={form} name="test-type" layout="vertical">
          <Form.Item name="type" label="Nama Jenis" rules={[{ required: true, whitespace: true, message: "Wajib diisi" }]} extra={editing !== "new" ? "Nama tidak bisa diubah karena dipakai sebagai kunci data pengujian." : undefined}>
            <Input placeholder="mis. Regression" disabled={editing !== "new"} />
          </Form.Item>
          <Form.Item name="requiresPrevious" label="Wajib menunggu testing sebelumnya" valuePropName="checked" extra="Baru boleh dimulai setelah jenis pengantar di atasnya (yang tidak boleh paralel) berstatus Passed.">
            <Switch />
          </Form.Item>
          <Form.Item name="allowParallel" label="Boleh berjalan paralel" valuePropName="checked" extra="Dua pengujian hanya boleh On Going bersamaan bila keduanya boleh paralel.">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
