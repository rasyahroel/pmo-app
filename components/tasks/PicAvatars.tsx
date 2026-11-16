"use client";

import { Avatar, Tooltip } from "antd";
import { agi } from "@/app/providers";
import { initials } from "@/lib/task-ui";

// Deretan avatar PIC (bisa lebih dari satu). Kelebihan dari `max` diringkas jadi "+N";
// semua nama tetap terbaca lewat tooltip.
export default function PicAvatars({ names, max = 3, size = 22 }: { names: string[]; max?: number; size?: number }) {
  if (names.length === 0) return <span style={{ fontSize: 12, color: "#8C93A3" }}>Belum ada PIC</span>;
  return (
    <Tooltip title={names.join(", ")}>
      <Avatar.Group max={{ count: max, style: { background: agi[100], color: agi[800], fontSize: 10 } }} size={size}>
        {names.map((n) => (
          <Avatar key={n} style={{ background: agi[200], color: agi[800], fontSize: Math.max(9, size / 2.2) }}>
            {initials(n)}
          </Avatar>
        ))}
      </Avatar.Group>
    </Tooltip>
  );
}

// Daftar PIC sebagai chip lengkap dengan nama (untuk halaman detail) — PicAvatars di atas
// lebih ringkas dan dipakai di kartu/tabel.
export function PicChips({ names }: { names: string[] }) {
  if (names.length === 0) return <span style={{ fontSize: 13, color: "#8C93A3" }}>Belum ada PIC</span>;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {names.map((n) => (
        <span
          key={n}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "2px 10px 2px 3px",
            borderRadius: 999,
            background: agi[50],
            border: `1px solid ${agi[100]}`,
          }}
        >
          <Avatar size={20} style={{ background: agi[200], color: agi[800], fontSize: 10 }}>
            {initials(n)}
          </Avatar>
          <span style={{ fontSize: 13 }}>{n}</span>
        </span>
      ))}
    </div>
  );
}
