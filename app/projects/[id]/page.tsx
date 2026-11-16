"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Typography, Tag, Progress, Card, Tabs, Table, Space,
  Button, Empty, Avatar, Modal, Form, Select, Input, Switch, DatePicker,
  Timeline, Popconfirm, message, Row, Col, Statistic, Upload,
  type TableColumnsType,
} from "antd";
import {
  ArrowLeftOutlined, GithubOutlined, UserOutlined, PauseCircleOutlined,
  PlayCircleOutlined, LinkOutlined, FileTextOutlined, PlusOutlined,
  EditOutlined, DeleteOutlined, CheckCircleFilled, UploadOutlined,
  DatabaseOutlined, CloudServerOutlined, DesktopOutlined, LockOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import DataTable from "@/components/common/DataTable";
import ErrorState from "@/components/common/ErrorState";
import ProjectTasksPanel from "@/components/tasks/ProjectTasksPanel";
import {
  getProjectById,
  meetings as allMeetings,
  auditLogs,
  employees,
  masterDocumentTypes,
  masterDirektorat,
  getSubditOptions,
  masterVendors,
  masterProjectCategories,
  masterProjectPriorities,
  masterDependencySystems,
  masterApprovalLevels,
  getProjectStatusColor,
  getDocStatusColor,
  getApprovalStatusColor,
  getMigrationStatusColor,
  getReportStatusColor,
  getTestStatusColor,
  getCategoryColor,
  getPriorityColor,
  type ProjectStatus,
  type ProjectCategory,
  type ProjectPriority,
  type Phase,
  type DocumentItem,
  type Approver,
  type EnvironmentItem,
  type EnvironmentCategory,
  type MigrationRecon,
  type Dependency,
  type Member,
  type DocType,
  type DocStatus,
} from "@/lib/mock-data";
import { agi } from "@/app/providers";

const { Title, Text, Paragraph } = Typography;

// Grid label/value yang rapi & konsisten untuk kartu-kartu detail (mengganti
// antd <Descriptions>, yang label & isinya suka nggak sejajar kalau panjang
// kontennya beda-beda antar baris/kartu). Kolom otomatis menyesuaikan lebar
// kartu (auto-fit), jadi tetap rapi baik di kartu lebar maupun sempit.
type DetailField = { label: string; value: ReactNode; full?: boolean };

function DetailGrid({
  items,
  minColWidth = 190,
  columnGap = 24,
  rowGap = 16,
}: {
  items: DetailField[];
  minColWidth?: number;
  columnGap?: number;
  rowGap?: number;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(auto-fit, minmax(${minColWidth}px, 1fr))`,
        columnGap,
        rowGap,
      }}
    >
      {items.map((it, i) => (
        <div
          key={i}
          style={{ gridColumn: it.full ? "1 / -1" : undefined, minWidth: 0 }}
        >
          <Text
            type="secondary"
            style={{ display: "block", fontSize: 12, lineHeight: "18px", marginBottom: 4 }}
          >
            {it.label}
          </Text>
          <div style={{ fontSize: 14, lineHeight: "20px", wordBreak: "break-word" }}>
            {it.value}
          </div>
        </div>
      ))}
    </div>
  );
}

type TeamRole = "PMO" | "Developer" | "User";

function MemberGroup({
  title, role, members, onAdd, onEdit, onDelete,
}: {
  title: string;
  role: TeamRole;
  members: Member[];
  onAdd: () => void;
  onEdit: (m: Member) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>{title}</Text>
        <Button size="small" type="text" icon={<PlusOutlined />} onClick={onAdd}>Tambah</Button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {members.length === 0 && <Text type="secondary">Belum ada {role.toLowerCase()}.</Text>}
        {members.map((m) => (
          <Space key={m.id} size={8} align="start" style={{ width: "100%" }}>
            <Avatar size={24} icon={<UserOutlined />} style={{ background: agi[200], color: agi[800], flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div>
                <Text>{m.name}</Text>{" "}
                {m.isPrimary && <Tag color="blue" style={{ marginInlineStart: 4 }}>PIC Utama</Tag>}
                {m.isVendor && <Tag color="orange" style={{ marginInlineStart: 4 }}>Vendor</Tag>}
              </div>
              {(m.directorate || m.subdirectorate) && (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {[m.directorate, m.subdirectorate].filter(Boolean).join(" · ")}
                </Text>
              )}
            </div>
            <Space size={0}>
              <Button size="small" type="text" icon={<EditOutlined />} onClick={() => onEdit(m)} />
              <Popconfirm title="Hapus anggota ini?" onConfirm={() => onDelete(m.id)} okText="Hapus" cancelText="Batal">
                <Button size="small" type="text" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            </Space>
          </Space>
        ))}
      </div>
    </div>
  );
}

// Modal tambah/ubah anggota tim. PMO & Developer internal dipilih dari master
// pegawai (employees); Developer vendor & User diinput manual — vendor cuma
// butuh nama, field direktorat/subdit di-hide (tapi tetap ada di skema Member).
type MemberFormValues = {
  source: "internal" | "manual";
  employeeId?: string;
  name?: string;
  isPrimary: boolean;
  directorate?: string;
  subdirectorate?: string;
};

function MemberModal({
  open, role, initial, onCancel, onSubmit,
}: {
  open: boolean;
  role: TeamRole | null;
  initial: Member | null;
  onCancel: () => void;
  onSubmit: (values: MemberFormValues) => void;
}) {
  const [form] = Form.useForm<MemberFormValues>();

  useEffect(() => {
    if (!open || !role) return;
    if (initial) {
      form.setFieldsValue({
        source: initial.isVendor || role === "User" ? "manual" : "internal",
        employeeId: initial.employeeId,
        name: initial.name,
        isPrimary: initial.isPrimary,
        directorate: initial.directorate,
        subdirectorate: initial.subdirectorate,
      });
    } else {
      form.resetFields();
      form.setFieldsValue({ source: role === "User" ? "manual" : "internal", isPrimary: false });
    }
  }, [open, initial, role, form]);

  const source = Form.useWatch("source", form);
  const isManual = role === "User" || source === "manual";
  const roleUsers = role ? employees.filter((u) => u.roles.includes(role)) : [];
  const memberDirectorate = Form.useWatch("directorate", form);

  return (
    <Modal
      title={initial ? `Ubah ${role}` : `Tambah ${role}`}
      open={open}
      onCancel={onCancel}
      onOk={() => form.validateFields().then(onSubmit)}
      okText="Simpan"
      cancelText="Batal"
      destroyOnHidden
      width={520}
    >
      <Form form={form} layout="vertical">
        {role === "Developer" && (
          <Form.Item name="source" label="Sumber Developer">
            <Select
              options={[
                { label: "Pegawai Internal (dari master)", value: "internal" },
                { label: "Vendor (input manual)", value: "manual" },
              ]}
            />
          </Form.Item>
        )}
        {!isManual ? (
          <Form.Item name="employeeId" label="Pilih Pegawai" rules={[{ required: true, message: "Wajib diisi" }]}>
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="Cari nama pegawai"
              options={roleUsers.map((u) => ({ label: `${u.name} — ${u.directorate} · ${u.subdirectorate}`, value: u.id }))}
              notFoundContent="Tidak ada pegawai dengan role ini di master."
              onChange={(id) => {
                const u = employees.find((x) => x.id === id);
                if (u) form.setFieldsValue({ name: u.name, directorate: u.directorate, subdirectorate: u.subdirectorate });
              }}
            />
          </Form.Item>
        ) : (
          <Form.Item name="name" label="Nama" rules={[{ required: true, message: "Wajib diisi" }]}>
            <Input placeholder={role === "Developer" ? "Nama developer dari vendor" : "Nama user"} />
          </Form.Item>
        )}
        <Form.Item name="isPrimary" label="PIC Utama?" valuePropName="checked">
          <Switch />
        </Form.Item>
        {!(role === "Developer" && isManual) && (
          <Row gutter={12}>
            <Col xs={24} sm={12}>
              <Form.Item name="directorate" label="Direktorat">
                <Select
                  allowClear
                  options={masterDirektorat.map((d) => ({ label: d, value: d }))}
                  onChange={() => form.setFieldsValue({ subdirectorate: undefined })}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="subdirectorate" label="Subdit">
                <Select
                  allowClear
                  placeholder={memberDirectorate ? "Pilih subdit" : "Pilih direktorat dulu"}
                  disabled={!memberDirectorate}
                  options={getSubditOptions(memberDirectorate).map((s) => ({ label: s.subdirectorate, value: s.subdirectorate }))}
                />
              </Form.Item>
            </Col>
          </Row>
        )}
        {role === "Developer" && isManual && (
          <Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 0 }}>
            Developer vendor cukup diisi nama — direktorat/subdit disembunyikan karena tidak relevan.
          </Paragraph>
        )}
      </Form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Fase — kartu ringkas + tombol Ubah untuk field dasar (nama/tahap/tanggal)
// ---------------------------------------------------------------------------

const PHASE_STAGE_COLOR: Record<Phase["stage"], string> = {
  Dokumen: "default",
  Development: "blue",
  Testing: "gold",
  Live: "green",
};

function PhaseCard({ phase, allPhases, onEdit }: { phase: Phase; allPhases: Phase[]; onEdit: () => void }) {
  const previous = phase.previousPhaseId
    ? allPhases.find((p) => p.id === phase.previousPhaseId)
    : undefined;

  return (
    <Card
      size="small"
      title={
        <Space wrap>
          <Text strong>{phase.name}</Text>
          <Tag color={PHASE_STAGE_COLOR[phase.stage]}>{phase.stage}</Tag>
          <Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>
            {phase.startDate} → {phase.targetLiveDate}
          </Text>
          {previous && (
            <Tag color="purple">Rujukan: dokumen {previous.name}</Tag>
          )}
        </Space>
      }
      extra={<Button size="small" icon={<EditOutlined />} onClick={onEdit}>Ubah</Button>}
    >
      {((phase.scope && phase.scope.length > 0) || phase.note) && (
        <div style={{ marginBottom: 16, background: agi[50], border: `1px solid ${agi[100]}`, borderRadius: 8, padding: "10px 12px" }}>
          {phase.scope && phase.scope.length > 0 && (
            <div style={{ marginBottom: phase.note ? 8 : 0 }}>
              <Text strong style={{ fontSize: 13 }}>Scope:</Text>
              <ul style={{ margin: "4px 0 0", paddingInlineStart: 20 }}>
                {phase.scope.map((s, i) => (
                  <li key={i} style={{ fontSize: 13 }}>{s}</li>
                ))}
              </ul>
            </div>
          )}
          {phase.note && (
            <Paragraph type="secondary" style={{ marginBottom: 0, fontSize: 12 }}>
              <Text strong>Catatan: </Text>{phase.note}
            </Paragraph>
          )}
        </div>
      )}
      <div style={{ marginBottom: 16 }}>
        <DetailGrid
          minColWidth={160}
          items={[
            { label: "Progress Dokumen", value: <Progress percent={phase.documentProgress} size="small" /> },
            { label: "Progress Development", value: <Progress percent={phase.developmentProgress} size="small" /> },
            { label: "Progress Testing", value: <Progress percent={phase.testingProgress} size="small" /> },
          ]}
        />
      </div>

      <Text strong style={{ fontSize: 13 }}>Pengujian</Text>
      <div style={{ margin: "8px 0 0", display: "flex", gap: 8, flexWrap: "wrap" }}>
        {phase.testStages.length === 0 && <Text type="secondary">Belum ada pengujian.</Text>}
        {phase.testStages.map((t) => (
          <Tag key={t.id} color={getTestStatusColor(t.status)}>
            {t.type} · {t.status} ({t.progressPercent}%) — PIC {t.pic}
          </Tag>
        ))}
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Git & Environment
// ---------------------------------------------------------------------------

const ENV_CATEGORY_OPTIONS: EnvironmentCategory[] = [
  "Git Repository", "Local Developer", "Staging", "Production", "Database", "SSH", "User",
];

const ENV_CATEGORY_ICON: Record<EnvironmentCategory, ReactNode> = {
  "Git Repository": <GithubOutlined />,
  "Local Developer": <DesktopOutlined />,
  "Staging": <CloudServerOutlined />,
  "Production": <CloudServerOutlined />,
  "Database": <DatabaseOutlined />,
  "SSH": <LockOutlined />,
  "User": <TeamOutlined />,
};

const ENV_CATEGORY_ORDER: EnvironmentCategory[] = [
  "Git Repository", "Local Developer", "Staging", "Database", "SSH", "Production", "User",
];

// Field mana yang relevan per kategori — nentuin field apa yang dirender di
// form tambah/ubah, dan gimana entrinya ditampilkan.
const ENV_FIELD_VISIBILITY: Record<EnvironmentCategory, {
  port: boolean; segment: boolean; git: boolean; dns: boolean; dbName: boolean; containerName: boolean; specs: boolean;
}> = {
  // DNS itu domain publik project (kalau udah live) — punya di Staging/Production,
  // bukan per repo git. Repo git tetep punya branch/template sendiri.
  // "specs" (CPU/Memory/Storage + spesifikasi tambahan) relevan buat kategori
  // yang mewakili server fisik/VM sungguhan.
  "Git Repository": { port: false, segment: false, git: true, dns: false, dbName: false, containerName: false, specs: false },
  "Local Developer": { port: false, segment: true, git: false, dns: false, dbName: false, containerName: false, specs: false },
  "Staging": { port: true, segment: false, git: false, dns: true, dbName: false, containerName: false, specs: true },
  "Production": { port: true, segment: false, git: false, dns: true, dbName: false, containerName: false, specs: true },
  "Database": { port: true, segment: false, git: false, dns: false, dbName: true, containerName: false, specs: true },
  "SSH": { port: true, segment: false, git: false, dns: false, dbName: false, containerName: true, specs: true },
  "User": { port: false, segment: true, git: false, dns: false, dbName: false, containerName: false, specs: false },
};

type EnvFormValues = Omit<EnvironmentItem, "id">;

function EnvironmentModal({
  open, initial, onCancel, onSubmit,
}: {
  open: boolean;
  initial: EnvironmentItem | null;
  onCancel: () => void;
  onSubmit: (values: EnvFormValues) => void;
}) {
  const [form] = Form.useForm<EnvFormValues>();

  useEffect(() => {
    if (open) form.setFieldsValue(initial ?? ({ category: "Staging" } as EnvFormValues));
  }, [open, initial, form]);

  const category = Form.useWatch("category", form) as EnvironmentCategory | undefined;
  const vis = ENV_FIELD_VISIBILITY[category ?? "Staging"];

  return (
    <Modal
      title={initial ? "Ubah Environment" : "Tambah Environment"}
      open={open}
      onCancel={onCancel}
      onOk={() => form.validateFields().then(onSubmit)}
      okText="Simpan"
      cancelText="Batal"
      destroyOnHidden
      width={640}
    >
      <Form form={form} layout="vertical">
        <Row gutter={12}>
          <Col xs={24} sm={12}>
            <Form.Item name="category" label="Kategori" rules={[{ required: true, message: "Wajib diisi" }]}>
              <Select options={ENV_CATEGORY_OPTIONS.map((c) => ({ label: c, value: c }))} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item name="label" label="Label / Nama" rules={[{ required: true, message: "Wajib diisi" }]}>
              <Input placeholder="mis. nama developer/user, lokasi, nama modul/repo, nama DB" />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={12}>
          <Col xs={24} sm={vis.port ? 12 : 24}>
            <Form.Item
              name="value"
              label={category === "Git Repository" ? "URL Repo" : "IP / Host"}
              rules={[{ required: true, message: "Wajib diisi" }]}
            >
              <Input placeholder={category === "Git Repository" ? "git.internal.co/nama-repo" : "mis. 10.20.14.31"} />
            </Form.Item>
          </Col>
          {vis.port && (
            <Col xs={24} sm={12}>
              <Form.Item name="port" label="Port">
                <Input placeholder="mis. 8080" />
              </Form.Item>
            </Col>
          )}
        </Row>
        {(vis.dns || vis.segment) && (
          <Row gutter={12}>
            {vis.dns && (
              <Col xs={24} sm={vis.segment ? 12 : 24}>
                <Form.Item name="dns" label="DNS (kalau environment ini sudah bisa diakses online/live)">
                  <Input placeholder="mis. corebanking-stg.internal.co" />
                </Form.Item>
              </Col>
            )}
            {vis.segment && (
              <Col xs={24} sm={vis.dns ? 12 : 24}>
                <Form.Item name="segment" label="Segmen / Lokasi IP">
                  <Input placeholder="mis. Kwitang, Cokro — kalau beda lokasi" />
                </Form.Item>
              </Col>
            )}
          </Row>
        )}
        {vis.git && (
          <Row gutter={12}>
            <Col xs={24} sm={12}>
              <Form.Item name="mainBranch" label="Branch Utama">
                <Input placeholder="mis. main" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="isTemplate" label="Repo template?" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
          </Row>
        )}
        {(vis.dbName || vis.containerName) && (
          <Row gutter={12}>
            {vis.dbName && (
              <Col xs={24} sm={vis.containerName ? 12 : 24}>
                <Form.Item name="dbName" label="Nama Database">
                  <Input placeholder="mis. corebanking_stg" />
                </Form.Item>
              </Col>
            )}
            {vis.containerName && (
              <Col xs={24} sm={vis.dbName ? 12 : 24}>
                <Form.Item name="containerName" label="Nama/ID Container (kalau pakai Docker)">
                  <Input placeholder="mis. corebanking-api-stg" />
                </Form.Item>
              </Col>
            )}
          </Row>
        )}
        {vis.specs && (
          <>
            <Row gutter={12}>
              <Col xs={24} sm={8}>
                <Form.Item name="cpu" label="CPU">
                  <Input placeholder="mis. 4 vCPU" />
                </Form.Item>
              </Col>
              <Col xs={24} sm={8}>
                <Form.Item name="memory" label="Memory">
                  <Input placeholder="mis. 8 GB" />
                </Form.Item>
              </Col>
              <Col xs={24} sm={8}>
                <Form.Item name="storage" label="Storage">
                  <Input placeholder="mis. 100 GB SSD" />
                </Form.Item>
              </Col>
            </Row>
            <Form.List name="extraSpecs">
              {(fields, { add, remove }) => (
                <div style={{ marginBottom: 16 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>Spesifikasi Lainnya (opsional)</Text>
                  {fields.map(({ key, name, ...restField }) => (
                    <Row gutter={8} key={key} align="middle" style={{ marginTop: 8 }}>
                      <Col flex="auto">
                        <Form.Item {...restField} name={[name, "label"]} rules={[{ required: true, message: "Wajib diisi" }]} noStyle>
                          <Input placeholder="Label, mis. OS" />
                        </Form.Item>
                      </Col>
                      <Col flex="auto">
                        <Form.Item {...restField} name={[name, "value"]} rules={[{ required: true, message: "Wajib diisi" }]} noStyle>
                          <Input placeholder="Value" />
                        </Form.Item>
                      </Col>
                      <Col>
                        <Button type="text" danger icon={<DeleteOutlined />} onClick={() => remove(name)} />
                      </Col>
                    </Row>
                  ))}
                  <Button type="dashed" icon={<PlusOutlined />} onClick={() => add()} block style={{ marginTop: 8 }}>
                    Tambah Lainnya
                  </Button>
                </div>
              )}
            </Form.List>
          </>
        )}
        <Form.Item name="note" label="Catatan">
          <Input.TextArea rows={2} />
        </Form.Item>
      </Form>
    </Modal>
  );
}

function EnvironmentSection({
  phase, onAdd, onEdit, onDelete,
}: {
  phase: Phase;
  onAdd: () => void;
  onEdit: (item: EnvironmentItem) => void;
  onDelete: (id: string) => void;
}) {
  const grouped = ENV_CATEGORY_ORDER.map((cat) => ({
    category: cat,
    items: phase.environments.filter((e) => e.category === cat),
  })).filter((g) => g.items.length > 0);

  return (
    <Card
      size="small"
      title={`Environment — ${phase.name}`}
      extra={<Button size="small" icon={<PlusOutlined />} onClick={onAdd}>Tambah</Button>}
    >
      {grouped.length === 0 ? (
        <Empty description="Belum ada environment untuk fase ini." image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {grouped.map((g) => {
            const vis = ENV_FIELD_VISIBILITY[g.category];
            const columns: TableColumnsType<EnvironmentItem> = [
              {
                title: "Label",
                dataIndex: "label",
                render: (v, e) => (
                  <Space orientation="vertical" size={2}>
                    <Text strong style={{ fontSize: 13 }}>
                      {v}{e.segment ? ` · ${e.segment}` : ""}
                    </Text>
                    {e.isTemplate && <Tag color="purple" style={{ fontSize: 11 }}>Template</Tag>}
                  </Space>
                ),
              },
              {
                title: g.category === "Git Repository" ? "URL Repo" : "IP / Host",
                dataIndex: "value",
                render: (v, e) => <Text code style={{ fontSize: 12 }}>{v}{e.port ? `:${e.port}` : ""}</Text>,
              },
              ...(vis.git ? [{
                title: "Branch", dataIndex: "mainBranch", width: 110,
                render: (v: string) => (v ? <Tag style={{ fontSize: 11 }}>{v}</Tag> : <Text type="secondary">-</Text>),
              }] : []),
              ...(vis.dns ? [{
                title: "DNS", dataIndex: "dns", width: 190,
                render: (v: string) => (v ? <Tag color="cyan" style={{ fontSize: 11 }}>{v}</Tag> : <Text type="secondary">-</Text>),
              }] : []),
              ...(vis.dbName ? [{
                title: "Database", dataIndex: "dbName", width: 150,
                render: (v: string) => (v ? <Tag style={{ fontSize: 11 }}>{v}</Tag> : <Text type="secondary">-</Text>),
              }] : []),
              ...(vis.containerName ? [{
                title: "Container", dataIndex: "containerName", width: 170,
                render: (v: string) => (v ? <Tag style={{ fontSize: 11 }}>{v}</Tag> : <Text type="secondary">-</Text>),
              }] : []),
              ...(vis.specs ? [{
                title: "Spesifikasi", width: 220,
                render: (_: unknown, e: EnvironmentItem) => {
                  const specs = [
                    ...(e.cpu ? [{ id: "cpu", label: "CPU", value: e.cpu }] : []),
                    ...(e.memory ? [{ id: "mem", label: "Memory", value: e.memory }] : []),
                    ...(e.storage ? [{ id: "sto", label: "Storage", value: e.storage }] : []),
                    ...(e.extraSpecs ?? []),
                  ];
                  if (specs.length === 0) return <Text type="secondary">-</Text>;
                  return (
                    <Space size={4} wrap>
                      {specs.map((s) => <Tag key={s.id} style={{ fontSize: 11 }}>{s.label}: {s.value}</Tag>)}
                    </Space>
                  );
                },
              }] : []),
              {
                title: "Catatan", dataIndex: "note",
                render: (v: string) => (v ? <Text type="secondary" style={{ fontSize: 12 }}>{v}</Text> : <Text type="secondary">-</Text>),
              },
              {
                title: "", width: 70, fixed: "right" as const,
                render: (_: unknown, e: EnvironmentItem) => (
                  <Space size={0}>
                    <Button size="small" type="text" icon={<EditOutlined />} onClick={() => onEdit(e)} />
                    <Popconfirm title="Hapus entri ini?" onConfirm={() => onDelete(e.id)} okText="Hapus" cancelText="Batal">
                      <Button size="small" type="text" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                  </Space>
                ),
              },
            ];
            return (
              <div key={g.category}>
                <Space size={6} style={{ marginBottom: 8 }}>
                  {ENV_CATEGORY_ICON[g.category]}
                  <Text strong style={{ fontSize: 13 }}>{g.category}</Text>
                  <Tag style={{ fontSize: 11 }}>{g.items.length}</Tag>
                </Space>
                <Table
                  rowKey="id"
                  size="small"
                  pagination={false}
                  columns={columns}
                  dataSource={g.items}
                  scroll={{ x: "max-content" }}
                />
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Dependency — sistem lain yang terhubung ke fase ini (Axway/Fiorano/Big
// Data/dst), lengkap dengan endpoint/IP tujuannya (bisa lebih dari satu).
// ---------------------------------------------------------------------------

type DependencyFormValues = {
  system: string;
  customSystemName?: string;
  serviceName?: string;
  description: string;
  endpoints: { label: string; value: string; note?: string }[];
};

function DependencyModal({
  open, initial, onCancel, onSubmit,
}: {
  open: boolean;
  initial: Dependency | null;
  onCancel: () => void;
  onSubmit: (values: DependencyFormValues) => void;
}) {
  const [form] = Form.useForm<DependencyFormValues>();

  useEffect(() => {
    if (!open) return;
    if (initial) {
      form.setFieldsValue({
        system: initial.system,
        customSystemName: initial.customSystemName,
        serviceName: initial.serviceName,
        description: initial.description,
        endpoints: initial.endpoints,
      });
    } else {
      form.setFieldsValue({
        system: masterDependencySystems[0],
        customSystemName: undefined,
        serviceName: undefined,
        description: "",
        endpoints: [{ label: "", value: "" }],
      });
    }
  }, [open, initial, form]);

  const system = Form.useWatch("system", form);

  return (
    <Modal
      title={initial ? "Ubah Dependency" : "Tambah Dependency"}
      open={open}
      onCancel={onCancel}
      onOk={() => form.validateFields().then(onSubmit)}
      okText="Simpan"
      cancelText="Batal"
      destroyOnHidden
      width={680}
    >
      <Form form={form} layout="vertical">
        <Row gutter={12}>
          <Col xs={24} sm={system === "Lainnya" ? 12 : 24}>
            <Form.Item name="system" label="Terhubung ke Sistem" rules={[{ required: true, message: "Wajib diisi" }]}>
              <Select options={masterDependencySystems.map((s) => ({ label: s, value: s }))} />
            </Form.Item>
          </Col>
          {system === "Lainnya" && (
            <Col xs={24} sm={12}>
              <Form.Item name="customSystemName" label="Nama Sistem" rules={[{ required: true, message: "Wajib diisi" }]}>
                <Input placeholder="mis. Core HR" />
              </Form.Item>
            </Col>
          )}
        </Row>
        <Form.Item name="serviceName" label="Nama Service/Layanan yang Dipakai (opsional)">
          <Input placeholder="mis. Transfer Antar Bank (RTGS/SKN), Inquiry Saldo, dll" />
        </Form.Item>
        <Form.Item name="description" label="Penjelasan Koneksi" rules={[{ required: true, message: "Wajib diisi" }]}>
          <Input.TextArea rows={2} placeholder="Kebutuhan/tujuan koneksi ke sistem ini" />
        </Form.Item>
        <Form.List name="endpoints">
          {(fields, { add, remove }) => (
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>Endpoint / IP Tujuan</Text>
              {fields.map(({ key, name, ...restField }) => (
                <Row gutter={8} key={key} align="middle" style={{ marginTop: 8 }}>
                  <Col flex="140px">
                    <Form.Item {...restField} name={[name, "label"]} rules={[{ required: true, message: "Wajib diisi" }]} noStyle>
                      <Input placeholder="Label" />
                    </Form.Item>
                  </Col>
                  <Col flex="auto">
                    <Form.Item {...restField} name={[name, "value"]} rules={[{ required: true, message: "Wajib diisi" }]} noStyle>
                      <Input placeholder="IP / host / URL" />
                    </Form.Item>
                  </Col>
                  <Col flex="160px">
                    <Form.Item {...restField} name={[name, "note"]} noStyle>
                      <Input placeholder="Catatan (opsional)" />
                    </Form.Item>
                  </Col>
                  <Col>
                    <Button type="text" danger icon={<DeleteOutlined />} onClick={() => remove(name)} />
                  </Col>
                </Row>
              ))}
              <Button type="dashed" icon={<PlusOutlined />} onClick={() => add()} block style={{ marginTop: 8 }}>
                Tambah Endpoint
              </Button>
            </div>
          )}
        </Form.List>
      </Form>
    </Modal>
  );
}

function DependencySection({
  phase, onAdd, onEdit, onDelete,
}: {
  phase: Phase;
  onAdd: () => void;
  onEdit: (d: Dependency) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <Card
      size="small"
      title={`Dependency / Ketergantungan Sistem — ${phase.name}`}
      extra={<Button size="small" icon={<PlusOutlined />} onClick={onAdd}>Tambah</Button>}
    >
      {phase.dependencies.length === 0 ? (
        <Empty description="Belum ada dependency ke sistem lain untuk fase ini." image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {phase.dependencies.map((d) => (
            <Card
              key={d.id}
              type="inner"
              size="small"
              title={
                <Space size={8} wrap>
                  <Tag color="geekblue" style={{ fontSize: 12, marginInlineEnd: 0 }}>{d.system === "Lainnya" ? d.customSystemName : d.system}</Tag>
                  {d.serviceName && <Text strong style={{ fontSize: 13 }}>{d.serviceName}</Text>}
                </Space>
              }
              extra={
                <Space size={0}>
                  <Button size="small" type="text" icon={<EditOutlined />} onClick={() => onEdit(d)} />
                  <Popconfirm title="Hapus dependency ini?" onConfirm={() => onDelete(d.id)} okText="Hapus" cancelText="Batal">
                    <Button size="small" type="text" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                </Space>
              }
            >
              <Paragraph style={{ marginBottom: 10, fontSize: 13 }}>{d.description}</Paragraph>
              <Table
                rowKey="id"
                size="small"
                pagination={false}
                dataSource={d.endpoints}
                columns={[
                  { title: "Endpoint", dataIndex: "label", width: 200 },
                  { title: "Alamat", dataIndex: "value", render: (v: string) => <Text code style={{ fontSize: 12 }}>{v}</Text> },
                  {
                    title: "Catatan", dataIndex: "note",
                    render: (v: string) => (v ? <Text type="secondary" style={{ fontSize: 12 }}>{v}</Text> : <Text type="secondary">-</Text>),
                  },
                ]}
              />
            </Card>
          ))}
        </div>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Dokumen
// ---------------------------------------------------------------------------

type DocFormValues = {
  type: DocType;
  status: DocStatus;
  sourceType: "Link" | "Upload";
  url: string;
};

function DocumentModal({
  open, initial, onCancel, onSubmit,
}: {
  open: boolean;
  initial: DocumentItem | null;
  onCancel: () => void;
  onSubmit: (values: DocFormValues) => void;
}) {
  const [form] = Form.useForm<DocFormValues>();

  useEffect(() => {
    if (open) form.setFieldsValue(initial ?? { type: "BR", status: "Draft", sourceType: "Link", url: "" });
  }, [open, initial, form]);

  const sourceType = Form.useWatch("sourceType", form);
  const uploadedFileName = Form.useWatch("url", form);

  return (
    <Modal
      title={initial ? "Ubah Dokumen" : "Tambah Dokumen"}
      open={open}
      onCancel={onCancel}
      onOk={() => form.validateFields().then(onSubmit)}
      okText="Simpan"
      cancelText="Batal"
      destroyOnHidden
      width={560}
    >
      <Form form={form} layout="vertical">
        <Row gutter={12}>
          <Col xs={24} sm={12}>
            <Form.Item name="type" label="Jenis Dokumen" rules={[{ required: true, message: "Wajib diisi" }]}>
              <Select options={masterDocumentTypes.map((d) => ({ label: `${d.type} — ${d.description}`, value: d.type }))} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item name="status" label="Status" rules={[{ required: true, message: "Wajib diisi" }]}>
              <Select
                options={["Draft", "Review", "Approved", "Rejected"].map((s) => ({ label: s, value: s }))}
              />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={12}>
          <Col xs={24} sm={12}>
            <Form.Item name="sourceType" label="Sumber Dokumen" rules={[{ required: true, message: "Wajib diisi" }]}>
              <Select
                options={[
                  { label: "Link (mis. Gdrive)", value: "Link" },
                  { label: "Upload File", value: "Upload" },
                ]}
                onChange={() => form.setFieldsValue({ url: undefined })}
              />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            {sourceType === "Upload" ? (
              <Form.Item label="File" required>
                <Upload
                  maxCount={1}
                  beforeUpload={(file) => {
                    form.setFieldsValue({ url: file.name });
                    return false;
                  }}
                  onRemove={() => form.setFieldsValue({ url: undefined })}
                  fileList={uploadedFileName ? [{ uid: "-1", name: uploadedFileName, status: "done" as const }] : []}
                >
                  <Button icon={<UploadOutlined />}>Pilih File</Button>
                </Upload>
                <Form.Item name="url" rules={[{ required: true, message: "Wajib upload file" }]} noStyle>
                  <Input type="hidden" />
                </Form.Item>
              </Form.Item>
            ) : (
              <Form.Item name="url" label="Link URL" rules={[{ required: true, message: "Wajib diisi" }]}>
                <Input placeholder="https://drive.google.com/..." />
              </Form.Item>
            )}
          </Col>
        </Row>
      </Form>
      {!initial && (
        <Text type="secondary" style={{ fontSize: 12 }}>
          Approval chain (siapa aja yang perlu tanda tangan) diisi belakangan setelah dokumen dibuat.
        </Text>
      )}
    </Modal>
  );
}

function ApproverAddForm({ onAdd }: { onAdd: (values: { name: string; level: string }) => void }) {
  const [name, setName] = useState<string | undefined>(undefined);
  const [level, setLevel] = useState<string | undefined>(undefined);
  return (
    <Space size={6}>
      <Select
        showSearch
        size="small"
        placeholder="Nama approver"
        style={{ width: 160 }}
        optionFilterProp="label"
        value={name}
        options={employees.map((u) => ({ label: u.name, value: u.name }))}
        onChange={setName}
      />
      <Select
        size="small"
        placeholder="Level"
        style={{ width: 120 }}
        value={level}
        options={masterApprovalLevels.map((l) => ({ label: l, value: l }))}
        onChange={setLevel}
      />
      <Button
        size="small"
        type="dashed"
        icon={<PlusOutlined />}
        onClick={() => {
          if (!name || !level) { message.warning("Pilih nama & level dulu."); return; }
          onAdd({ name, level });
          setName(undefined);
          setLevel(undefined);
        }}
      >
        Tambah
      </Button>
    </Space>
  );
}

function DocumentCard({
  doc, onEdit, onDelete, onAddApprover, onDeleteApprover, onChangeApproverStatus,
}: {
  doc: DocumentItem;
  onEdit: () => void;
  onDelete: () => void;
  onAddApprover: (values: { name: string; level: string }) => void;
  onDeleteApprover: (approverId: string) => void;
  onChangeApproverStatus: (approverId: string, status: Approver["status"]) => void;
}) {
  const borderColor = doc.status === "Approved" ? "#389e0d" : doc.status === "Rejected" ? "#cf1322" : doc.status === "Review" ? "#d48806" : agi[200];
  return (
    <Card
      size="small"
      type="inner"
      style={{ marginBottom: 10, borderInlineStart: `3px solid ${borderColor}` }}
      title={
        <Space wrap size={8}>
          <Tag color={getDocStatusColor(doc.status)} style={{ fontWeight: 600, marginInlineEnd: 0 }}>{doc.type}</Tag>
          <Text>{doc.status}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>({doc.approvalLevel} approver)</Text>
        </Space>
      }
      extra={
        <Space size={4}>
          {doc.sourceType === "Link" ? (
            <Button size="small" icon={<LinkOutlined />} href={doc.url} target="_blank" rel="noopener noreferrer">
              Buka Link
            </Button>
          ) : (
            <Button size="small" icon={<FileTextOutlined />} onClick={() => message.info(`Membuka ${doc.url} (mock — belum ada file storage nyata).`)}>
              {doc.url}
            </Button>
          )}
          <Button size="small" type="text" icon={<EditOutlined />} onClick={onEdit} />
          <Popconfirm title="Hapus dokumen ini?" onConfirm={onDelete} okText="Hapus" cancelText="Batal">
            <Button size="small" type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {doc.approvers.length === 0 ? (
            <Text type="secondary" style={{ fontSize: 12 }}>Belum ada approver.</Text>
          ) : (
            doc.approvers.map((a) => (
              <Tag
                key={a.id}
                color={getApprovalStatusColor(a.status)}
                closable
                onClose={(e) => { e.preventDefault(); onDeleteApprover(a.id); }}
                style={{ marginInlineEnd: 0, display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                {a.name} · {a.level}
                <Select
                  size="small"
                  variant="borderless"
                  value={a.status}
                  onChange={(status) => onChangeApproverStatus(a.id, status)}
                  style={{ minWidth: 92 }}
                  options={["Menunggu", "Disetujui", "Ditolak"].map((s) => ({ label: s, value: s }))}
                />
                {a.status === "Disetujui" && <span title="Disetujui = sudah TTD"><CheckCircleFilled /></span>}
              </Tag>
            ))
          )}
        </div>
        <ApproverAddForm onAdd={onAddApprover} />
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Migrasi & Rekon
// ---------------------------------------------------------------------------

type MigrationFormValues = {
  sourceSystem: string;
  dbName?: string;
  tableName?: string;
  description: string;
  status: MigrationRecon["status"];
  pic: string;
  team?: string[];
  dateRange?: [dayjs.Dayjs, dayjs.Dayjs];
  reportStatus: MigrationRecon["reportStatus"];
  reportUrl?: string;
};

function MigrationModal({
  open, initial, onCancel, onSubmit,
}: {
  open: boolean;
  initial: MigrationRecon | null;
  onCancel: () => void;
  onSubmit: (values: MigrationFormValues) => void;
}) {
  const [form] = Form.useForm<MigrationFormValues>();

  useEffect(() => {
    if (!open) return;
    if (initial) {
      form.setFieldsValue({
        ...initial,
        dateRange: initial.startDate && initial.endDate
          ? [dayjs(initial.startDate), dayjs(initial.endDate)]
          : undefined,
      });
    } else {
      form.setFieldsValue({ status: "Belum Mulai", reportStatus: "Belum Ada", team: [] });
    }
  }, [open, initial, form]);

  return (
    <Modal
      title={initial ? "Ubah Migrasi & Rekon" : "Tambah Migrasi & Rekon"}
      open={open}
      onCancel={onCancel}
      onOk={() => form.validateFields().then(onSubmit)}
      okText="Simpan"
      cancelText="Batal"
      destroyOnHidden
      width={680}
    >
      <Form form={form} layout="vertical">
        <Row gutter={12}>
          <Col xs={24} sm={12}>
            <Form.Item name="sourceSystem" label="Source System" rules={[{ required: true, message: "Wajib diisi" }]}>
              <Input placeholder="mis. T24, Core Banking, Vendor X" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item name="status" label="Status Migrasi/Rekon" rules={[{ required: true, message: "Wajib diisi" }]}>
              <Select
                options={["Belum Mulai", "On Going", "Rekon Selesai"].map((s) => ({ label: s, value: s }))}
              />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={12}>
          <Col xs={24} sm={12}>
            <Form.Item name="dbName" label="Nama Database">
              <Input placeholder="mis. t24_core" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item name="tableName" label="Nama Tabel">
              <Input placeholder="mis. ACCOUNT, CUSTOMER, BALANCE" />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item name="description" label="Deskripsi" rules={[{ required: true, message: "Wajib diisi" }]}>
          <Input.TextArea rows={2} placeholder="mis. Migrasi data rekening & saldo nasabah" />
        </Form.Item>
        <Row gutter={12}>
          <Col xs={24} sm={12}>
            <Form.Item name="pic" label="PIC Utama" rules={[{ required: true, message: "Wajib diisi" }]}>
              <Input placeholder="Nama penanggung jawab" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item name="team" label="Tim yang Ikut Mengerjakan (opsional)">
              <Select mode="tags" placeholder="Ketik nama lalu Enter" open={false} />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={12}>
          <Col xs={24} sm={12}>
            <Form.Item name="dateRange" label="Tanggal Mulai — Selesai">
              <DatePicker.RangePicker style={{ width: "100%" }} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item name="reportStatus" label="Status Laporan Hasil" rules={[{ required: true, message: "Wajib diisi" }]}>
              <Select options={["Belum Ada", "Draft", "Final"].map((s) => ({ label: s, value: s }))} />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item name="reportUrl" label="Laporan Hasil (link atau nama file)">
          <Input placeholder="https://... atau Laporan-Migrasi.pdf" />
        </Form.Item>
      </Form>
    </Modal>
  );
}

function MigrationItemView({ m, onEdit, onDelete }: { m: MigrationRecon; onEdit: () => void; onDelete: () => void }) {
  const borderColor = m.status === "Rekon Selesai" ? "#389e0d" : m.status === "On Going" ? "#d48806" : agi[200];
  return (
    <Card
      size="small"
      type="inner"
      style={{ marginBottom: 10, borderInlineStart: `3px solid ${borderColor}` }}
      title={
        <Space wrap size={8}>
          <Text strong style={{ fontSize: 13 }}>{m.sourceSystem}</Text>
          <Tag color={getMigrationStatusColor(m.status)} style={{ marginInlineEnd: 0 }}>{m.status}</Tag>
          {m.dbName && <Tag style={{ fontSize: 11 }}>DB: {m.dbName}</Tag>}
        </Space>
      }
      extra={
        <Space size={0}>
          <Button size="small" type="text" icon={<EditOutlined />} onClick={onEdit} />
          <Popconfirm title="Hapus data migrasi ini?" onConfirm={onDelete} okText="Hapus" cancelText="Batal">
            <Button size="small" type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      }
    >
      <Paragraph style={{ marginBottom: 12, fontSize: 13 }}>{m.description}</Paragraph>
      <DetailGrid
        minColWidth={150}
        rowGap={12}
        items={[
          ...(m.tableName ? [{ label: "Tabel", value: m.tableName }] : []),
          { label: "PIC", value: m.pic },
          ...(m.team && m.team.length > 0 ? [{ label: "Tim", value: m.team.join(", ") }] : []),
          ...(m.startDate ? [{ label: "Tanggal", value: `${m.startDate} → ${m.endDate ?? "-"}` }] : []),
          {
            label: "Laporan",
            full: true,
            value: (
              <Space size={8} wrap>
                <Tag color={getReportStatusColor(m.reportStatus)} style={{ marginInlineEnd: 0 }}>{m.reportStatus}</Tag>
                {m.reportUrl && (
                  m.reportUrl.startsWith("http") ? (
                    <Button size="small" icon={<LinkOutlined />} href={m.reportUrl} target="_blank" rel="noopener noreferrer">
                      Buka Laporan
                    </Button>
                  ) : (
                    <Button size="small" icon={<FileTextOutlined />} onClick={() => message.info(`Membuka ${m.reportUrl} (mock).`)}>
                      {m.reportUrl}
                    </Button>
                  )
                )}
              </Space>
            ),
          },
        ]}
      />
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Fase (create/edit field dasar)
// ---------------------------------------------------------------------------

type PhaseFormValues = {
  name: string;
  stage: Phase["stage"];
  dateRange: [dayjs.Dayjs, dayjs.Dayjs];
  scope?: string[];
  note?: string;
};

function PhaseModal({
  open, initial, onCancel, onSubmit,
}: {
  open: boolean;
  initial: Phase | null;
  onCancel: () => void;
  onSubmit: (values: PhaseFormValues) => void;
}) {
  const [form] = Form.useForm<PhaseFormValues>();

  useEffect(() => {
    if (!open) return;
    if (initial) {
      form.setFieldsValue({
        name: initial.name,
        stage: initial.stage,
        dateRange: [dayjs(initial.startDate), dayjs(initial.targetLiveDate)],
        scope: initial.scope,
        note: initial.note,
      });
    } else {
      form.resetFields();
    }
  }, [open, initial, form]);

  return (
    <Modal
      title={initial ? "Ubah Fase" : "Tambah Fase"}
      open={open}
      onCancel={onCancel}
      onOk={() => form.validateFields().then(onSubmit)}
      okText="Simpan"
      cancelText="Batal"
      destroyOnHidden
      width={560}
    >
      <Form form={form} layout="vertical">
        <Row gutter={12}>
          <Col xs={24} sm={12}>
            <Form.Item name="name" label="Nama Fase" rules={[{ required: true, message: "Wajib diisi" }]}>
              <Input placeholder="mis. Fase 3" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item name="stage" label="Tahap SDLC Saat Ini" rules={[{ required: true, message: "Wajib diisi" }]}>
              <Select
                options={["Dokumen", "Development", "Testing", "Live"].map((s) => ({ label: s, value: s }))}
              />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item name="dateRange" label="Rentang Tanggal (mulai — target live)" rules={[{ required: true, message: "Wajib diisi" }]}>
          <DatePicker.RangePicker style={{ width: "100%" }} />
        </Form.Item>
        <Form.Item label="Scope Fase">
          <Form.List name="scope">
            {(fields, { add, remove }) => (
              <div>
                {fields.map(({ key, name, ...restField }) => (
                  <Row gutter={8} key={key} align="middle" style={{ marginBottom: 8 }}>
                    <Col flex="auto">
                      <Form.Item {...restField} name={name} rules={[{ required: true, message: "Wajib diisi" }]} noStyle>
                        <Input placeholder="mis. Integrasi API rekening dengan T24" />
                      </Form.Item>
                    </Col>
                    <Col>
                      <Button type="text" danger icon={<DeleteOutlined />} onClick={() => remove(name)} />
                    </Col>
                  </Row>
                ))}
                <Button type="dashed" icon={<PlusOutlined />} onClick={() => add()} block>
                  Tambah Poin Scope
                </Button>
              </div>
            )}
          </Form.List>
        </Form.Item>
        <Form.Item name="note" label="Catatan">
          <Input.TextArea rows={2} placeholder="Catatan tambahan perihal scope, dll" />
        </Form.Item>
      </Form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Detail Project (Overview)
// ---------------------------------------------------------------------------

type ProjectDetails = {
  name: string;
  crNumber?: string;
  brNumber?: string;
  category: ProjectCategory;
  priority: ProjectPriority;
  directorate: string;
  subdirectorate: string;
  vendor?: string;
  gitRepo?: string;
  poNumber?: string;
  poStatus?: "Belum Ada" | "Draft" | "Approved";
  hasMigration?: boolean;
};

type ProjectInfoValues = Pick<ProjectDetails, "name" | "crNumber" | "brNumber" | "directorate" | "subdirectorate" | "category" | "priority" | "hasMigration">;
type VendorPoValues = Pick<ProjectDetails, "vendor" | "poNumber" | "poStatus">;
type GitRepoValues = Pick<ProjectDetails, "gitRepo">;

function ProjectInfoModal({
  open, initial, onCancel, onSubmit,
}: {
  open: boolean;
  initial: ProjectDetails | null;
  onCancel: () => void;
  onSubmit: (values: ProjectInfoValues) => void;
}) {
  const [form] = Form.useForm<ProjectInfoValues>();
  const infoDirectorate = Form.useWatch("directorate", form);

  useEffect(() => {
    if (open && initial) form.setFieldsValue(initial);
  }, [open, initial, form]);

  return (
    <Modal
      title="Ubah Informasi Project"
      open={open}
      onCancel={onCancel}
      onOk={() => form.validateFields().then(onSubmit)}
      okText="Simpan"
      cancelText="Batal"
      destroyOnHidden
      width={640}
    >
      <Form form={form} layout="vertical">
        <Form.Item name="name" label="Nama Project" rules={[{ required: true, message: "Wajib diisi" }]}>
          <Input placeholder="mis. Core Banking Portal" />
        </Form.Item>
        <Row gutter={12}>
          <Col xs={24} sm={12}>
            <Form.Item name="crNumber" label="Nomor CR">
              <Input placeholder="mis. CR-2026-0142 (isi begitu nomor sudah terbit)" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item name="brNumber" label="Nomor BR">
              <Input placeholder="mis. BR-2026-0087 (biasanya terbit lebih dulu)" />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={12}>
          <Col xs={24} sm={12}>
            <Form.Item name="category" label="Kategori" rules={[{ required: true, message: "Wajib diisi" }]}>
              <Select options={masterProjectCategories.map((c) => ({ label: c, value: c }))} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item name="priority" label="Priority" rules={[{ required: true, message: "Wajib diisi" }]}>
              <Select options={masterProjectPriorities.map((p) => ({ label: p, value: p }))} />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={12}>
          <Col xs={24} sm={12}>
            <Form.Item name="directorate" label="Direktorat Pengaju" rules={[{ required: true, message: "Wajib diisi" }]}>
              <Select
                options={masterDirektorat.map((d) => ({ label: d, value: d }))}
                onChange={() => form.setFieldsValue({ subdirectorate: undefined })}
              />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item name="subdirectorate" label="Subdit Pengaju" rules={[{ required: true, message: "Wajib diisi" }]}>
              <Select
                placeholder={infoDirectorate ? "Pilih subdit" : "Pilih direktorat dulu"}
                disabled={!infoDirectorate}
                options={getSubditOptions(infoDirectorate).map((s) => ({ label: s.subdirectorate, value: s.subdirectorate }))}
              />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item
          name="hasMigration"
          label="Ada migrasi/rekon data?"
          valuePropName="checked"
          tooltip="Aktifkan kalau project ini butuh migrasi/rekon data dari sistem lain — tab Migrasi & Rekon baru muncul kalau ini aktif."
        >
          <Switch />
        </Form.Item>
      </Form>
    </Modal>
  );
}

function VendorPoModal({
  open, initial, onCancel, onSubmit,
}: {
  open: boolean;
  initial: ProjectDetails | null;
  onCancel: () => void;
  onSubmit: (values: VendorPoValues) => void;
}) {
  const [form] = Form.useForm<VendorPoValues>();

  useEffect(() => {
    if (open && initial) form.setFieldsValue(initial);
  }, [open, initial, form]);

  return (
    <Modal
      title="Ubah Vendor"
      open={open}
      onCancel={onCancel}
      onOk={() => form.validateFields().then(onSubmit)}
      okText="Simpan"
      cancelText="Batal"
      destroyOnHidden
      width={480}
    >
      <Form form={form} layout="vertical">
        <Form.Item name="vendor" label="Vendor (opsional)">
          <Select allowClear options={masterVendors.map((v) => ({ label: v, value: v }))} placeholder="Belum tentu ada — bisa dikosongkan" />
        </Form.Item>
      </Form>
    </Modal>
  );
}

function GitRepoModal({
  open, initial, onCancel, onSubmit,
}: {
  open: boolean;
  initial: ProjectDetails | null;
  onCancel: () => void;
  onSubmit: (values: GitRepoValues) => void;
}) {
  const [form] = Form.useForm<GitRepoValues>();

  useEffect(() => {
    if (open && initial) form.setFieldsValue(initial);
  }, [open, initial, form]);

  return (
    <Modal
      title="Ubah Git Repository Default Project"
      open={open}
      onCancel={onCancel}
      onOk={() => form.validateFields().then(onSubmit)}
      okText="Simpan"
      cancelText="Batal"
      destroyOnHidden
    >
      <Form form={form} layout="vertical">
        <Form.Item name="gitRepo" label="Git Repository (default/utama)">
          <Input placeholder="mis. git.internal.co/nama-repo (isi begitu repo sudah dibuat)" />
        </Form.Item>
      </Form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Halaman utama
// ---------------------------------------------------------------------------

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const project = getProjectById(params.id);

  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [form] = Form.useForm<{ status: ProjectStatus; reason?: string }>();
  // Local mirror dari status/hold & phases (dokumen/environment/migrasi
  // ikut di dalamnya) — biar tab-tab ini bisa diedit interaktif di mock ini.
  // Persistensi beneran nyusul begitu backend API-nya jalan.
  const [status, setStatus] = useState<ProjectStatus | null>(project?.status ?? null);
  const [holdHistory, setHoldHistory] = useState(project?.holdHistory ?? []);
  const [phases, setPhases] = useState<Phase[]>(project?.phases ?? []);
  const [pmoMembers, setPmoMembers] = useState<Member[]>(project?.pmo ?? []);
  const [developers, setDevelopers] = useState<Member[]>(project?.developers ?? []);
  const [users, setUsers] = useState<Member[]>(project?.users ?? []);
  const [details, setDetails] = useState<ProjectDetails | null>(
    project
      ? {
        name: project.name,
        crNumber: project.crNumber,
        brNumber: project.brNumber,
        directorate: project.directorate,
        subdirectorate: project.subdirectorate,
        category: project.category,
        priority: project.priority,
        vendor: project.vendor,
        gitRepo: project.gitRepo,
        poNumber: project.poNumber,
        poStatus: project.poStatus,
        hasMigration: project.hasMigration,
      }
      : null
  );

  const [envModal, setEnvModal] = useState<{ phaseId: string; item: EnvironmentItem | null } | null>(null);
  const [docModal, setDocModal] = useState<{ phaseId: string; item: DocumentItem | null } | null>(null);
  const [migModal, setMigModal] = useState<{ phaseId: string; item: MigrationRecon | null } | null>(null);
  const [depModal, setDepModal] = useState<{ phaseId: string; item: Dependency | null } | null>(null);
  const [phaseModal, setPhaseModal] = useState<{ item: Phase | null } | null>(null);
  const [memberModal, setMemberModal] = useState<{ role: TeamRole; item: Member | null } | null>(null);
  const [infoModalOpen, setInfoModalOpen] = useState(false);
  const [vendorPoModalOpen, setVendorPoModalOpen] = useState(false);
  const [gitRepoModalOpen, setGitRepoModalOpen] = useState(false);

  const projectMeetings = useMemo(
    () => allMeetings.filter((m) => m.projectId === params.id),
    [params.id]
  );
  const projectAuditLogs = useMemo(
    () => auditLogs.filter((a) => a.projectName === project?.name),
    [project?.name]
  );

  if (!project || status === null || !details) {
    return (
      <ErrorState
        code={404}
        title="Project tidak ditemukan"
        description="Project yang kamu cari mungkin sudah dihapus atau alamatnya salah."
        actions={[{ label: "Kembali ke Daftar Project", href: "/projects", primary: true }]}
      />
    );
  }

  const currentStatus: ProjectStatus = status;
  const wasOnHold: boolean = currentStatus === "Hold";
  const activeHold = holdHistory.find((h) => !h.resumedAt);

  function submitStatusChange() {
    form.validateFields().then((values) => {
      const nextIsHold: boolean = values.status === "Hold";
      if (nextIsHold) {
        setHoldHistory((prev) => [
          ...prev,
          { id: `hh-${Date.now()}`, heldAt: new Date().toISOString().slice(0, 10), reason: values.reason ?? "-", heldBy: "Anda" },
        ]);
      } else if (wasOnHold) {
        setHoldHistory((prev) =>
          prev.map((h) =>
            !h.resumedAt
              ? { ...h, resumedAt: new Date().toISOString().slice(0, 10), resumedBy: "Anda" }
              : h
          )
        );
      }
      setStatus(values.status);
      setStatusModalOpen(false);
    });
  }

  // --- Environment CRUD ---
  function saveEnvironment(values: EnvFormValues) {
    if (!envModal) return;
    const { phaseId, item } = envModal;
    const extraSpecs = (values.extraSpecs ?? []).map((s, idx) => ({
      id: item?.extraSpecs?.[idx]?.id ?? `spec-${Date.now()}-${idx}`,
      label: s.label,
      value: s.value,
    }));
    const patch = { ...values, extraSpecs };
    setPhases((prev) =>
      prev.map((ph) =>
        ph.id !== phaseId ? ph : {
          ...ph,
          environments: item
            ? ph.environments.map((e) => (e.id === item.id ? { ...e, ...patch } : e))
            : [...ph.environments, { id: `env-${Date.now()}`, ...patch }],
        }
      )
    );
    message.success(item ? "Environment diperbarui." : "Environment ditambahkan.");
    setEnvModal(null);
  }
  function deleteEnvironment(phaseId: string, envId: string) {
    setPhases((prev) =>
      prev.map((ph) => (ph.id !== phaseId ? ph : { ...ph, environments: ph.environments.filter((e) => e.id !== envId) }))
    );
    message.success("Environment dihapus.");
  }

  // --- Document CRUD ---
  function saveDocument(values: DocFormValues) {
    if (!docModal) return;
    const { phaseId, item } = docModal;
    setPhases((prev) =>
      prev.map((ph) =>
        ph.id !== phaseId ? ph : {
          ...ph,
          documents: item
            ? ph.documents.map((d) => (d.id === item.id ? { ...d, ...values } : d))
            : [...ph.documents, { id: `doc-${Date.now()}`, ...values, approvalLevel: "0/0", approvers: [] }],
        }
      )
    );
    message.success(item ? "Dokumen diperbarui." : "Dokumen ditambahkan.");
    setDocModal(null);
  }
  function deleteDocument(phaseId: string, docId: string) {
    setPhases((prev) =>
      prev.map((ph) => (ph.id !== phaseId ? ph : { ...ph, documents: ph.documents.filter((d) => d.id !== docId) }))
    );
    message.success("Dokumen dihapus.");
  }
  function addApprover(phaseId: string, docId: string, values: { name: string; level: string }) {
    setPhases((prev) =>
      prev.map((ph) =>
        ph.id !== phaseId ? ph : {
          ...ph,
          documents: ph.documents.map((d) =>
            d.id !== docId ? d : {
              ...d,
              approvers: [...d.approvers, { id: `ap-${Date.now()}`, name: values.name, level: values.level, status: "Menunggu" as const }],
            }
          ),
        }
      )
    );
  }
  function deleteApprover(phaseId: string, docId: string, approverId: string) {
    setPhases((prev) =>
      prev.map((ph) =>
        ph.id !== phaseId ? ph : {
          ...ph,
          documents: ph.documents.map((d) =>
            d.id !== docId ? d : { ...d, approvers: d.approvers.filter((a) => a.id !== approverId) }
          ),
        }
      )
    );
  }
  function changeApproverStatus(phaseId: string, docId: string, approverId: string, status: Approver["status"]) {
    setPhases((prev) =>
      prev.map((ph) =>
        ph.id !== phaseId ? ph : {
          ...ph,
          documents: ph.documents.map((d) =>
            d.id !== docId ? d : {
              ...d,
              approvers: d.approvers.map((a) =>
                a.id === approverId ? { ...a, status, date: status === "Disetujui" ? dayjs().format("YYYY-MM-DD") : a.date } : a
              ),
            }
          ),
        }
      )
    );
  }

  // --- Migration CRUD ---
  function saveMigration(values: MigrationFormValues) {
    if (!migModal) return;
    const { phaseId, item } = migModal;
    const { dateRange, ...rest } = values;
    const patch = {
      ...rest,
      startDate: dateRange?.[0]?.format("YYYY-MM-DD"),
      endDate: dateRange?.[1]?.format("YYYY-MM-DD"),
    };
    setPhases((prev) =>
      prev.map((ph) =>
        ph.id !== phaseId ? ph : {
          ...ph,
          migrations: item
            ? ph.migrations.map((m) => (m.id === item.id ? { ...m, ...patch } : m))
            : [...ph.migrations, { id: `mig-${Date.now()}`, ...patch }],
        }
      )
    );
    message.success(item ? "Data migrasi diperbarui." : "Data migrasi ditambahkan.");
    setMigModal(null);
  }
  function deleteMigration(phaseId: string, migId: string) {
    setPhases((prev) =>
      prev.map((ph) => (ph.id !== phaseId ? ph : { ...ph, migrations: ph.migrations.filter((m) => m.id !== migId) }))
    );
    message.success("Data migrasi dihapus.");
  }

  // --- Dependency CRUD ---
  function saveDependency(values: DependencyFormValues) {
    if (!depModal) return;
    const { phaseId, item } = depModal;
    const endpoints = values.endpoints.map((ep, idx) => ({
      id: item?.endpoints[idx]?.id ?? `dep-ep-${Date.now()}-${idx}`,
      label: ep.label,
      value: ep.value,
      note: ep.note,
    }));
    const patch = { ...values, endpoints };
    setPhases((prev) =>
      prev.map((ph) =>
        ph.id !== phaseId ? ph : {
          ...ph,
          dependencies: item
            ? ph.dependencies.map((d) => (d.id === item.id ? { ...d, ...patch } : d))
            : [...ph.dependencies, { id: `dep-${Date.now()}`, ...patch }],
        }
      )
    );
    message.success(item ? "Dependency diperbarui." : "Dependency ditambahkan.");
    setDepModal(null);
  }
  function deleteDependency(phaseId: string, depId: string) {
    setPhases((prev) =>
      prev.map((ph) => (ph.id !== phaseId ? ph : { ...ph, dependencies: ph.dependencies.filter((d) => d.id !== depId) }))
    );
    message.success("Dependency dihapus.");
  }

  // --- Tim Project CRUD ---
  function saveMember(values: MemberFormValues) {
    if (!memberModal) return;
    const { role, item } = memberModal;
    const isManual = role === "User" || values.source === "manual";
    const resolvedName = isManual ? (values.name ?? "-") : (employees.find((u) => u.id === values.employeeId)?.name ?? "-");
    const patch: Omit<Member, "id"> = {
      name: resolvedName,
      role,
      employeeId: isManual ? undefined : values.employeeId,
      isPrimary: values.isPrimary,
      isVendor: role === "Developer" && isManual ? true : undefined,
      directorate: role === "Developer" && isManual ? undefined : values.directorate,
      subdirectorate: role === "Developer" && isManual ? undefined : values.subdirectorate,
    };
    const setFn = role === "PMO" ? setPmoMembers : role === "Developer" ? setDevelopers : setUsers;
    setFn((prev) =>
      item
        ? prev.map((m) => (m.id === item.id ? { ...m, ...patch } : m))
        : [...prev, { id: `mem-${Date.now()}`, ...patch }]
    );
    message.success(item ? "Anggota diperbarui." : "Anggota ditambahkan.");
    setMemberModal(null);
  }
  function deleteMember(role: TeamRole, id: string) {
    const setFn = role === "PMO" ? setPmoMembers : role === "Developer" ? setDevelopers : setUsers;
    setFn((prev) => prev.filter((m) => m.id !== id));
    message.success("Anggota dihapus.");
  }

  // --- Phase CRUD ---
  function savePhase(values: PhaseFormValues) {
    const [start, end] = values.dateRange;
    if (phaseModal?.item) {
      const editId = phaseModal.item.id;
      setPhases((prev) =>
        prev.map((ph) =>
          ph.id !== editId ? ph : {
            ...ph,
            name: values.name,
            stage: values.stage,
            startDate: start.format("YYYY-MM-DD"),
            targetLiveDate: end.format("YYYY-MM-DD"),
            scope: values.scope,
            note: values.note,
          }
        )
      );
      message.success("Fase diperbarui.");
    } else {
      const newPhase: Phase = {
        id: `ph-${Date.now()}`,
        name: values.name,
        stage: values.stage,
        progressPercent: 0,
        documentProgress: 0,
        developmentProgress: 0,
        testingProgress: 0,
        documents: [],
        testStages: [],
        environments: [],
        migrations: [],
        dependencies: [],
        startDate: start.format("YYYY-MM-DD"),
        targetLiveDate: end.format("YYYY-MM-DD"),
        previousPhaseId: phases[phases.length - 1]?.id,
        scope: values.scope,
        note: values.note,
      };
      setPhases((prev) => [...prev, newPhase]);
      message.success("Fase baru ditambahkan.");
    }
    setPhaseModal(null);
  }

  // --- Detail Project (per tab: Informasi, Vendor & PO, Git Repo) ---
  function saveDetails(values: ProjectInfoValues | VendorPoValues | GitRepoValues) {
    setDetails((prev) => (prev ? { ...prev, ...values } : prev));
    message.success("Detail project diperbarui.");
    setInfoModalOpen(false);
    setVendorPoModalOpen(false);
    setGitRepoModalOpen(false);
  }

  const migrationRows = phases.flatMap((phase) =>
    phase.migrations.map((m) => ({ ...m, phaseName: phase.name }))
  );

  return (
    <div>
      <Button
        type="text"
        icon={<ArrowLeftOutlined />}
        onClick={() => router.push("/projects")}
        style={{ marginBottom: 8, paddingInline: 0 }}
      >
        Kembali ke Daftar Project
      </Button>

      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 24 }}>
          <div style={{ flex: "1 1 320px", minWidth: 260 }}>
            <Space wrap size={10} align="center">
              <Title level={3} style={{ margin: 0, lineHeight: "28px" }}>{details.name}</Title>
              <Tag color={getProjectStatusColor(currentStatus)} style={{ fontSize: 13, padding: "2px 10px", lineHeight: "20px" }}>
                {currentStatus}
              </Tag>
            </Space>
            <div style={{ marginTop: 6 }}>
              <Text type="secondary">
                {details.crNumber ?? "Belum ada nomor CR"}
                {details.brNumber ? ` · BR: ${details.brNumber}` : ""} · {details.directorate} · {details.subdirectorate}
              </Text>
            </div>
            {activeHold && (
              <Paragraph type="warning" style={{ marginTop: 10, marginBottom: 0, fontSize: 13 }}>
                <PauseCircleOutlined /> Di-hold sejak {activeHold.heldAt} oleh {activeHold.heldBy}: {activeHold.reason}
              </Paragraph>
            )}
          </div>
          <div style={{ flex: "0 0 220px", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 12 }}>
            <Button
              icon={currentStatus === "Hold" ? <PlayCircleOutlined /> : <PauseCircleOutlined />}
              onClick={() => {
                form.setFieldsValue({ status: currentStatus, reason: undefined });
                setStatusModalOpen(true);
              }}
            >
              Ubah Status
            </Button>
            <div style={{ width: "100%" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>Progress Keseluruhan</Text>
                <Text strong style={{ fontSize: 12 }}>{project.overallProgress}%</Text>
              </div>
              <Progress percent={project.overallProgress} showInfo={false} />
            </div>
          </div>
        </div>
      </Card>

      <Tabs
        defaultActiveKey="overview"
        items={[
          {
            key: "overview",
            label: "Overview",
            children: (
              <Space orientation="vertical" size={16} style={{ width: "100%" }}>
                <Row gutter={[16, 16]}>
                  <Col xs={24} lg={16}>
                    <Card
                      size="small"
                      title="Informasi Project"
                      extra={
                        <Button
                          size="small"
                          icon={<EditOutlined />}
                          onClick={() => setInfoModalOpen(true)}
                        >
                          Ubah
                        </Button>
                      }
                      style={{ height: "100%" }}
                    >
                      <DetailGrid
                        items={[
                          { label: "Nomor CR", value: details.crNumber ?? "Belum ada nomor CR" },
                          { label: "Nomor BR", value: details.brNumber ?? "-" },
                          { label: "Kategori", value: <Tag color={getCategoryColor(details.category)}>{details.category}</Tag> },
                          { label: "Priority", value: <Tag color={getPriorityColor(details.priority)}>{details.priority}</Tag> },
                          { label: "Direktorat Pengaju", value: details.directorate },
                          { label: "Subdit Pengaju", value: details.subdirectorate },
                          { label: "Jumlah Fase", value: phases.length },
                        ]}
                      />
                    </Card>
                  </Col>
                  <Col xs={24} lg={8}>
                    <Card
                      size="small"
                      title="Vendor"
                      extra={
                        <Button size="small" icon={<EditOutlined />} onClick={() => setVendorPoModalOpen(true)}>
                          Ubah
                        </Button>
                      }
                      style={{ height: "100%" }}
                    >
                      {details.vendor ? (
                        <Text style={{ fontSize: 14 }}>{details.vendor}</Text>
                      ) : (
                        <Text type="secondary">Belum ada vendor — dikerjakan internal.</Text>
                      )}
                    </Card>
                  </Col>
                </Row>

                <Card size="small" title="Tim Project">
                  <Row gutter={16}>
                    <Col xs={24} md={8}>
                      <Card size="small" type="inner" style={{ height: "100%" }}>
                        <MemberGroup
                          title="PMO"
                          role="PMO"
                          members={pmoMembers}
                          onAdd={() => setMemberModal({ role: "PMO", item: null })}
                          onEdit={(m) => setMemberModal({ role: "PMO", item: m })}
                          onDelete={(id) => deleteMember("PMO", id)}
                        />
                      </Card>
                    </Col>
                    <Col xs={24} md={8}>
                      <Card size="small" type="inner" style={{ height: "100%" }}>
                        <MemberGroup
                          title="Developer"
                          role="Developer"
                          members={developers}
                          onAdd={() => setMemberModal({ role: "Developer", item: null })}
                          onEdit={(m) => setMemberModal({ role: "Developer", item: m })}
                          onDelete={(id) => deleteMember("Developer", id)}
                        />
                      </Card>
                    </Col>
                    <Col xs={24} md={8}>
                      <Card size="small" type="inner" style={{ height: "100%" }}>
                        <MemberGroup
                          title="User"
                          role="User"
                          members={users}
                          onAdd={() => setMemberModal({ role: "User", item: null })}
                          onEdit={(m) => setMemberModal({ role: "User", item: m })}
                          onDelete={(id) => deleteMember("User", id)}
                        />
                      </Card>
                    </Col>
                  </Row>
                </Card>
              </Space>
            ),
          },
          {
            key: "fase",
            label: `Fase (${phases.length})`,
            children: (
              <Space orientation="vertical" size={16} style={{ width: "100%" }}>
                <Button
                  icon={<PlusOutlined />}
                  type="primary"
                  onClick={() => setPhaseModal({ item: null })}
                >
                  Tambah Fase
                </Button>
                {phases.length === 0 ? (
                  <Card><Empty description="Belum ada fase." /></Card>
                ) : (
                  phases.map((phase) => (
                    <PhaseCard
                      key={phase.id}
                      phase={phase}
                      allPhases={phases}
                      onEdit={() => setPhaseModal({ item: phase })}
                    />
                  ))
                )}
              </Space>
            ),
          },
          {
            key: "dokumen",
            label: "Dokumen",
            children: (
              <Space orientation="vertical" size={16} style={{ width: "100%" }}>
                {phases.map((phase) => (
                  <Card
                    key={phase.id}
                    size="small"
                    title={`Dokumen — ${phase.name}`}
                    extra={
                      <Button size="small" icon={<PlusOutlined />} onClick={() => setDocModal({ phaseId: phase.id, item: null })}>
                        Tambah
                      </Button>
                    }
                  >
                    {phase.documents.length === 0 ? (
                      <Text type="secondary">Belum ada dokumen di fase ini.</Text>
                    ) : (
                      phase.documents.map((doc) => (
                        <DocumentCard
                          key={doc.id}
                          doc={doc}
                          onEdit={() => setDocModal({ phaseId: phase.id, item: doc })}
                          onDelete={() => deleteDocument(phase.id, doc.id)}
                          onAddApprover={(values) => addApprover(phase.id, doc.id, values)}
                          onDeleteApprover={(approverId) => deleteApprover(phase.id, doc.id, approverId)}
                          onChangeApproverStatus={(approverId, status) => changeApproverStatus(phase.id, doc.id, approverId, status)}
                        />
                      ))
                    )}
                  </Card>
                ))}
              </Space>
            ),
          },
          {
            key: "git-env",
            label: "Git, Environment & Dependency",
            children: (
              <Space orientation="vertical" size={16} style={{ width: "100%" }}>
                <Card
                  size="small"
                  title="Git Repository Default Project"
                  extra={
                    <Button size="small" icon={<EditOutlined />} onClick={() => setGitRepoModalOpen(true)}>
                      Ubah
                    </Button>
                  }
                >
                  {details.gitRepo ? (
                    <Space>
                      <GithubOutlined />
                      <Text code>{details.gitRepo}</Text>
                    </Space>
                  ) : (
                    <Text type="secondary">
                      Belum diisi — lengkapi lewat tombol Ubah di atas setelah repo dibuat.
                    </Text>
                  )}
                  <Paragraph type="secondary" style={{ fontSize: 12, marginTop: 8, marginBottom: 0 }}>
                    Ini repo utama/default saja. Karena arsitekturnya modular, repo per modul dan
                    environment lain (banyak developer/user beda segmen IP, banyak lokasi staging, DB,
                    SSH, dst — lengkap dengan spesifikasi servernya) dicatat per fase di bawah, sekalian
                    dengan sistem lain yang jadi dependency integrasinya (Axway, Fiorano, Big Data, dst).
                  </Paragraph>
                </Card>

                {phases.map((phase) => (
                  <div key={phase.id} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    <EnvironmentSection
                      phase={phase}
                      onAdd={() => setEnvModal({ phaseId: phase.id, item: null })}
                      onEdit={(item) => setEnvModal({ phaseId: phase.id, item })}
                      onDelete={(id) => deleteEnvironment(phase.id, id)}
                    />
                    <DependencySection
                      phase={phase}
                      onAdd={() => setDepModal({ phaseId: phase.id, item: null })}
                      onEdit={(item) => setDepModal({ phaseId: phase.id, item })}
                      onDelete={(id) => deleteDependency(phase.id, id)}
                    />
                  </div>
                ))}
              </Space>
            ),
          },
          ...(details.hasMigration ? [{
            key: "migrasi",
            label: "Migrasi & Rekon",
            children: (
              <Space orientation="vertical" size={16} style={{ width: "100%" }}>
                <Row gutter={12}>
                  <Col xs={8}>
                    <Card size="small">
                      <Statistic title="Belum Mulai" value={migrationRows.filter((m) => m.status === "Belum Mulai").length} />
                    </Card>
                  </Col>
                  <Col xs={8}>
                    <Card size="small">
                      <Statistic
                        title="On Going"
                        value={migrationRows.filter((m) => m.status === "On Going").length}
                        styles={{ content: { color: "#d48806" } }}
                      />
                    </Card>
                  </Col>
                  <Col xs={8}>
                    <Card size="small">
                      <Statistic
                        title="Rekon Selesai"
                        value={migrationRows.filter((m) => m.status === "Rekon Selesai").length}
                        styles={{ content: { color: "#389e0d" } }}
                      />
                    </Card>
                  </Col>
                </Row>
                {phases.map((phase) => (
                  <Card
                    key={phase.id}
                    size="small"
                    title={`Migrasi & Rekon — ${phase.name}`}
                    extra={
                      <Button size="small" icon={<PlusOutlined />} onClick={() => setMigModal({ phaseId: phase.id, item: null })}>
                        Tambah
                      </Button>
                    }
                  >
                    {phase.migrations.length === 0 ? (
                      <Text type="secondary">Belum ada aktivitas migrasi/rekon di fase ini.</Text>
                    ) : (
                      phase.migrations.map((m) => (
                        <MigrationItemView
                          key={m.id}
                          m={m}
                          onEdit={() => setMigModal({ phaseId: phase.id, item: m })}
                          onDelete={() => deleteMigration(phase.id, m.id)}
                        />
                      ))
                    )}
                  </Card>
                ))}
                {migrationRows.length === 0 && phases.length === 0 && (
                  <Card><Empty description="Belum ada fase." /></Card>
                )}
              </Space>
            ),
          }] : []),
          {
            key: "task-rapat",
            label: "Task & Rapat",
            children: (
              <Space orientation="vertical" size={16} style={{ width: "100%" }}>
                <ProjectTasksPanel
                  projectId={params.id}
                  phases={phases.map((ph) => ({ id: ph.id, name: ph.name }))}
                  members={[...pmoMembers, ...developers, ...users].map((m) => m.name)}
                />
                <Card title="Rapat terkait project ini" size="small">
                  <DataTable
                    rowKey="id"
                    size="small"
                    dataSource={projectMeetings}
                    defaultPageSize={10}
                    searchPlaceholder="Cari rapat, kategori, peserta..."
                    locale={{ emptyText: "Belum ada rapat." }}
                    columns={[
                      { title: "Rapat", dataIndex: "title" },
                      { title: "Kategori", dataIndex: "category", width: 130, filterable: true, render: (v) => <Tag style={{ fontSize: 11 }}>{v}</Tag> },
                      { title: "Tanggal", dataIndex: "date", width: 170, render: (v) => new Date(v).toLocaleString("id-ID") },
                      {
                        title: "Status", dataIndex: "status", width: 110, filterable: true,
                        render: (v) => <Tag color={v === "Done" ? "green" : v === "Scheduled" ? "blue" : "red"}>{v}</Tag>,
                      },
                      { title: "Peserta", dataIndex: "attendees", sortable: false, render: (v: string[]) => v.join(", ") },
                    ]}
                  />
                  <Paragraph type="secondary" style={{ fontSize: 12, marginTop: 8, marginBottom: 0 }}>
                    Tambah/ubah rapat lewat menu Rapat.
                  </Paragraph>
                </Card>
              </Space>
            ),
          },
          {
            key: "riwayat",
            label: "Riwayat",
            children: (
              <Card>
                {projectAuditLogs.length === 0 ? (
                  <Empty description="Belum ada riwayat perubahan untuk project ini." />
                ) : (
                  <Timeline
                    items={projectAuditLogs.map((log) => ({
                      content: (
                        <div>
                          <Text strong>{log.entity} · {log.field}</Text>
                          <div>
                            <Text type="secondary" delete>{log.oldValue}</Text>{" → "}
                            <Text>{log.newValue}</Text>
                          </div>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {log.changedBy} · {new Date(log.changedAt).toLocaleString("id-ID")}
                          </Text>
                        </div>
                      ),
                    }))}
                  />
                )}
              </Card>
            ),
          },
        ]}
      />

      <Modal
        title="Ubah Status Project"
        open={statusModalOpen}
        onCancel={() => setStatusModalOpen(false)}
        onOk={submitStatusChange}
        okText="Simpan"
        cancelText="Batal"
      >
        <Form form={form} layout="vertical" initialValues={{ status: currentStatus }}>
          <Form.Item name="status" label="Status" rules={[{ required: true }]}>
            <Select
              options={[
                { label: "Active", value: "Active" },
                { label: "Hold", value: "Hold" },
                { label: "Cancelled", value: "Cancelled" },
              ]}
            />
          </Form.Item>
          <Form.Item
            noStyle
            shouldUpdate={(prev, cur) => prev.status !== cur.status}
          >
            {({ getFieldValue }) =>
              getFieldValue("status") === "Hold" ? (
                <Form.Item
                  name="reason"
                  label="Alasan Hold"
                  rules={[{ required: true, message: "Wajib diisi kalau status di-hold" }]}
                >
                  <Input.TextArea rows={3} placeholder="mis. Menunggu revisi anggaran" />
                </Form.Item>
              ) : null
            }
          </Form.Item>
        </Form>
      </Modal>

      <EnvironmentModal
        open={envModal !== null}
        initial={envModal?.item ?? null}
        onCancel={() => setEnvModal(null)}
        onSubmit={saveEnvironment}
      />
      <DocumentModal
        open={docModal !== null}
        initial={docModal?.item ?? null}
        onCancel={() => setDocModal(null)}
        onSubmit={saveDocument}
      />
      <MigrationModal
        open={migModal !== null}
        initial={migModal?.item ?? null}
        onCancel={() => setMigModal(null)}
        onSubmit={saveMigration}
      />
      <PhaseModal
        open={phaseModal !== null}
        initial={phaseModal?.item ?? null}
        onCancel={() => setPhaseModal(null)}
        onSubmit={savePhase}
      />
      <DependencyModal
        open={depModal !== null}
        initial={depModal?.item ?? null}
        onCancel={() => setDepModal(null)}
        onSubmit={saveDependency}
      />
      <MemberModal
        open={memberModal !== null}
        role={memberModal?.role ?? null}
        initial={memberModal?.item ?? null}
        onCancel={() => setMemberModal(null)}
        onSubmit={saveMember}
      />
      <ProjectInfoModal
        open={infoModalOpen}
        initial={details}
        onCancel={() => setInfoModalOpen(false)}
        onSubmit={saveDetails}
      />
      <VendorPoModal
        open={vendorPoModalOpen}
        initial={details}
        onCancel={() => setVendorPoModalOpen(false)}
        onSubmit={saveDetails}
      />
      <GitRepoModal
        open={gitRepoModalOpen}
        initial={details}
        onCancel={() => setGitRepoModalOpen(false)}
        onSubmit={saveDetails}
      />
    </div>
  );
}