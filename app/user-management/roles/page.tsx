"use client";

import { useMemo, useState } from "react";
import { Alert, App, Button, Checkbox, Form, Input, Modal, Popconfirm, Select, Space, Table, Tag, Tooltip, Typography } from "antd";
import { CopyOutlined, DeleteOutlined, EditOutlined, LockOutlined, PlusOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import Link from "next/link";
import PageSkeleton from "@/components/layout/PageSkeleton";
import type { RolePermission } from "@/lib/mock-data";
import { ADMIN_ROLE, PERM_KEYS, PERM_LABEL, useUserStore, type PermKey } from "@/lib/user-store";

const { Text, Title } = Typography;

// Penjelasan singkat apa arti Tambah/Ubah/Hapus di tiap menu, supaya PMO tidak menebak-nebak.
const MENU_HINT: Record<string, string> = {
  dashboard: "Hanya dibaca.",
  projects: "Tambah = buat project; Ubah = data, tim, fase, dokumen, environment; Hapus = hapus project.",
  tasks: "Tambah = buat task/sub task; Ubah = edit, pindah status, review; Hapus = hapus task.",
  meetings: "Tambah = jadwalkan rapat; Ubah = jadwal, peserta, hasil, tindak lanjut; Hapus = hapus rapat.",
  timeline: "Hanya dibaca (jadwal dihitung dari data lain).",
  testing: "Tambah/Ubah = catat dan ubah status pengujian; Hapus = hapus catatan pengujian.",
  reports: "Hanya dibaca dan ekspor.",
  "audit-trail": "Hanya dibaca dan ekspor; tidak ada tambah/ubah/hapus untuk siapa pun.",
  library: "Tambah/Ubah/Hapus = kelola artikel Daftar Pustaka.",
  "master-data": "Tambah/Ubah/Hapus = kelola semua master (vendor, status task, pegawai, dll).",
  "user-management": "Kelola akun pengguna, role, dan matriks ini.",
};

type Mode = { kind: "new" } | { kind: "edit"; id: string } | { kind: "copy"; id: string };
type FormValues = { name: string; description: string; copyFromId?: string };

export default function UserManagementRolesPage() {
  const { message } = App.useApp();
  const { roles, users, addRole, updateRole, deleteRole, setPermissions } = useUserStore();
  const [selectedId, setSelectedId] = useState<string>(roles[0]?.id ?? "");
  const [mode, setMode] = useState<Mode | null>(null);
  const [form] = Form.useForm<FormValues>();

  const role = roles.find((r) => r.id === selectedId) ?? roles[0];
  const isAdmin = role?.name === ADMIN_ROLE;
  const members = useMemo(() => (role ? users.filter((u) => u.roles.includes(role.name)) : []), [users, role]);
  const modeRole = mode && mode.kind !== "new" ? roles.find((r) => r.id === mode.id) : undefined;

  const initial: FormValues = useMemo(() => {
    if (!mode) return { name: "", description: "" };
    if (mode.kind === "edit" && modeRole) return { name: modeRole.name, description: modeRole.description };
    if (mode.kind === "copy" && modeRole) return { name: `${modeRole.name} (salinan)`, description: modeRole.description, copyFromId: modeRole.id };
    return { name: "", description: "" };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  function submit() {
    form
      .validateFields()
      .then((v) => {
        if (mode?.kind === "edit") {
          const r = updateRole(mode.id, v);
          if (!r.ok) return void message.error(r.reason);
          message.success("Role diperbarui.");
        } else {
          const r = addRole(v);
          if (!r.ok) return void message.error(r.reason);
          setSelectedId(r.id);
          message.success("Role ditambahkan. Atur akses menunya di tabel.");
        }
        setMode(null);
      })
      .catch(() => undefined);
  }

  function toggle(menuKeys: string[], keys: PermKey[], value: boolean) {
    if (!role) return;
    const r = setPermissions(role.id, menuKeys, keys, value);
    if (!r.ok) message.error(r.reason);
  }

  if (!role) return null;
  const allMenus = role.permissions.map((p) => p.menuKey);
  const viewable = role.permissions.filter((p) => p.view).length;

  const colState = (k: PermKey) => {
    const n = role.permissions.filter((p) => p[k]).length;
    return { all: n === role.permissions.length, some: n > 0 && n < role.permissions.length };
  };

  const columns: ColumnsType<RolePermission> = [
    {
      title: "Menu",
      dataIndex: "menuLabel",
      width: 300,
      render: (v: string, r) => (
        <div>
          <div style={{ fontWeight: 500 }}>{v}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>{MENU_HINT[r.menuKey]}</Text>
        </div>
      ),
    },
    ...PERM_KEYS.map((k) => {
      const s = colState(k);
      return {
        title: (
          <Checkbox checked={s.all} indeterminate={s.some} disabled={isAdmin} onChange={(e) => toggle(allMenus, [k], e.target.checked)} aria-label={`Semua menu: ${PERM_LABEL[k]}`}>
            {PERM_LABEL[k]}
          </Checkbox>
        ),
        key: k,
        width: 110,
        render: (_: unknown, r: RolePermission) => <Checkbox checked={r[k]} disabled={isAdmin} onChange={(e) => toggle([r.menuKey], [k], e.target.checked)} aria-label={`${r.menuLabel}: ${PERM_LABEL[k]}`} />,
      };
    }),
    {
      title: "Semua",
      key: "all",
      width: 90,
      render: (_: unknown, r: RolePermission) => {
        const n = PERM_KEYS.filter((k) => r[k]).length;
        return <Checkbox checked={n === 4} indeterminate={n > 0 && n < 4} disabled={isAdmin} onChange={(e) => toggle([r.menuKey], PERM_KEYS, e.target.checked)} aria-label={`${r.menuLabel}: semua`} />;
      },
    },
  ];

  return (
    <PageSkeleton path="/user-management/roles">
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        title="Matriks ini mengatur akses tingkat menu."
        description="Aturan yang lebih rinci (misalnya hanya PIC dan PMO project yang bisa mengubah task) tetap berlaku dan dijelaskan di Daftar Pustaka › Hak Akses. Login belum aktif di versi uji, jadi matriks belum ditegakkan; perubahan tersimpan di memori."
      />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "flex-start" }}>
        <nav aria-label="Daftar role" style={{ flex: "0 0 270px", maxWidth: "100%" }}>
          <Button block type="primary" icon={<PlusOutlined />} onClick={() => setMode({ kind: "new" })} style={{ marginBottom: 12 }}>
            Tambah Role
          </Button>
          {roles.map((r) => {
            const on = r.id === role.id;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => setSelectedId(r.id)}
                aria-current={on ? "true" : undefined}
                style={{ display: "block", width: "100%", textAlign: "left", cursor: "pointer", padding: "10px 12px", marginBottom: 6, borderRadius: 10, background: on ? "#E3F6F8" : "#fff", borderStyle: "solid", borderWidth: 1, borderColor: on ? "#7BDDE5" : "#E6ECEF" }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                  <span style={{ fontWeight: 600, color: on ? "#206D7E" : "#1F2937" }}>
                    {r.name} {r.name === ADMIN_ROLE && <LockOutlined style={{ fontSize: 12, color: "#8A90A2" }} />}
                  </span>
                  <Tag style={{ marginInlineEnd: 0 }}>{r.memberCount} pengguna</Tag>
                </div>
                <div style={{ fontSize: 12, color: "#6B7185", marginTop: 2 }}>{r.permissions.filter((p) => p.view).length} dari {r.permissions.length} menu bisa dilihat</div>
              </button>
            );
          })}
        </nav>

        <div style={{ flex: "1 1 560px", minWidth: 0 }}>
          <div style={{ background: "#fff", border: "1px solid #E6ECEF", borderRadius: 10, padding: 20 }}>
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
              <div style={{ minWidth: 0 }}>
                <Title level={4} style={{ margin: 0 }}>
                  {role.name} {isAdmin && <Tag color="gold">bawaan</Tag>}
                </Title>
                <Text type="secondary">{role.description}</Text>
              </div>
              <Space wrap>
                <Button icon={<EditOutlined />} onClick={() => setMode({ kind: "edit", id: role.id })}>Ubah</Button>
                <Button icon={<CopyOutlined />} onClick={() => setMode({ kind: "copy", id: role.id })}>Duplikat</Button>
                {isAdmin || members.length > 0 ? (
                  <Tooltip title={isAdmin ? "Role Administrator tidak bisa dihapus." : `Masih dipakai ${members.length} pengguna. Pindahkan role mereka dulu.`}>
                    <Button danger icon={<DeleteOutlined />} disabled>Hapus</Button>
                  </Tooltip>
                ) : (
                  <Popconfirm
                    title="Hapus role ini?"
                    description={role.name}
                    okText="Hapus"
                    cancelText="Batal"
                    okButtonProps={{ danger: true }}
                    onConfirm={() => {
                      const r = deleteRole(role.id);
                      if (!r.ok) return void message.error(r.reason);
                      setSelectedId(roles.find((x) => x.id !== role.id)?.id ?? "");
                      message.success("Role dihapus.");
                    }}
                  >
                    <Button danger icon={<DeleteOutlined />}>Hapus</Button>
                  </Popconfirm>
                )}
              </Space>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", marginBottom: 12 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>Anggota ({members.length}):</Text>
              {members.length === 0 && <Text type="secondary" style={{ fontSize: 12 }}>belum ada</Text>}
              {members.map((u) => (
                <Tag key={u.id} color={u.active ? undefined : "default"} style={{ marginInlineEnd: 0, opacity: u.active ? 1 : 0.55 }}>{u.name}</Tag>
              ))}
              {members.length > 0 && (
                <Link href={`/user-management/users?role=${encodeURIComponent(role.name)}`} style={{ fontSize: 12 }}>
                  Lihat di Pengguna
                </Link>
              )}
            </div>

            {isAdmin && (
              <Alert type="warning" showIcon icon={<LockOutlined />} style={{ marginBottom: 12 }} title="Administrator selalu punya akses penuh dan tidak bisa diubah, supaya tidak ada yang terkunci dari Master Data dan Manajemen User." />
            )}

            <Table<RolePermission> rowKey="menuKey" size="middle" pagination={false} scroll={{ x: 820 }} tableLayout="fixed" dataSource={role.permissions} columns={columns} />
            <Text type="secondary" style={{ display: "block", marginTop: 10, fontSize: 12 }}>
              Memberi Tambah, Ubah, atau Hapus otomatis memberi Lihat; mencabut Lihat mencabut semuanya di menu itu. {viewable === 0 && !isAdmin ? "Role ini belum bisa membuka menu apa pun." : ""}
            </Text>
          </div>
        </div>
      </div>

      <Modal title={mode?.kind === "edit" ? "Ubah Role" : mode?.kind === "copy" ? "Duplikat Role" : "Tambah Role"} open={mode !== null} onCancel={() => setMode(null)} onOk={submit} okText="Simpan" cancelText="Batal" destroyOnHidden centered>
        <Form key={mode ? `${mode.kind}-${"id" in mode ? mode.id : "new"}` : "x"} form={form} name="role" layout="vertical" initialValues={initial} preserve={false}>
          <Form.Item name="name" label="Nama Role" rules={[{ required: true, whitespace: true, message: "Wajib diisi" }]} extra={modeRole?.name === ADMIN_ROLE ? "Nama role Administrator tidak bisa diubah." : mode?.kind === "edit" ? "Mengganti nama ikut memperbarui semua pengguna yang memakai role ini." : undefined}>
            <Input placeholder="mis. Vendor Partner" maxLength={40} disabled={mode?.kind === "edit" && modeRole?.name === ADMIN_ROLE} />
          </Form.Item>
          <Form.Item name="description" label="Deskripsi" rules={[{ required: true, whitespace: true, message: "Wajib diisi" }]}>
            <Input.TextArea rows={2} placeholder="Peran dan cakupan akses role ini" maxLength={160} showCount />
          </Form.Item>
          {mode?.kind !== "edit" && (
            <Form.Item name="copyFromId" label="Salin hak akses dari" extra="Kosongkan untuk mulai tanpa akses apa pun.">
              <Select allowClear placeholder="Tidak menyalin" options={roles.map((r) => ({ value: r.id, label: r.name }))} />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </PageSkeleton>
  );
}
