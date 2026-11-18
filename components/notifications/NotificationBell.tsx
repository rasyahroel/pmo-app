"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge, Button, Empty, Popover, Segmented } from "antd";
import { BellOutlined } from "@ant-design/icons";
import { agi } from "@/app/providers";
import NotificationItem from "@/components/notifications/NotificationItem";
import { useMyNotifications } from "@/lib/use-reminders";
import type { Notif } from "@/lib/notification-store";

// Ikon lonceng di header: angka = yang belum dibaca (kejadian + pengingat). Klik = daftar singkat.
export default function NotificationBell() {
  const router = useRouter();
  const { all, unread, markRead, markAllRead } = useMyNotifications();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"all" | "unread">("all");

  const shown = (tab === "unread" ? all.filter((n) => !n.readAt) : all).slice(0, 8);
  const reminders = shown.filter((n) => n.derived);
  const events = shown.filter((n) => !n.derived);

  const openItem = (n: Notif) => {
    markRead(n.id);
    setOpen(false);
    router.push(n.link);
  };

  const content = (
    <div style={{ width: 390, maxWidth: "88vw" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 12px 10px", gap: 8 }}>
        <Segmented size="small" value={tab} onChange={(v) => setTab(v as "all" | "unread")} options={[{ value: "all", label: "Semua" }, { value: "unread", label: `Belum dibaca (${unread})` }]} />
        <Button type="link" size="small" disabled={unread === 0} onClick={markAllRead} style={{ padding: 0 }}>
          Tandai semua dibaca
        </Button>
      </div>
      <div style={{ maxHeight: 420, overflowY: "auto", borderTop: "1px solid #EEF2F4" }}>
        {shown.length === 0 && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={tab === "unread" ? "Semua sudah dibaca" : "Belum ada notifikasi"} style={{ padding: "24px 0" }} />}
        {reminders.length > 0 && <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase", color: "#6B7185", padding: "8px 12px 4px" }}>Perlu tindakan</div>}
        {reminders.map((n) => (
          <NotificationItem key={n.id} n={n} onOpen={openItem} />
        ))}
        {events.length > 0 && reminders.length > 0 && <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase", color: "#6B7185", padding: "8px 12px 4px" }}>Terbaru</div>}
        {events.map((n) => (
          <NotificationItem key={n.id} n={n} onOpen={openItem} />
        ))}
      </div>
      <div style={{ textAlign: "center", padding: "10px 0 2px", borderTop: "1px solid #EEF2F4" }}>
        <Link href="/notifications" onClick={() => setOpen(false)}>
          Lihat semua notifikasi
        </Link>
      </div>
    </div>
  );

  return (
    <Popover content={content} trigger="click" placement="bottomRight" arrow={false} open={open} onOpenChange={setOpen} styles={{ content: { padding: "10px 0 8px" } }}>
      <button type="button" aria-label={unread ? `Notifikasi, ${unread} belum dibaca` : "Notifikasi"} style={{ border: 0, background: "transparent", cursor: "pointer", padding: 4, display: "inline-flex" }}>
        <Badge count={unread} size="small" color={agi[500]} overflowCount={99}>
          <BellOutlined style={{ fontSize: 18, color: agi[600] }} />
        </Badge>
      </button>
    </Popover>
  );
}
