"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Alert, App, Avatar, Button, Col, Form, Input, Modal, Popconfirm, Row, Select, Space, Switch, Tag, Tooltip, Typography } from "antd";
import { DeleteOutlined, EditOutlined, KeyOutlined, PlusOutlined, UserOutlined } from "@ant-design/icons";
import PageSkeleton from "@/components/layout/PageSkeleton";
import DataTable from "@/components/common/DataTable";
import { useMasterLists, useMasterStore } from "@/lib/master-store";
import { useCurrentUser } from "@/lib/acting-user";
import { projects, type AppUser } from "@/lib/mock-data";
import { ADMIN_ROLE, permissionsOf, useUserStore } from "@/lib/user-store";
import { employeeUsage } from "@/lib/master-usage";
import { useAuth } from "@/lib/auth-store";

const { Text } = Typography;

type FormValues = {
  employeeId?: string;
  name: string;
  username: string;
  email: string;
  directorate: string;
  subdirectorate: string;
  roles: string[];
  active: boolean;
};
type Editing = { mode: "new" } | { mode: "edit"; user: AppUser };
type StatusFilter = "all" | "active" | "inactive";

function StatCard({ label, value, on, onClick, tone }: { label: string; value: number; on: boolean; onClick: () => void; tone?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      style={{ textAlign: "left", cursor: "pointer", padding: "10px 14px", borderRadius: 10, background: on ? "#E3F6F8" : "#fff", borderStyle: "solid", borderWidth: 1, borderColor: on ? "#7BDDE5" : "#E6ECEF", minWidth: 120 }}
    >
      <div style={{ fontSize: 12, color: "#6B7185" }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 600, color: tone ?? "#1F2937", lineHeight: 1.2 }}>{value}</div>
    </button>
  );
}

function UsersContent() {
  const { message } = App.useApp();
  const currentUser = useCurrentUser();
  const params = useSearchParams();
  const { users, roles, addUser, updateUser, deleteUser, setUserActive } = useUserStore();
  const { employees, updateEmployee } = useMasterStore();
  const { adminResetPassword } = useAuth();
  const { modal } = App.useApp();
  const { masterDirektorat, getSubditOptions } = useMasterLists();
  const [editing, setEditing] = useState<Editing | null>(null);
  const [roleFilter, setRoleFilter] = useState<string>(params.get("role") ?? "all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [form] = Form.useForm<FormValues>();
  const directorate = Form.useWatch("directorate", form);
  const pickedRoles = Form.useWatch("roles", form);

  const linked = (u: AppUser) => employees.find((e) => e.userId === u.id);
  const deleteBlock = (u: AppUser): string => {
    if (u.id === currentUser.id) return "Akun yang sedang dipakai tidak bisa dihapus.";
    if (u.active && u.roles.includes(ADMIN_ROLE) && users.filter((x) => x.active && x.roles.includes(ADMIN_ROLE)).length <= 1) return "Harus ada minimal satu Administrator aktif.";
    const emp = linked(u);
    const inTeam = emp ? employeeUsage(emp.id) : 0;
    const created = projects.filter((p) => p.createdBy === u.id).length;
    if (inTeam > 0 || created > 0) return `Terkait ${inTeam + created} project (tim/pembuat). Nonaktifkan saja agar riwayat tetap utuh.`;
    return "";
  };

  const counts = useMemo(
    () => ({ all: users.length, active: users.filter((u) => u.active).length, inactive: users.filter((u) => !u.active).length, unlinked: users.filter((u) => !employees.some((e) => e.userId === u.id)).length }),
    [users, employees],
  );
  const rows = users.filter((u) => (roleFilter === "all" || u.roles.includes(roleFilter)) && (status === "all" || (status === "active" ? u.active : !u.active)));

  const initial: FormValues = useMemo(() => {
    if (!editing || editing.mode === "new") return { name: "", username: "", email: "", directorate: undefined as unknown as string, subdirectorate: undefined as unknown as string, roles: [], active: true };
    const u = editing.user;
    return { employeeId: employees.find((e) => e.userId === u.id)?.id, name: u.name, username: u.username, email: u.email, directorate: u.directorate, subdirectorate: u.subdirectorate, roles: u.roles, active: u.active };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  const editingId = editing?.mode === "edit" ? editing.user.id : null;
  const employeeOptions = employees
    .filter((e) => !e.userId || e.userId === editingId)
    .map((e) => ({ value: e.id, label: `${e.name} · ${e.subdirectorate}` }));

  function pickEmployee(id?: string) {
    const e = employees.find((x) => x.id === id);
    if (!e) return;
    form.setFieldsValue({ name: e.name, directorate: e.directorate, subdirectorate: e.subdirectorate });
    form.validateFields(["name", "directorate", "subdirectorate"]).catch(() => undefined);
  }

  function relink(userId: string, employeeId?: string) {
    const prev = employees.find((e) => e.userId === userId);
    if (prev && prev.id !== employeeId) updateEmployee(prev.id, { userId: undefined });
    if (employeeId) updateEmployee(employeeId, { userId });
  }

  function submit() {
    form
      .validateFields()
      .then((v) => {
        const input = { name: v.name.trim(), username: v.username.trim().toLowerCase(), email: v.email.trim(), directorate: v.directorate, subdirectorate: v.subdirectorate, roles: v.roles, active: v.active };
        if (editing?.mode === "edit") {
          const r = updateUser(editing.user.id, input);
          if (!r.ok) return void message.error(r.reason);
          relink(editing.user.id, v.employeeId);
          message.success("Pengguna diperbarui.");
        } else {
          const r = addUser(input);
          if (!r.ok) return void message.error(r.reason);
          relink(r.id, v.employeeId);
          message.success("Pengguna ditambahkan.");
        }
        setEditing(null);
      })
      .catch(() => undefined);
  }

  const visibleMenus = (rs: string[]) =>
    Object.entries(permissionsOf({ roles: rs }, roles))
      .filter(([, p]) => p.view)
      .map(([k]) => roles[0]?.permissions.find((p) => p.menuKey === k)?.menuLabel ?? k);

  return (
    <PageSkeleton path="/user-management/users">
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        title="Akun login aplikasi, terpisah dari Master Pegawai."
        description="Hubungkan akun ke pegawai agar orangnya dikenali sebagai PMO/Developer di project. Pendaftaran mandiri masuk sebagai “Menunggu persetujuan” dan harus kamu setujui. Login memakai password awal yang wajib diganti di login pertama. Data masih tersimpan di memori."
      />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
        <StatCard label="Semua pengguna" value={counts.all} on={status === "all"} onClick={() => setStatus("all")} />
        <StatCard label="Aktif" value={counts.active} on={status === "active"} onClick={() => setStatus("active")} tone="#17A34A" />
        <StatCard label="Nonaktif" value={counts.inactive} on={status === "inactive"} onClick={() => setStatus("inactive")} tone={counts.inactive ? "#F8285A" : undefined} />
        <Tooltip title="Akun yang belum dihubungkan ke Master Pegawai tidak dikenali sebagai anggota tim project.">
          <div style={{ padding: "10px 14px", borderRadius: 10, background: "#fff", border: "1px solid #E6ECEF", minWidth: 120 }}>
            <div style={{ fontSize: 12, color: "#6B7185" }}>Belum terhubung pegawai</div>
            <div style={{ fontSize: 22, fontWeight: 600, lineHeight: 1.2, color: counts.unlinked ? "#B7791F" : "#1F2937" }}>{counts.unlinked}</div>
          </div>
        </Tooltip>
      </div>

      <DataTable
        rowKey="id"
        scroll={{ x: 900 }}
        dataSource={rows}
        searchPlaceholder="Cari nama, username, email, direktorat, subdit, role..."
        toolbar={
          <Space wrap>
            <Button icon={<PlusOutlined />} type="primary" onClick={() => setEditing({ mode: "new" })}>
              Tambah Pengguna
            </Button>
            <Select
              value={roleFilter}
              onChange={setRoleFilter}
              style={{ minWidth: 180 }}
              options={[{ value: "all", label: "Semua role" }, ...roles.map((r) => ({ value: r.name, label: `${r.name} (${r.memberCount})` }))]}
            />
          </Space>
        }
        columns={[
          {
            title: "Nama",
            dataIndex: "name",
            searchValue: (r) => `${r.name} ${r.username} ${r.email}`,
            render: (v: string, r: AppUser) => (
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Avatar size="small" icon={<UserOutlined />} style={{ opacity: r.active ? 1 : 0.45 }} />
                <div>
                  <div style={{ fontWeight: 500, color: r.active ? undefined : "#8A90A2" }}>
                    {v} {r.id === currentUser.id && <Tag color="cyan" style={{ marginInlineStart: 4 }}>Anda</Tag>}{r.pending && <Tag color="warning" style={{ marginInlineStart: 4 }}>Menunggu persetujuan</Tag>}
                  </div>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    @{r.username} · {r.email}
                  </Text>
                </div>
              </div>
            ),
          },
          { title: "Direktorat / Subdit", dataIndex: "directorate", width: 230, filterable: true, searchValue: (r) => `${r.directorate} ${r.subdirectorate}`, render: (_: unknown, r: AppUser) => <Text style={{ fontSize: 13 }}>{r.directorate} · {r.subdirectorate}</Text> },
          {
            title: "Role",
            dataIndex: "roles",
            width: 130,
            render: (v: string[]) => (
              <Space size={4} wrap>
                {v.map((r) => (
                  <Tag key={r} color={r === ADMIN_ROLE ? "gold" : undefined} style={{ marginInlineEnd: 0 }}>
                    {r}
                  </Tag>
                ))}
              </Space>
            ),
          },
          {
            title: "Pegawai",
            width: 150,
            sortable: false,
            searchable: false,
            render: (_: unknown, r: AppUser) => {
              const e = linked(r);
              return e ? (
                <Tooltip title={`${e.directorate} · ${e.subdirectorate}`}>
                  <Tag color="green" style={{ marginInlineEnd: 0 }}>{e.name}</Tag>
                </Tooltip>
              ) : (
                <Tooltip title="Belum dihubungkan ke Master Pegawai, jadi tidak dikenali sebagai anggota tim project.">
                  <Tag color="warning" style={{ marginInlineEnd: 0 }}>belum terhubung</Tag>
                </Tooltip>
              );
            },
          },
          {
            title: "Status",
            dataIndex: "active",
            width: 100,
            searchable: false,
            render: (v: boolean, r: AppUser) => (
              <Switch
                size="small"
                checked={v}
                aria-label={`Status ${r.name}`}
                onChange={(on) => {
                  const res = setUserActive(r.id, on);
                  if (!res.ok) message.error(res.reason);
                  else message.success(on ? "Akun diaktifkan." : "Akun dinonaktifkan.");
                }}
              />
            ),
          },
          {
            title: "Aksi",
            width: 190,
            sortable: false,
            searchable: false,
            render: (_: unknown, r: AppUser) => {
              const why = deleteBlock(r);
              return (
                <Space>
                  {r.pending && (
                    <Button
                      size="small"
                      type="primary"
                      onClick={() => {
                        const res = setUserActive(r.id, true);
                        if (!res.ok) message.error(res.reason);
                        else message.success(`${r.name} disetujui dan diaktifkan. Cek role-nya bila perlu.`);
                      }}
                    >
                      Setujui
                    </Button>
                  )}
                  <Tooltip title="Reset password">
                    <Button
                      size="small"
                      icon={<KeyOutlined />}
                      aria-label={`Reset password ${r.name}`}
                      onClick={() =>
                        modal.confirm({
                          title: `Reset password ${r.name}?`,
                          content: "Password lama tidak berlaku lagi. Kamu akan mendapat password sementara; pengguna wajib menggantinya saat login berikutnya.",
                          okText: "Reset",
                          cancelText: "Batal",
                          onOk: () => {
                            const res = adminResetPassword(r.id);
                            if (!res.ok) return void message.error(res.reason);
                            modal.success({ title: "Password sementara", content: <div>Berikan ke <b>{r.name}</b> lewat jalur aman. Hanya ditampilkan sekali.<br /><Text code copyable>{res.tempPassword}</Text></div> });
                          },
                        })
                      }
                    />
                  </Tooltip>
                  <Button size="small" icon={<EditOutlined />} aria-label={`Ubah ${r.name}`} onClick={() => setEditing({ mode: "edit", user: r })} />
                  {why ? (
                    <Tooltip title={why}>
                      <Button size="small" danger icon={<DeleteOutlined />} aria-label={`Hapus ${r.name}`} disabled />
                    </Tooltip>
                  ) : (
                    <Popconfirm
                      title="Hapus pengguna ini?"
                      description={r.name}
                      okText="Hapus"
                      cancelText="Batal"
                      okButtonProps={{ danger: true }}
                      onConfirm={() => {
                        const res = deleteUser(r.id);
                        if (!res.ok) return void message.error(res.reason);
                        relink(r.id, undefined);
                        message.success("Pengguna dihapus.");
                      }}
                    >
                      <Button size="small" danger icon={<DeleteOutlined />} aria-label={`Hapus ${r.name}`} />
                    </Popconfirm>
                  )}
                </Space>
              );
            },
          },
        ]}
      />

      <Modal title={editing?.mode === "edit" ? "Ubah Pengguna" : "Tambah Pengguna"} open={editing !== null} onCancel={() => setEditing(null)} onOk={submit} okText="Simpan" cancelText="Batal" destroyOnHidden centered width={560} styles={{ body: { maxHeight: "68vh", overflowY: "auto", paddingTop: 8 } }}>
        <Form key={editingId ?? "new"} form={form} name="user" layout="vertical" initialValues={initial} preserve={false}>
          <Form.Item name="employeeId" label="Hubungkan ke Master Pegawai" extra="Pilih untuk mengisi nama, direktorat, dan subdit otomatis. Tanpa tautan, akun tidak dikenali sebagai anggota tim project.">
            <Select allowClear showSearch optionFilterProp="label" placeholder="Pilih pegawai (opsional)" options={employeeOptions} onChange={pickEmployee} />
          </Form.Item>
          <Form.Item name="name" label="Nama" rules={[{ required: true, whitespace: true, message: "Wajib diisi" }]}>
            <Input placeholder="Nama lengkap" maxLength={80} />
          </Form.Item>
          <Row gutter={12}>
            <Col xs={24} sm={12}>
              <Form.Item name="username" label="Username" rules={[{ required: true, message: "Wajib diisi" }, { pattern: /^[A-Za-z0-9._-]{3,30}$/, message: "3-30 karakter: huruf, angka, titik, strip" }]}>
                <Input placeholder="mis. rani.kusuma" autoComplete="off" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="email" label="Email" rules={[{ required: true, message: "Wajib diisi" }, { type: "email", message: "Email tidak valid" }]}>
                <Input placeholder="nama@company.co.id" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="directorate" label="Direktorat" rules={[{ required: true, message: "Wajib diisi" }]}>
                <Select placeholder="Pilih direktorat" options={masterDirektorat.map((d) => ({ label: d, value: d }))} onChange={() => form.setFieldsValue({ subdirectorate: undefined })} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="subdirectorate" label="Subdit" rules={[{ required: true, message: "Wajib diisi" }]}>
                <Select placeholder={directorate ? "Pilih subdit" : "Pilih direktorat dulu"} disabled={!directorate} options={getSubditOptions(directorate).map((s) => ({ label: s.subdirectorate, value: s.subdirectorate }))} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            name="roles"
            label="Role"
            rules={[{ required: true, message: "Pilih minimal satu role" }]}
            extra={pickedRoles?.length ? `Bisa membuka: ${visibleMenus(pickedRoles).join(", ") || "tidak ada menu"}. Hak gabungan dari semua role yang dipilih.` : "Hak akses gabungan dari semua role yang dipilih."}
          >
            <Select mode="multiple" placeholder="Pilih role" optionLabelProp="value" options={roles.map((r) => ({ label: r.name, value: r.name, desc: r.description }))} optionRender={(o) => (<div><div style={{ fontWeight: 500 }}>{o.label}</div><div style={{ fontSize: 12, color: "#8A90A2", whiteSpace: "normal" }}>{(o.data as { desc: string }).desc}</div></div>)} />
          </Form.Item>
          <Form.Item name="active" label="Status Aktif" valuePropName="checked" extra="Nonaktifkan akun tanpa menghapus, mis. saat orang pindah tugas.">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </PageSkeleton>
  );
}

// useSearchParams() wajib dibungkus Suspense di Next.js.
export default function UserManagementUsersPage() {
  return (
    <Suspense fallback={null}>
      <UsersContent />
    </Suspense>
  );
}
