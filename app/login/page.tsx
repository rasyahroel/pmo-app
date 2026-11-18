"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Alert, Button, Checkbox, Collapse, Form, Input, Tag, Typography } from "antd";
import { LockOutlined, UserOutlined } from "@ant-design/icons";
import AuthLayout from "@/components/auth/AuthLayout";
import { agi } from "@/app/providers";
import { useHydrated, useSession } from "@/lib/acting-user";
import { useAuth } from "@/lib/auth-store";
import { ALLOW_SELF_REGISTER, DEMO_MODE, INITIAL_PASSWORD } from "@/lib/auth-config";
import { useUserStore } from "@/lib/user-store";

const { Text } = Typography;
type Values = { identifier: string; password: string; remember?: boolean };

// hanya path internal (cegah open redirect lewat ?next=https://...)
const safeNext = (n: string | null) => (n && n.startsWith("/") && !n.startsWith("//") && !n.startsWith("/login") ? n : "/dashboard");

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const hydrated = useHydrated();
  const { session } = useSession();
  const { login } = useAuth();
  const { users } = useUserStore();
  const [form] = Form.useForm<Values>();
  const [error, setError] = useState<{ code: string; reason: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const next = safeNext(params.get("next"));
  const notice = params.get("reset") ? "Password berhasil diubah. Silakan masuk dengan password baru." : params.get("registered") ? "Pendaftaran terkirim. Kamu bisa masuk setelah Administrator menyetujui akunnya." : null;

  // sudah punya sesi -> tidak perlu login lagi
  useEffect(() => {
    if (hydrated && session) router.replace(next);
  }, [hydrated, session, next, router]);

  function submit(v: Values) {
    setLoading(true);
    setError(null);
    // simulasi latensi jaringan; di backend ini POST /auth/login
    setTimeout(() => {
      const r = login(v.identifier, v.password, !!v.remember);
      setLoading(false);
      if (!r.ok) return setError({ code: r.code, reason: r.reason });
      router.replace(next);
    }, 450);
  }

  return (
    <AuthLayout title="Masuk" subtitle="Gunakan akun yang dibuatkan administrator.">
      {notice && <Alert type="success" showIcon title={notice} style={{ marginBottom: 16 }} />}
      {error && <Alert type={error.code === "pending" ? "warning" : "error"} showIcon title={error.reason} style={{ marginBottom: 16 }} />}
      <Form<Values> form={form} layout="vertical" requiredMark={false} onFinish={submit} initialValues={{ remember: true }}>
        <Form.Item name="identifier" label="Email / Username" rules={[{ required: true, whitespace: true, message: "Wajib diisi" }]}>
          <Input size="large" prefix={<UserOutlined style={{ color: agi[500] }} />} placeholder="username atau nama@perusahaan.co.id" autoComplete="username" autoFocus />
        </Form.Item>
        <Form.Item name="password" label="Password" rules={[{ required: true, message: "Wajib diisi" }]}>
          <Input.Password size="large" prefix={<LockOutlined style={{ color: agi[500] }} />} placeholder="Password" autoComplete="current-password" />
        </Form.Item>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <Form.Item name="remember" valuePropName="checked" noStyle>
            <Checkbox>Ingat saya</Checkbox>
          </Form.Item>
          <Link href="/forgot-password" style={{ fontSize: 13 }}>Lupa password?</Link>
        </div>
        <Button type="primary" htmlType="submit" size="large" block loading={loading}>
          Masuk
        </Button>
      </Form>

      <div style={{ marginTop: 22, textAlign: "center", fontSize: 13 }}>
        {ALLOW_SELF_REGISTER ? (
          <>
            <Text type="secondary">Belum punya akun? </Text>
            <Link href="/register">Daftar</Link>
          </>
        ) : (
          <Text type="secondary">Belum punya akun? Akun dibuatkan Administrator; hubungi Administrator.</Text>
        )}
      </div>

      {DEMO_MODE && (
        <Collapse
          size="small"
          style={{ marginTop: 22 }}
          items={[
            {
              key: "demo",
              label: "Akun uji (hanya versi uji)",
              children: (
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Password awal semua akun: <Text code>{INITIAL_PASSWORD}</Text>. Login pertama akan meminta ganti password. Klik untuk mengisi.
                  </Text>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
                    {users.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => form.setFieldsValue({ identifier: u.username, password: INITIAL_PASSWORD })}
                        style={{ textAlign: "left", padding: "6px 10px", borderRadius: 8, border: "1px solid #E6ECEF", background: "#fff", cursor: "pointer", display: "flex", justifyContent: "space-between", gap: 8 }}
                      >
                        <span>
                          {u.username} <Text type="secondary" style={{ fontSize: 12 }}>· {u.roles.join(", ")}</Text>
                        </span>
                        {u.pending ? <Tag color="warning" style={{ marginInlineEnd: 0 }}>menunggu</Tag> : !u.active ? <Tag style={{ marginInlineEnd: 0 }}>nonaktif</Tag> : null}
                      </button>
                    ))}
                  </div>
                </div>
              ),
            },
          ]}
        />
      )}
    </AuthLayout>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
