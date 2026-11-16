"use client";

import { Dropdown } from "antd";
import { DownOutlined } from "@ant-design/icons";
import type { Task } from "@/lib/mock-data";
import { useStatusMeta } from "@/lib/master-store";
import { useTaskActions } from "@/lib/use-task-actions";
import { useTaskPermissions } from "@/lib/use-task-permissions";

// Titik warna status (dipakai di Select, menu, dsb). `status` = ID status task.
export function StatusDot({ status, size = 8 }: { status: string; size?: number }) {
  const { styleOf } = useStatusMeta();
  return (
    <span
      aria-hidden
      style={{ display: "inline-block", width: size, height: size, borderRadius: "50%", background: styleOf(status).main, flexShrink: 0 }}
    />
  );
}

// Pill status berwarna (read-only). Warna & nama selalu mengikuti Master Data.
export function StatusBadge({ status, caret }: { status: string; caret?: boolean }) {
  const { styleOf, nameOf } = useStatusMeta();
  const st = styleOf(status);
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "1px 9px",
        borderRadius: 999,
        fontSize: 12,
        lineHeight: "20px",
        fontWeight: 500,
        color: st.text,
        background: st.soft,
        borderStyle: "solid",
        borderWidth: 1,
        borderColor: st.border,
        whiteSpace: "nowrap",
      }}
    >
      <StatusDot status={status} size={7} />
      {nameOf(status)}
      {caret && <DownOutlined style={{ fontSize: 9, opacity: 0.7 }} />}
    </span>
  );
}

// Pill status yang bisa diklik untuk mengganti status task tanpa membuka form. Kalau pengguna
// tidak berhak mengubah task, tampil sebagai pill biasa. Peringatan "sub task belum selesai"
// ditangani useTaskActions (sama untuk semua jalur).
export default function TaskStatusSwitch({ task }: { task: Task }) {
  const { statuses, nameOf } = useStatusMeta();
  const { move } = useTaskActions();
  const perms = useTaskPermissions();

  if (!perms.canUpdate(task)) return <StatusBadge status={task.status} />;

  return (
    <Dropdown
      trigger={["click"]}
      menu={{
        selectedKeys: [task.status],
        items: statuses.map((s) => ({ key: s.id, label: <StatusBadge status={s.id} /> })),
        onClick: ({ key }) => {
          if (key !== task.status) move(task, key);
        },
      }}
    >
      <span role="button" tabIndex={0} style={{ cursor: "pointer" }} aria-label={`Status: ${nameOf(task.status)}. Klik untuk mengubah`}>
        <StatusBadge status={task.status} caret />
      </span>
    </Dropdown>
  );
}
