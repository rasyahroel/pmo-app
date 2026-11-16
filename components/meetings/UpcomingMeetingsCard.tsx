"use client";

import Link from "next/link";
import dayjs from "dayjs";
import { Card, Empty, Tag, Typography } from "antd";
import { EnvironmentOutlined, VideoCameraOutlined } from "@ant-design/icons";
import { projects } from "@/lib/mock-data";
import { useMeetingMeta } from "@/lib/master-store";
import { useUpcomingMeetings } from "@/lib/meeting-store";

const { Text } = Typography;

// Kartu "Rapat Mendatang" untuk Dashboard — membaca store rapat yang sama dengan menu Rapat,
// jadi jadwal baru, perubahan status, dan hak lihat otomatis sinkron.
export default function UpcomingMeetingsCard({ limit = 5 }: { limit?: number }) {
  const list = useUpcomingMeetings(limit);
  const meta = useMeetingMeta();

  return (
    <Card title="Rapat Mendatang" extra={<Link href="/meetings">Lihat semua</Link>}>
      {list.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Tidak ada rapat mendatang." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {list.map((m) => {
            const st = meta.statusStyle(m.statusId);
            return (
              <div key={m.id} style={{ paddingBottom: 14, borderBottom: "1px solid #F0F1F5" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                  <Link href={`/meetings/${m.id}`} style={{ fontWeight: 500, color: "inherit" }}>
                    {m.title}
                  </Link>
                  <Tag style={{ marginInlineEnd: 0, color: st.text, background: st.soft, borderColor: st.border }}>{meta.statusName(m.statusId)}</Tag>
                </div>
                <Text type="secondary" style={{ fontSize: 12, display: "block" }}>
                  {dayjs(m.startsAt).format("DD MMM YYYY, HH:mm")}–{dayjs(m.endsAt).format("HH:mm")} · {projects.find((p) => p.id === m.projectId)?.name}
                </Text>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {m.isOnline ? <VideoCameraOutlined /> : <EnvironmentOutlined />} {m.isOnline ? "Online" : m.location} · {m.participants.length} peserta
                </Text>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
