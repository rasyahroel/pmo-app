"use client";

import dayjs from "dayjs";
import { CalendarOutlined, CheckCircleOutlined, ClockCircleOutlined, CloseOutlined, ExclamationCircleOutlined, FileTextOutlined, MessageOutlined, StopOutlined, UserAddOutlined } from "@ant-design/icons";
import type { ReactNode } from "react";
import { NOTIF_META, type Notif, type NotifType } from "@/lib/notification-store";

const ICON: Record<NotifType, ReactNode> = {
  task_assigned: <UserAddOutlined />,
  task_commented: <MessageOutlined />,
  task_reviewed: <CheckCircleOutlined />,
  meeting_invited: <CalendarOutlined />,
  meeting_changed: <CalendarOutlined />,
  meeting_cancelled: <StopOutlined />,
  task_overdue: <ExclamationCircleOutlined />,
  task_due_soon: <ClockCircleOutlined />,
  meeting_soon: <CalendarOutlined />,
  meeting_no_result: <FileTextOutlined />,
};

/** "5 menit lalu", "2 jam lalu", "kemarin", atau tanggal. */
export function ago(iso: string, now = dayjs()): string {
  const d = dayjs(iso);
  const min = now.diff(d, "minute");
  if (min < 1) return "baru saja";
  if (min < 60) return `${min} menit lalu`;
  const hr = now.diff(d, "hour");
  if (hr < 24) return `${hr} jam lalu`;
  const days = now.startOf("day").diff(d.startOf("day"), "day");
  if (days === 1) return "kemarin";
  if (days < 7) return `${days} hari lalu`;
  return d.format("DD MMM YYYY");
}

export default function NotificationItem({ n, onOpen, onRemove, showTime = true }: { n: Notif; onOpen: (n: Notif) => void; onRemove?: (n: Notif) => void; showTime?: boolean }) {
  const meta = NOTIF_META[n.type];
  const unread = !n.readAt;
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(n)}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onOpen(n))}
      aria-label={`${unread ? "Belum dibaca: " : ""}${n.title}`}
      style={{ display: "flex", gap: 12, padding: "10px 12px", cursor: "pointer", background: unread ? "#F2FBFC" : "transparent", borderBottom: "1px solid #EEF2F4", alignItems: "flex-start" }}
    >
      <span style={{ width: 32, height: 32, borderRadius: 16, display: "inline-flex", alignItems: "center", justifyContent: "center", background: `${meta.color}1A`, color: meta.color, flexShrink: 0, fontSize: 15 }}>{ICON[n.type]}</span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 13.5, fontWeight: unread ? 600 : 400, color: "#1F2937", lineHeight: 1.35 }}>{n.title}</div>
        {n.body && <div style={{ fontSize: 12.5, color: "#6B7185", marginTop: 2, lineHeight: 1.35 }}>{n.body}</div>}
        <div style={{ fontSize: 11.5, color: "#8A90A2", marginTop: 4 }}>
          <span style={{ color: meta.color }}>{meta.label}</span>
          {showTime && !n.derived && ` · ${ago(n.createdAt)}`}
          {n.derived && " · otomatis"}
        </div>
      </div>
      {unread && <span aria-hidden style={{ width: 8, height: 8, borderRadius: 4, background: "#22A7B8", marginTop: 6, flexShrink: 0 }} />}
      {onRemove && !n.derived && (
        <button type="button" aria-label="Hapus notifikasi" onClick={(e) => (e.stopPropagation(), onRemove(n))} style={{ border: 0, background: "transparent", cursor: "pointer", color: "#8A90A2", padding: 2 }}>
          <CloseOutlined style={{ fontSize: 11 }} />
        </button>
      )}
    </div>
  );
}
