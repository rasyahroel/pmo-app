"use client";

import { CheckCircleFilled, MinusCircleOutlined } from "@ant-design/icons";
import { Progress, Typography } from "antd";
import { checkPassword, strengthScore } from "@/lib/password-policy";

const { Text } = Typography;
const LABEL = ["", "Lemah", "Cukup", "Kuat", "Sangat kuat"];
const COLOR = ["#E6ECEF", "#F8285A", "#F6B100", "#35C1D0", "#17C653"];

/** Meteran kekuatan + daftar syarat password (hijau bila terpenuhi). */
export default function PasswordStrength({ value, username, email }: { value?: string; username?: string; email?: string }) {
  const pw = value ?? "";
  const ctx = { username, email };
  const score = strengthScore(pw, ctx);
  return (
    <div style={{ marginTop: -8, marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Progress percent={score * 25} showInfo={false} size="small" strokeColor={COLOR[score]} style={{ flex: 1, margin: 0 }} />
        <Text style={{ fontSize: 12, minWidth: 70, color: COLOR[score] === "#E6ECEF" ? "#8A90A2" : COLOR[score] }}>{LABEL[score] || "—"}</Text>
      </div>
      <ul style={{ listStyle: "none", margin: "6px 0 0", padding: 0, display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px 12px" }}>
        {checkPassword(pw, ctx).map((c) => (
          <li key={c.id} style={{ fontSize: 12, color: c.ok ? "#17A34A" : "#8A90A2", display: "flex", gap: 6, alignItems: "center" }}>
            {c.ok ? <CheckCircleFilled /> : <MinusCircleOutlined />} {c.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
