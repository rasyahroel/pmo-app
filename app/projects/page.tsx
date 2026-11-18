"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Tag, Progress, Typography, Space,
  Button, Modal, Form, Input, Select, Popconfirm, message,
} from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined } from "@ant-design/icons";
import DataTable from "@/components/common/DataTable";
import PageSkeleton from "@/components/layout/PageSkeleton";
import { projects as initialProjects, getProjectStatusColor, getPriorityColor, type Project, type ProjectStatus, type ProjectCategory, type ProjectPriority, type Phase } from "@/lib/mock-data";
import { useMasterLists } from "@/lib/master-store";

const { Text } = Typography;

// Field-field ini yang wajib diisi begitu project baru dibuat — sisanya
// (git repo, nomor CR/BR, status) baru relevan setelah datanya lengkap,
// jadi hanya muncul di form Ubah.
type FormValues = {
  name: string;
  directorate: string;
  subdirectorate: string;
  vendor?: string;
  category: ProjectCategory;
  priority: ProjectPriority;
  status?: ProjectStatus;
  gitRepo?: string;
  crNumber?: string;
  brNumber?: string;
};

function makeDefaultPhase(): Phase {
  const today = new Date();
  const target = new Date(today);
  target.setDate(target.getDate() + 90);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return {
    id: `ph-${Date.now()}`,
    name: "Fase 1",
    stage: "Dokumen",
    progressPercent: 0,
    documentProgress: 0,
    developmentProgress: 0,
    testingProgress: 0,
    documents: [],
    testStages: [],
    environments: [],
    migrations: [],
    dependencies: [],
    startDate: fmt(today),
    targetLiveDate: fmt(target),
  };
}

export default function ProjectsPage() {
  const { masterDirektorat, getSubditOptions, masterVendors, masterProjectCategories, masterProjectPriorities } = useMasterLists();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form] = Form.useForm<FormValues>();
  const directorateWatch = Form.useWatch("directorate", form);
  const isEditing = editingId !== null;

  function openCreate() {
    setEditingId(null);
    form.resetFields();
    setOpen(true);
  }

  function openEdit(p: Project) {
    setEditingId(p.id);
    form.setFieldsValue({
      name: p.name,
      directorate: p.directorate,
      subdirectorate: p.subdirectorate,
      vendor: p.vendor,
      category: p.category,
      priority: p.priority,
      status: p.status,
      gitRepo: p.gitRepo,
      crNumber: p.crNumber,
      brNumber: p.brNumber,
    });
    setOpen(true);
  }

  function handleDelete(id: string) {
    setProjects((prev) => prev.filter((p) => p.id !== id));
    message.success("Project dihapus.");
  }

  function handleSubmit() {
    form.validateFields().then((values) => {
      if (editingId === null) {
        const newProject: Project = {
          id: `prj-${Date.now()}`,
          name: values.name,
          directorate: values.directorate,
          subdirectorate: values.subdirectorate,
          vendor: values.vendor,
          category: values.category,
          priority: values.priority,
          status: "Active",
          gitRepo: "",
          pmo: [],
          developers: [],
          users: [],
          overallProgress: 0,
          holdHistory: [],
          poStatus: "Belum Ada",
          phases: [makeDefaultPhase()],
        };
        setProjects((prev) => [...prev, newProject]);
        message.success("Project ditambahkan dengan Fase 1. Lengkapi detailnya dari halaman project.");
      } else {
        setProjects((prev) =>
          prev.map((p) => (p.id === editingId ? { ...p, ...values } : p))
        );
        message.success("Project diperbarui.");
      }
      setOpen(false);
    });
  }

  return (
    <PageSkeleton path="/projects">
      <DataTable
        searchPlaceholder="Cari nama project, direktorat, subdit, nomor CR/BR, PMO, developer..."
        toolbar={
          <Button icon={<PlusOutlined />} type="primary" onClick={openCreate}>
            Tambah Project
          </Button>
        }
        rowKey="id"
        scroll={{ x: "max-content" }}
        dataSource={projects}
        defaultPageSize={10}
        onRow={(r) => ({
          onClick: () => router.push(`/projects/${r.id}`),
          style: { cursor: "pointer" },
        })}
        columns={[
          {
            title: "Project",
            dataIndex: "name",
            searchValue: (r) => [r.name, r.directorate, r.subdirectorate, r.crNumber ?? "", r.brNumber ?? ""].join(" "),
            render: (v, r) => (
              <div>
                <div style={{ fontWeight: 500 }}>{v}</div>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {r.directorate} · {r.subdirectorate}
                </Text>
              </div>
            ),
          },
          {
            title: "Status",
            dataIndex: "status",
            width: 100,
            filters: ["Active", "Hold", "Cancelled"].map((s) => ({ text: s, value: s })),
            onFilter: (value, r) => r.status === value,
            render: (v) => <Tag color={getProjectStatusColor(v)}>{v}</Tag>,
          },
          {
            title: "Priority",
            dataIndex: "priority",
            width: 100,
            filters: masterProjectPriorities.map((p) => ({ text: p, value: p })),
            onFilter: (value, r) => r.priority === value,
            sorter: (a, b) => {
              const order = { Rendah: 0, Sedang: 1, Tinggi: 2 };
              return order[a.priority] - order[b.priority];
            },
            render: (v) => <Tag color={getPriorityColor(v)}>{v}</Tag>,
          },
          {
            title: "PMO",
            width: 160,
            searchValue: (r) => r.pmo.map((m) => m.name).join(" "),
            render: (_, r) => r.pmo.map((m) => m.name).join(", ") || <Text type="secondary">-</Text>,
          },
          {
            title: "Developer",
            width: 200,
            searchValue: (r) => r.developers.map((m) => m.name).join(" "),
            render: (_, r) =>
              r.developers.map((m) => m.name).join(", ") || <Text type="secondary">-</Text>,
          },
          {
            title: "User",
            width: 160,
            searchValue: (r) => r.users.map((m) => m.name).join(" "),
            render: (_, r) => r.users.map((m) => m.name).join(", ") || <Text type="secondary">-</Text>,
          },
          {
            title: "Progress",
            dataIndex: "overallProgress",
            width: 140,
            searchable: false,
            render: (v) => <Progress percent={v} size="small" />,
          },
          {
            title: "Aksi",
            width: 130,
            render: (_, r) => (
              <Space onClick={(e) => e.stopPropagation()}>
                <Button size="small" icon={<EyeOutlined />} onClick={() => router.push(`/projects/${r.id}`)} />
                <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
                <Popconfirm
                  title="Hapus project ini?"
                  description="Semua fase, dokumen, dan task di dalamnya ikut terhapus."
                  onConfirm={() => handleDelete(r.id)}
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
        title={editingId === null ? "Tambah Project" : "Ubah Project"}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={handleSubmit}
        okText="Simpan"
        cancelText="Batal"
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="Nama Project" rules={[{ required: true, message: "Wajib diisi" }]}>
            <Input placeholder="mis. Aplikasi Approval Dokumen Internal" />
          </Form.Item>
          <Form.Item name="directorate" label="Direktorat Pengaju" rules={[{ required: true, message: "Wajib diisi" }]}>
            <Select
              options={masterDirektorat.map((d) => ({ label: d, value: d }))}
              onChange={() => form.setFieldsValue({ subdirectorate: undefined })}
            />
          </Form.Item>
          <Form.Item name="subdirectorate" label="Subdit Pengaju" rules={[{ required: true, message: "Wajib diisi" }]}>
            <Select
              placeholder={directorateWatch ? "Pilih subdit" : "Pilih direktorat dulu"}
              disabled={!directorateWatch}
              options={getSubditOptions(directorateWatch).map((s) => ({ label: s.subdirectorate, value: s.subdirectorate }))}
            />
          </Form.Item>
          <Form.Item name="category" label="Kategori" rules={[{ required: true, message: "Wajib diisi" }]}>
            <Select options={masterProjectCategories.map((c) => ({ label: c, value: c }))} />
          </Form.Item>
          <Form.Item name="priority" label="Priority" rules={[{ required: true, message: "Wajib diisi" }]}>
            <Select options={masterProjectPriorities.map((p) => ({ label: p, value: p }))} />
          </Form.Item>
          <Form.Item name="vendor" label="Vendor (opsional)">
            <Select allowClear options={masterVendors.map((v) => ({ label: v, value: v }))} placeholder="Belum tentu ada — bisa dikosongkan" />
          </Form.Item>

          {isEditing && (
            <>
              <Form.Item name="status" label="Status" rules={[{ required: true, message: "Wajib diisi" }]}>
                <Select
                  options={[
                    { label: "Active", value: "Active" },
                    { label: "Hold", value: "Hold" },
                    { label: "Cancelled", value: "Cancelled" },
                  ]}
                />
              </Form.Item>
              <Form.Item name="crNumber" label="Nomor CR">
                <Input placeholder="mis. CR-2026-0142 (isi begitu nomor sudah terbit)" />
              </Form.Item>
              <Form.Item name="brNumber" label="Nomor BR">
                <Input placeholder="mis. BR-2026-0087 (biasanya terbit lebih dulu)" />
              </Form.Item>
              <Form.Item name="gitRepo" label="Git Repository">
                <Input placeholder="mis. git.internal.co/nama-repo (isi begitu repo sudah dibuat)" />
              </Form.Item>
            </>
          )}
        </Form>
      </Modal>
    </PageSkeleton>
  );
}
