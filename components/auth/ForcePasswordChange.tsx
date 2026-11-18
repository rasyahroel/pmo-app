"use client";

import { App, Alert, Button, Form, Input, Modal } from "antd";
import { LockOutlined } from "@ant-design/icons";
import { useRouter } from "next/navigation";
import PasswordStrength from "@/components/auth/PasswordStrength";
import { useCurrentUser, useSession } from "@/lib/acting-user";
import { useAuth } from "@/lib/auth-store";
import { ENFORCE_LOGIN } from "@/lib/auth-config";
import { isStrong } from "@/lib/password-policy";

type Values = { next: string; confirm: string };

/**
 * Popup wajib ganti password di login pertama (dan setelah password diatur ulang Administrator).
 * Login-nya sendiri sudah berhasil; popup ini tidak bisa ditutup (tanpa tombol X, Esc, atau klik di luar)
 * sampai password diganti. Satu-satunya jalan lain: Keluar.
 */
export default function ForcePasswordChange() {
  const { session, signOut } = useSession();
  const me = useCurrentUser();
  const { changePassword } = useAuth();
  const { message } = App.useApp();
  const router = useRouter();
  const [form] = Form.useForm<Values>();
  const next = Form.useWatch("next", form);

  function submit() {
    form
      .validateFields()
      .then((v) => {
        const r = changePassword(me.id, null, v.next);
        if (!r.ok) return void form.setFields([{ name: "next", errors: [r.reason] }]);
        message.success("Password berhasil diganti.");
      })
      .catch(() => undefined);
  }

  return (
    <Modal
      open={ENFORCE_LOGIN && !!session?.mustChange}
      title="Ganti password dulu"
      closable={false}
      mask={{ closable: false }}
      keyboard={false}
      centered
      width={480}
      destroyOnHidden
      footer={[
        <Button
          key="out"
          onClick={() => {
            signOut();
            router.replace("/login");
          }}
        >
          Keluar
        </Button>,
        <Button key="ok" type="primary" onClick={submit}>
          Simpan password baru
        </Button>,
      ]}
    >
      <Alert type="info" showIcon style={{ marginBottom: 16 }} title="Ini login pertamamu (atau password diatur ulang administrator)." description="Demi keamanan, buat password baru yang hanya kamu yang tahu sebelum memakai aplikasi." />
      <Form form={form} layout="vertical" requiredMark={false} preserve={false} onFinish={submit}>
        <Form.Item name="next" label="Password baru" rules={[{ required: true, message: "Wajib diisi" }, { validator: (_, v) => (!v || isStrong(v, me) ? Promise.resolve() : Promise.reject(new Error("Belum memenuhi syarat di bawah"))) }]}>
          <Input.Password prefix={<LockOutlined />} autoComplete="new-password" autoFocus />
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
      </Form>
    </Modal>
  );
}
