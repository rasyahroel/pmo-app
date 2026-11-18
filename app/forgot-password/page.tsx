"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alert, Button, Form, Input, Typography } from "antd";
import { ArrowLeftOutlined, UserOutlined } from "@ant-design/icons";
import AuthLayout from "@/components/auth/AuthLayout";
import { agi } from "@/app/providers";
import { useAuth } from "@/lib/auth-store";
import { DEMO_MODE, RESEND_COOLDOWN_SECONDS, RESET_TOKEN_MINUTES } from "@/lib/auth-config";

const { Text } = Typography;

export default function ForgotPasswordPage() {
  const router = useRouter();
  const { requestReset } = useAuth();
  const [form] = Form.useForm<{ identifier: string }>();
  const [sent, setSent] = useState<{ identifier: string; demoToken?: string; expiresAt?: string } | null>(null);
  const [wait, setWait] = useState(0);
  const [loading, setLoading] = useState(false);

  // jeda sebelum boleh kirim ulang (di backend: rate limit per akun dan per IP)
  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  function send(identifier: string) {
    setLoading(true);
    setTimeout(() => {
      setSent({ identifier, ...requestReset(identifier) });
      setWait(RESEND_COOLDOWN_SECONDS);
      setLoading(false);
    }, 450);
  }

  return (
    <AuthLayout title="Lupa password" subtitle="Masukkan username atau email akunmu. Kami kirim tautan untuk membuat password baru.">
      {sent ? (
        <div>
          {/* Pesan sama untuk akun ada maupun tidak, supaya orang asing tidak bisa mengecek akun mana yang terdaftar. */}
          <Alert type="success" showIcon title="Permintaan diterima" description={`Jika akun “${sent.identifier}” terdaftar dan aktif, tautan reset dikirim ke email terkait dan berlaku ${RESET_TOKEN_MINUTES} menit. Periksa juga folder spam.`} />
          {DEMO_MODE && (
            <Alert
              style={{ marginTop: 12 }}
              type="warning"
              showIcon
              title="Versi uji: belum ada email"
              description={
                sent.demoToken ? (
                  <div>
                    <div style={{ marginBottom: 8 }}>Biasanya tautan ada di email. Untuk mencoba, buka langsung halaman reset (berlaku sampai {sent.expiresAt}).</div>
                    <Button size="small" type="primary" onClick={() => router.push(`/reset-password?token=${sent.demoToken}`)}>
                      Buka halaman reset
                    </Button>
                  </div>
                ) : (
                  "Akun tidak ditemukan atau belum aktif, jadi tidak ada tautan. Di produksi pesan di atas tetap sama."
                )
              }
            />
          )}
          <Button block style={{ marginTop: 16 }} disabled={wait > 0} loading={loading} onClick={() => send(sent.identifier)}>
            {wait > 0 ? `Kirim ulang dalam ${wait} dtk` : "Kirim ulang"}
          </Button>
        </div>
      ) : (
        <Form form={form} layout="vertical" requiredMark={false} onFinish={(v) => send(v.identifier.trim())}>
          <Form.Item name="identifier" label="Email / Username" rules={[{ required: true, whitespace: true, message: "Wajib diisi" }]}>
            <Input size="large" prefix={<UserOutlined style={{ color: agi[500] }} />} placeholder="username atau nama@perusahaan.co.id" autoFocus />
          </Form.Item>
          <Button type="primary" htmlType="submit" size="large" block loading={loading}>
            Kirim tautan reset
          </Button>
        </Form>
      )}
      <div style={{ marginTop: 20, textAlign: "center", fontSize: 13 }}>
        <Link href="/login"><ArrowLeftOutlined /> Kembali ke halaman masuk</Link>
        <div style={{ marginTop: 6 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>Tidak punya akses email? Hubungi Administrator untuk reset manual.</Text>
        </div>
      </div>
    </AuthLayout>
  );
}
