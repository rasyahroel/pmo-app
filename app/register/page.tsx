"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alert, Button, Col, Form, Input, Result, Row, Select, Typography } from "antd";
import { LockOutlined, MailOutlined, UserOutlined } from "@ant-design/icons";
import AuthLayout from "@/components/auth/AuthLayout";
import PasswordStrength from "@/components/auth/PasswordStrength";
import { agi } from "@/app/providers";
import { useAuth } from "@/lib/auth-store";
import { ALLOW_SELF_REGISTER } from "@/lib/auth-config";
import { useMasterLists } from "@/lib/master-store";
import { isStrong } from "@/lib/password-policy";

const { Text } = Typography;
type Values = { name: string; username: string; email: string; directorate: string; subdirectorate: string; password: string; confirm: string };

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();
  const { masterDirektorat, getSubditOptions } = useMasterLists();
  const [form] = Form.useForm<Values>();
  const directorate = Form.useWatch("directorate", form);
  const password = Form.useWatch("password", form);
  const username = Form.useWatch("username", form);
  const email = Form.useWatch("email", form);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // pendaftaran mandiri dimatikan (ALLOW_SELF_REGISTER): halaman ini tidak tersedia
  useEffect(() => {
    if (!ALLOW_SELF_REGISTER) router.replace("/login");
  }, [router]);
  if (!ALLOW_SELF_REGISTER) return null;

  function submit(v: Values) {
    setLoading(true);
    setError(null);
    setTimeout(() => {
      const r = register({ name: v.name.trim(), username: v.username.trim().toLowerCase(), email: v.email.trim(), directorate: v.directorate, subdirectorate: v.subdirectorate, password: v.password });
      setLoading(false);
      if (!r.ok) return setError(r.reason);
      setDone(v.name.trim());
    }, 450);
  }

  if (done)
    return (
      <AuthLayout title="Pendaftaran terkirim">
        <Result
          status="success"
          title={`Terima kasih, ${done}`}
          subTitle="Akunmu menunggu persetujuan Administrator. Setelah disetujui dan diberi role, kamu bisa masuk dengan username dan password yang baru dibuat."
          extra={<Button type="primary" onClick={() => router.push("/login?registered=1")}>Ke halaman masuk</Button>}
          style={{ padding: "8px 0" }}
        />
      </AuthLayout>
    );

  return (
    <AuthLayout title="Daftar akun" subtitle="Akun baru perlu disetujui Administrator sebelum bisa dipakai." width={520}>
      {error && <Alert type="error" showIcon title={error} style={{ marginBottom: 16 }} />}
      <Form<Values> form={form} layout="vertical" requiredMark={false} onFinish={submit}>
        <Form.Item name="name" label="Nama lengkap" rules={[{ required: true, whitespace: true, message: "Wajib diisi" }]}>
          <Input prefix={<UserOutlined style={{ color: agi[500] }} />} maxLength={80} autoComplete="name" autoFocus />
        </Form.Item>
        <Row gutter={12}>
          <Col xs={24} sm={12}>
            <Form.Item name="username" label="Username" rules={[{ required: true, message: "Wajib diisi" }, { pattern: /^[A-Za-z0-9._-]{3,30}$/, message: "3-30 karakter: huruf, angka, titik, strip" }]}>
              <Input placeholder="mis. rani.kusuma" autoComplete="username" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item name="email" label="Email kantor" rules={[{ required: true, message: "Wajib diisi" }, { type: "email", message: "Email tidak valid" }]}>
              <Input prefix={<MailOutlined style={{ color: agi[500] }} />} placeholder="nama@company.co.id" autoComplete="email" />
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
        <Form.Item name="password" label="Password" rules={[{ required: true, message: "Wajib diisi" }, { validator: (_, v) => (!v || isStrong(v, { username, email }) ? Promise.resolve() : Promise.reject(new Error("Belum memenuhi syarat di bawah"))) }]}>
          <Input.Password prefix={<LockOutlined style={{ color: agi[500] }} />} autoComplete="new-password" />
        </Form.Item>
        <PasswordStrength value={password} username={username} email={email} />
        <Form.Item
          name="confirm"
          label="Ulangi password"
          dependencies={["password"]}
          rules={[{ required: true, message: "Wajib diisi" }, ({ getFieldValue }) => ({ validator: (_, v) => (!v || getFieldValue("password") === v ? Promise.resolve() : Promise.reject(new Error("Tidak sama dengan password"))) })]}
        >
          <Input.Password prefix={<LockOutlined style={{ color: agi[500] }} />} autoComplete="new-password" />
        </Form.Item>
        <Button type="primary" htmlType="submit" size="large" block loading={loading}>
          Kirim pendaftaran
        </Button>
      </Form>
      <div style={{ marginTop: 18, textAlign: "center", fontSize: 13 }}>
        <Text type="secondary">Sudah punya akun? </Text>
        <Link href="/login">Masuk</Link>
      </div>
    </AuthLayout>
  );
}
