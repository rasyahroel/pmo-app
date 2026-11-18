"use client";

import { useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Card, Empty, Segmented, Select, Space, Tag } from "antd";
import PageSkeleton from "@/components/layout/PageSkeleton";
import NotificationItem from "@/components/notifications/NotificationItem";
import { NOTIF_META, type Notif, type NotifGroup } from "@/lib/notification-store";
import { useMyNotifications } from "@/lib/use-reminders";

const noop = () => () => undefined;
// Waktu relatif ("5 menit lalu") berbeda antara server dan browser; daftar hanya dirender di browser.
function ClientOnly({ children }: { children: ReactNode }) {
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  return mounted ? <>{children}</> : null;
}

export default function NotificationsPage() {
  const router = useRouter();
  const { all, unread, markRead, markAllRead, remove } = useMyNotifications();
  const [state, setState] = useState<"all" | "unread">("all");
  const [group, setGroup] = useState<NotifGroup | "all">("all");

  const rows = useMemo(() => all.filter((n) => (state === "all" || !n.readAt) && (group === "all" || NOTIF_META[n.type].group === group)), [all, state, group]);
  const open = (n: Notif) => {
    markRead(n.id);
    router.push(n.link);
  };

  return (
    <PageSkeleton path="/notifications">
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        title="Dua macam notifikasi."
        description={
          <span>
            <b>Kejadian</b>: ada yang melakukan sesuatu padamu (ditunjuk jadi PIC, komentar, review, undangan atau perubahan rapat). <b>Pengingat</b> (bertanda “otomatis”): keadaan yang butuh tindakan, seperti task terlambat atau rapat besok; hilang sendiri setelah selesai. Kamu tidak diberi tahu tentang aksimu sendiri.
          </span>
        }
      />
      <Card styles={{ body: { padding: 0 } }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", justifyContent: "space-between", padding: 14, borderBottom: "1px solid #EEF2F4" }}>
          <Space wrap>
            <Segmented value={state} onChange={(v) => setState(v as "all" | "unread")} options={[{ value: "all", label: `Semua (${all.length})` }, { value: "unread", label: `Belum dibaca (${unread})` }]} />
            <Select value={group} onChange={setGroup} style={{ minWidth: 150 }} options={[{ value: "all", label: "Semua jenis" }, { value: "Task", label: "Task" }, { value: "Rapat", label: "Rapat" }, { value: "Pengingat", label: "Pengingat" }, { value: "Akun", label: "Akun" }]} />
          </Space>
          <Button disabled={unread === 0} onClick={markAllRead}>
            Tandai semua dibaca
          </Button>
        </div>
        <ClientOnly>
          {rows.length === 0 ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={state === "unread" ? "Semua sudah dibaca" : "Belum ada notifikasi"} style={{ padding: "40px 0" }} />
          ) : (
            rows.map((n) => <NotificationItem key={n.id} n={n} onOpen={open} onRemove={(x) => remove(x.id)} />)
          )}
        </ClientOnly>
        {rows.length > 0 && (
          <div style={{ padding: "10px 14px" }}>
            <Tag>{rows.length} notifikasi</Tag>
          </div>
        )}
      </Card>
    </PageSkeleton>
  );
}
