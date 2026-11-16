"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Form, Input, Button, Checkbox, Typography, Divider, message } from "antd";
import {
  UserOutlined,
  LockOutlined,
  SafetyCertificateOutlined,
  ProjectOutlined,
  FileDoneOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import { agi } from "@/app/providers";

const { Title, Text } = Typography;

type LoginValues = { username: string; password: string; remember?: boolean };

const FEATURES = [
  { icon: <ProjectOutlined />, title: "Pantau project", desc: "Fase, progres, dan status semua project di satu tempat." },
  { icon: <FileDoneOutlined />, title: "Kelola dokumen & approval", desc: "Dokumen per fase lengkap dengan alur persetujuannya." },
  { icon: <TeamOutlined />, title: "Kerja bareng tim project", desc: "Hanya PMO dan developer yang terlibat yang punya akses." },
];

const CSS = `
.lg-split{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);min-height:100vh}
.lg-aside{position:relative;overflow:hidden;display:flex;flex-direction:column;justify-content:space-between;padding:48px 56px;color:#fff;background:linear-gradient(160deg,${agi[950]} 0%,${agi[900]} 55%,${agi[700]} 100%)}
.lg-panel{display:flex;align-items:center;justify-content:center;padding:32px 24px;background:#fff}
.lg-blob{position:absolute;border-radius:50%;pointer-events:none}
@media (max-width:900px){.lg-split{grid-template-columns:1fr}.lg-aside{display:none}.lg-panel{background:#F3FAFB}}
`;

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  function handleSubmit(values: LoginValues) {
    setLoading(true);
    // TODO: ganti dengan POST ke backend Go (mis. /api/auth/login). Session-nya
    // nanti berupa cookie httpOnly, jadi frontend tidak perlu menyimpan token.
    console.debug("login (demo)", values.username);
    setTimeout(() => {
      setLoading(false);
      message.success("Berhasil masuk (mode demo).");
      router.push("/dashboard");
    }, 600);
  }

  return (
    <div className="lg-split">
      <style>{CSS}</style>

      <aside className="lg-aside">
        <span className="lg-blob" style={{ width: 420, height: 420, top: -160, right: -140, background: `radial-gradient(circle, ${agi[500]}55, transparent 70%)` }} />
        <span className="lg-blob" style={{ width: 360, height: 360, bottom: -150, left: -120, background: `radial-gradient(circle, ${agi[400]}33, transparent 70%)` }} />

        <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/favicon.ico" alt="Logo" width={26} height={26} />
          </div>
          <div style={{ lineHeight: 1.2 }}>
            <div style={{ fontWeight: 700, fontSize: 16 }}>Project Management</div>
            <div style={{ color: agi[300], fontSize: 12, letterSpacing: 0.3 }}>PMO Internal</div>
          </div>
        </div>

        <div style={{ position: "relative", maxWidth: 460 }}>
          <Title level={2} style={{ color: "#fff", margin: "0 0 12px", lineHeight: 1.25 }}>
            Semua project, dokumen, dan progres tim dalam satu tempat.
          </Title>
          <Text style={{ color: agi[100], fontSize: 15 }}>
            Aplikasi internal untuk PMO dan tim developer yang mengerjakan project.
          </Text>
          <div style={{ display: "flex", flexDirection: "column", gap: 18, marginTop: 36 }}>
            {FEATURES.map((f) => (
              <div key={f.title} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, background: `${agi[400]}26`, border: `1px solid ${agi[400]}55`, color: agi[300] }}>
                  {f.icon}
                </div>
                <div>
                  <div style={{ fontWeight: 600 }}>{f.title}</div>
                  <div style={{ color: agi[100], fontSize: 13.5, opacity: 0.85 }}>{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ position: "relative", color: agi[300], fontSize: 12 }}>
          Akses terbatas untuk pengguna yang terdaftar.
        </div>
      </aside>

      <main className="lg-panel">
        <div style={{ width: "100%", maxWidth: 400 }}>
          <Title level={3} style={{ margin: 0 }}>Masuk</Title>
          <Text type="secondary">Gunakan akun yang dibuatkan oleh administrator.</Text>

          <Form<LoginValues>
            layout="vertical"
            requiredMark={false}
            onFinish={handleSubmit}
            initialValues={{ remember: true }}
            style={{ marginTop: 28 }}
          >
            <Form.Item name="username" label="Email / Username" rules={[{ required: true, message: "Wajib diisi" }]}>
              <Input size="large" prefix={<UserOutlined style={{ color: agi[500] }} />} placeholder="nama@perusahaan.co.id" autoComplete="username" autoFocus />
            </Form.Item>
            <Form.Item name="password" label="Password" rules={[{ required: true, message: "Wajib diisi" }]}>
              <Input.Password size="large" prefix={<LockOutlined style={{ color: agi[500] }} />} placeholder="Password" autoComplete="current-password" />
            </Form.Item>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <Form.Item name="remember" valuePropName="checked" noStyle>
                <Checkbox>Ingat saya</Checkbox>
              </Form.Item>
              <a onClick={() => message.info("Hubungi administrator untuk mereset password.")} style={{ fontSize: 13 }}>
                Lupa password?
              </a>
            </div>
            <Button type="primary" htmlType="submit" size="large" block loading={loading}>
              Masuk
            </Button>
          </Form>

          <Divider plain style={{ margin: "22px 0", fontSize: 12 }}>atau</Divider>
          <Button size="large" block icon={<SafetyCertificateOutlined />} onClick={() => message.info("Login SSO belum dihubungkan.")}>
            Masuk dengan SSO
          </Button>

          <div style={{ marginTop: 24, padding: "12px 14px", borderRadius: 10, background: agi[50], border: `1px solid ${agi[100]}`, fontSize: 13, color: agi[900] }}>
            Belum punya akun? Tidak ada pendaftaran mandiri — akun dibuat oleh administrator lewat menu Manajemen User.
          </div>
          <div style={{ marginTop: 14, textAlign: "center" }}>
            <Text type="secondary" style={{ fontSize: 12 }}>Mode demo — belum terhubung ke backend.</Text>
          </div>
        </div>
      </main>
    </div>
  );
}
