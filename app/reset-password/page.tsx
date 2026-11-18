"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Alert, Button, Form, Input, Result } from "antd";
import { LockOutlined } from "@ant-design/icons";
import AuthLayout from "@/components/auth/AuthLayout";
import PasswordStrength from "@/components/auth/PasswordStrength";
import { agi } from "@/app/providers";
import { useAuth } from "@/lib/auth-store";
import { isStrong } from "@/lib/password-policy";

const WHY: Record<string, string> = {
  invalid: "Tautan reset tidak dikenali.",
  expired: "Tautan reset sudah kedaluwarsa.",
  used: "Tautan reset sudah dipakai atau digantikan tautan yang lebih baru.",
};

function ResetForm() {
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";
  const { checkResetToken, resetPassword } = useAuth();
  const [form] = Form.useForm<{ password: string; confirm: string }>();
  const password = Form.useWatch("password", form);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const status = checkResetToken(token);

  if (status !== "valid")
    return (
      <AuthLayout title="Buat password baru">
        <Result
          status="warning"
          title={WHY[status]}
          subTitle="Minta tautan baru dari halaman lupa password."
          extra={<Button type="primary" onClick={() => router.push("/forgot-password")}>Minta tautan baru</Button>}
          style={{ padding: "8px 0" }}
        />
      </AuthLayout>
    );

  function submit(v: { password: string }) {
    setLoading(true);
    setError(null);
    setTimeout(() => {
      const r = resetPassword(token, v.password);
      setLoading(false);
      if (!r.ok) return setError(r.reason);
      router.replace("/login?reset=1");
    }, 450);
  }

  return (
    <AuthLayout title="Buat password baru" subtitle="Pilih password yang belum pernah kamu pakai di tempat lain.">
      {error && <Alert type="error" showIcon title={error} style={{ marginBottom: 16 }} />}
      <Form form={form} layout="vertical" requiredMark={false} onFinish={submit}>
        <Form.Item name="password" label="Password baru" rules={[{ required: true, message: "Wajib diisi" }, { validator: (_, v) => (!v || isStrong(v) ? Promise.resolve() : Promise.reject(new Error("Belum memenuhi syarat di bawah"))) }]}>
          <Input.Password size="large" prefix={<LockOutlined style={{ color: agi[500] }} />} autoComplete="new-password" autoFocus />
        </Form.Item>
        <PasswordStrength value={password} />
        <Form.Item
          name="confirm"
          label="Ulangi password baru"
          dependencies={["password"]}
          rules={[{ required: true, message: "Wajib diisi" }, ({ getFieldValue }) => ({ validator: (_, v) => (!v || getFieldValue("password") === v ? Promise.resolve() : Promise.reject(new Error("Tidak sama dengan password baru"))) })]}
        >
          <Input.Password size="large" prefix={<LockOutlined style={{ color: agi[500] }} />} autoComplete="new-password" />
        </Form.Item>
        <Button type="primary" htmlType="submit" size="large" block loading={loading}>
          Simpan password baru
        </Button>
      </Form>
      <div style={{ marginTop: 20, textAlign: "center", fontSize: 13 }}>
        <Link href="/login">Kembali ke halaman masuk</Link>
      </div>
    </AuthLayout>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetForm />
    </Suspense>
  );
}
