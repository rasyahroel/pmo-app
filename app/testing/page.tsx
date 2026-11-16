"use client";

import { useState } from "react";
import {
  Tag, Progress, Typography, Button, Modal, Form, Select,
  Input, Space, Popconfirm, message,
} from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";
import PageSkeleton from "@/components/layout/PageSkeleton";
import DataTable from "@/components/common/DataTable";
import { projects, getTestStatusColor, masterTestTypes, type TestType, type TestStatus } from "@/lib/mock-data";

const { Text } = Typography;

type Row = {
  key: string;
  projectId: string;
  phaseId: string;
  projectName: string;
  phaseName: string;
  type: TestType;
  status: TestStatus;
  progressPercent: number;
  pic: string;
};

const STATUS_OPTIONS: TestStatus[] = ["Not Started", "On Going", "Passed", "Failed"];

const initialRows: Row[] = projects.flatMap((p) =>
  p.phases.flatMap((ph) =>
    ph.testStages.map((t) => ({
      key: t.id,
      projectId: p.id,
      phaseId: ph.id,
      projectName: p.name,
      phaseName: ph.name,
      type: t.type,
      status: t.status,
      progressPercent: t.progressPercent,
      pic: t.pic,
    }))
  )
);

type FormValues = {
  projectId: string;
  phaseId: string;
  type: TestType;
  status: TestStatus;
  progressPercent: number;
  pic: string;
};

export default function TestingPage() {
  const [rows, setRows] = useState<Row[]>(initialRows);
  const [open, setOpen] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [form] = Form.useForm<FormValues>();
  const selectedProjectId = Form.useWatch("projectId", form);

  function openCreate() {
    setEditingKey(null);
    form.resetFields();
    setOpen(true);
  }

  function openEdit(r: Row) {
    setEditingKey(r.key);
    form.setFieldsValue({
      projectId: r.projectId,
      phaseId: r.phaseId,
      type: r.type,
      status: r.status,
      progressPercent: r.progressPercent,
      pic: r.pic,
    });
    setOpen(true);
  }

  function handleDelete(key: string) {
    setRows((prev) => prev.filter((r) => r.key !== key));
    message.success("Data pengujian dihapus.");
  }

  function handleSubmit() {
    form.validateFields().then((values) => {
      const project = projects.find((p) => p.id === values.projectId);
      const phase = project?.phases.find((ph) => ph.id === values.phaseId);
      const base = {
        projectId: values.projectId,
        phaseId: values.phaseId,
        projectName: project?.name ?? "-",
        phaseName: phase?.name ?? "-",
        type: values.type,
        status: values.status,
        progressPercent: values.progressPercent,
        pic: values.pic,
      };
      if (editingKey === null) {
        setRows((prev) => [...prev, { key: `ts-${Date.now()}`, ...base }]);
        message.success("Data pengujian ditambahkan.");
      } else {
        setRows((prev) => prev.map((r) => (r.key === editingKey ? { ...r, ...base } : r)));
        message.success("Data pengujian diperbarui.");
      }
      setOpen(false);
    });
  }

  const phaseOptions = projects.find((p) => p.id === selectedProjectId)?.phases ?? [];

  return (
    <PageSkeleton path="/testing">
      <DataTable
        rowKey="key"
        scroll={{ x: "max-content" }}
        dataSource={rows}
        searchPlaceholder="Cari project, fase, jenis testing, PIC..."
        toolbar={
          <Button icon={<PlusOutlined />} type="primary" onClick={openCreate}>
            Tambah Pengujian
          </Button>
        }
        columns={[
          {
            title: "Project / Fase",
            dataIndex: "projectName",
            searchValue: (r) => `${r.projectName} ${r.phaseName}`,
            render: (_, r) => (
              <div>
                <div style={{ fontWeight: 500 }}>{r.projectName}</div>
                <Text type="secondary" style={{ fontSize: 12 }}>{r.phaseName}</Text>
              </div>
            ),
          },
          { title: "Jenis Testing", dataIndex: "type", width: 130, filterable: true, render: (v) => <Tag>{v}</Tag> },
          {
            title: "Status",
            dataIndex: "status",
            width: 130,
            filterable: true,
            render: (v) => <Tag color={getTestStatusColor(v)}>{v}</Tag>,
          },
          {
            title: "Progress",
            dataIndex: "progressPercent",
            width: 160,
            searchable: false,
            render: (v) => <Progress percent={v} size="small" />,
          },
          { title: "PIC", dataIndex: "pic", width: 160, filterable: true },
          {
            title: "Aksi",
            width: 100,
            render: (_, r) => (
              <Space>
                <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
                <Popconfirm title="Hapus data pengujian ini?" onConfirm={() => handleDelete(r.key)} okText="Hapus" cancelText="Batal">
                  <Button size="small" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />

      <Modal
        title={editingKey === null ? "Tambah Pengujian" : "Ubah Pengujian"}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={handleSubmit}
        okText="Simpan"
        cancelText="Batal"
      >
        <Form form={form} layout="vertical">
          <Form.Item name="projectId" label="Project" rules={[{ required: true, message: "Wajib diisi" }]}>
            <Select
              options={projects.map((p) => ({ label: p.name, value: p.id }))}
              onChange={() => form.setFieldValue("phaseId", undefined)}
            />
          </Form.Item>
          <Form.Item name="phaseId" label="Fase" rules={[{ required: true, message: "Wajib diisi" }]}>
            <Select options={phaseOptions.map((ph) => ({ label: ph.name, value: ph.id }))} />
          </Form.Item>
          <Form.Item name="type" label="Jenis Testing" rules={[{ required: true, message: "Wajib diisi" }]}>
            <Select options={masterTestTypes.map((t) => ({ label: t.type, value: t.type }))} />
          </Form.Item>
          <Form.Item name="status" label="Status" rules={[{ required: true, message: "Wajib diisi" }]} initialValue="Not Started">
            <Select options={STATUS_OPTIONS.map((s) => ({ label: s, value: s }))} />
          </Form.Item>
          <Form.Item name="progressPercent" label="Progress (%)" rules={[{ required: true, message: "Wajib diisi" }]} initialValue={0}>
            <Input type="number" min={0} max={100} />
          </Form.Item>
          <Form.Item name="pic" label="PIC" rules={[{ required: true, message: "Wajib diisi" }]}>
            <Input placeholder="Nama PIC" />
          </Form.Item>
        </Form>
      </Modal>
    </PageSkeleton>
  );
}
