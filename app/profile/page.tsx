"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import dayjs from "dayjs";
import { Alert, App, Avatar, Button, Card, Col, Descriptions, Form, Input, Row, Space, Tag, Typography } from "antd";
import { LockOutlined, LogoutOutlined, UserOutlined } from "@ant-design/icons";
import PageSkeleton from "@/components/layout/PageSkeleton";
import PasswordStrength from "@/components/auth/PasswordStrength";
import { agi } from "@/app/providers";
import { useCurrentUser, useHydrated, useSession } from "@/lib/acting-user";
import { useAuth } from "@/lib/auth-store";
import { useMasterStore } from "@/lib/master-store";
import { isStrong } from "@/lib/password-policy";
import { ADMIN_ROLE, useUserStore } from "@/lib/user-store";

const { Text } = Typography;
type InfoValues = { name: string; email: string };
type PwValues = { current: string; next: string; confirm: string };

function InfoCard() {
  const me = useCurrentUser();
  const { message } = App.useApp();
  const { updateUser } = useUserStore();
  const { employees } = useMasterStore();
  const linked = employees.find((e) => e.userId === me.id);
  const [form] = Form.useForm<InfoValues>();

  function save(v: InfoValues) {
    const { id, ...rest } = me;
    void id;
    const r = updateUser(me.id, { ...rest, name: v.name.trim(), email: v.email.trim() });
    if (!r.ok) return void message.error(r.reason);
    message.success("Profil diperbarui.");
  }

  return (
    <Card title="Data akun">
      <Form<InfoValues> key={`${me.id}-${me.name}-${me.email}`} form={form} layout="vertical" requiredMark={false} initialValues={{ name: me.name, email: me.email }} onFinish={save}>
        <Form.Item name="name" label="Nama" rules={[{ required: true, whitespace: true, message: "Wajib diisi" }]}>
          <Input maxLength={80} />
        </Form.Item>
        <Form.Item name="email" label="Email" extra="Dipakai untuk menerima tautan reset password." rules={[{ required: true, message: "Wajib diisi" }, { type: "email", message: "Email tidak valid" }]}>
          <Input />
        </Form.Item>
        <Button type="primary" htmlType="submit">Simpan perubahan</Button>
      </Form>
      <Descriptions
        size="small"
        column={1}
        style={{ marginTop: 24 }}
        title={<Text type="secondary" style={{ fontSize: 13, fontWeight: 500 }}>Dikelola Administrator</Text>}
        items={[
          { key: "u", label: "Username", children: me.username },
          { key: "r", label: "Role", children: <Space size={4} wrap>{me.roles.map((r) => <Tag key={r} color={r === ADMIN_ROLE ? "gold" : undefined} style={{ marginInlineEnd: 0 }}>{r}</Tag>)}</Space> },
          { key: "d", label: "Direktorat", children: me.directorate },
          { key: "s", label: "Subdit", children: me.subdirectorate },
          { key: "e", label: "Master Pegawai", children: linked ? <Tag color="green" style={{ marginInlineEnd: 0 }}>{linked.name}</Tag> : <Tag color="warning" style={{ marginInlineEnd: 0 }}>belum terhubung</Tag> },
        ]}
      />
      <Text type="secondary" style={{ fontSize: 12 }}>Untuk mengubah username, role, atau unit kerja, hubungi Administrator.</Text>
    </Card>
  );
}

function SecurityCard() {
  const me = useCurrentUser();
  const router = useRouter();
  const hydrated = useHydrated();
  const { message } = App.useApp();
  const { session, signOut } = useSession();
  const { changePassword, passwordChangedAt } = useAuth();
  const [form] = Form.useForm<PwValues>();
  const next = Form.useWatch("next", form);
  const [error, setError] = useState<string | null>(null);
  const changedAt = passwordChangedAt(me.id);

  function submit(v: PwValues) {
    const r = changePassword(me.id, v.current, v.next);
    if (!r.ok) return setError(r.reason);
    setError(null);
    form.resetFields();
    message.success("Password berhasil diganti.");
  }

  return (
    <Card title="Keamanan">
      <Text type="secondary" style={{ fontSize: 13 }}>
        Password terakhir diganti: {hydrated ? (changedAt ? dayjs(changedAt).format("D MMM YYYY, HH.mm") : "belum pernah di sesi ini (password awal / lama)") : "—"}
      </Text>
      {error && <Alert type="error" showIcon title={error} style={{ margin: "12px 0 0" }} />}
      <Form<PwValues> form={form} layout="vertical" requiredMark={false} onFinish={submit} style={{ marginTop: 16 }}>
        <Form.Item name="current" label="Password saat ini" rules={[{ required: true, message: "Wajib diisi" }]}>
          <Input.Password prefix={<LockOutlined />} autoComplete="current-password" />
        </Form.Item>
        <Form.Item name="next" label="Password baru" rules={[{ required: true, message: "Wajib diisi" }, { validator: (_, v) => (!v || isStrong(v, me) ? Promise.resolve() : Promise.reject(new Error("Belum memenuhi syarat di bawah"))) }]}>
          <Input.Password prefix={<LockOutlined />} autoComplete="new-password" />
        </Form.Item>
        <PasswordStrength value={next} username={me.username} email={me.email} />
        <Form.Item
          name="confirm"
          label="Ulangi password baru"
          dependencies={["next"]}
          rules={[{ required: true, message: "Wajib diisi" }, ({ getFieldValue }) => ({ validator: (_, v) => (!v || getFieldValue("next") === v ? Promise.resolve() : Promise.reject(new Error("Tidak sama dengan password baru"))) })]}
        >
          <Input.Password prefix={<LockOutlined />} autoComplete="new-password" />
        </Form.Item>
        <Button type="primary" htmlType="submit">Ganti password</Button>
      </Form>

      <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid #EEF2F4", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          <div style={{ fontWeight: 500 }}>Sesi ini</div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {hydrated && session ? `Berlaku sampai ${dayjs(session.expiresAt).format("D MMM YYYY, HH.mm")}${session.remember ? " (Ingat saya)" : ""}` : "—"}
          </Text>
        </div>
        <Button
          icon={<LogoutOutlined />}
          onClick={() => {
            signOut();
            router.replace("/login");
          }}
        >
          Keluar
        </Button>
      </div>
    </Card>
  );
}

export default function ProfilePage() {
  const me = useCurrentUser();
  return (
    <PageSkeleton path="/profile">
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Avatar size={56} icon={<UserOutlined />} style={{ background: agi[500] }} />
          <div>
            <div style={{ fontSize: 18, fontWeight: 600 }}>{me.name}</div>
            <Text type="secondary">@{me.username} · {me.email}</Text>
          </div>
        </div>
      </Card>
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}><InfoCard /></Col>
        <Col xs={24} lg={12}><SecurityCard /></Col>
      </Row>
    </PageSkeleton>
  );
}
