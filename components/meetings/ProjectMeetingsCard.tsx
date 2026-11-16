"use client";

import { useState } from "react";
import Link from "next/link";
import dayjs from "dayjs";
import { Button, Card, Tag, Table, Tooltip, Typography } from "antd";
import { EnvironmentOutlined, PlusOutlined, VideoCameraOutlined, WarningOutlined } from "@ant-design/icons";
import { useMeetingMeta } from "@/lib/master-store";
import { useMeetingStore, type MeetingRecord } from "@/lib/meeting-store";
import { useMeetingPermissions } from "@/lib/use-meeting-permissions";
import MeetingFormModal from "@/components/meetings/MeetingFormModal";

const { Text } = Typography;

// Kartu "Rapat terkait project ini" untuk tab Task & Rapat di detail project. Data sama dengan menu
// Rapat (satu store); jadwal baru bisa dibuat langsung dari sini oleh PMO project.
export default function ProjectMeetingsCard({ projectId }: { projectId: string }) {
  const { meetings } = useMeetingStore();
  const meta = useMeetingMeta();
  const perms = useMeetingPermissions();
  const [open, setOpen] = useState(false);
  const list = meetings.filter((m) => m.projectId === projectId).sort((a, b) => b.startsAt.localeCompare(a.startsAt));

  return (
    <Card
      title="Rapat terkait project ini"
      size="small"
      extra={
        perms.canCreateIn(projectId) && (
          <Button size="small" type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>
            Jadwalkan Rapat
          </Button>
        )
      }
    >
      <Table<MeetingRecord>
        rowKey="id"
        size="small"
        dataSource={list}
        pagination={list.length > 8 ? { pageSize: 8 } : false}
        locale={{ emptyText: "Belum ada rapat." }}
        scroll={{ x: "max-content" }}
        columns={[
          { title: "Rapat", dataIndex: "title", render: (v: string, m) => <Link href={`/meetings/${m.id}`} style={{ color: "inherit", fontWeight: 500 }}>{v}</Link> },
          { title: "Kategori", dataIndex: "categoryId", width: 120, render: (v: string) => <Tag style={{ fontSize: 11 }}>{meta.categoryName(v)}</Tag> },
          { title: "Waktu", dataIndex: "startsAt", width: 170, render: (v: string, m) => `${dayjs(v).format("DD MMM YYYY HH:mm")}–${dayjs(m.endsAt).format("HH:mm")}` },
          {
            title: "Dimana",
            width: 200,
            render: (_: unknown, m) => (
              <span>{m.isOnline ? <VideoCameraOutlined style={{ color: "#2F80ED" }} /> : <EnvironmentOutlined style={{ color: "#F97316" }} />} {m.isOnline ? "Online" : m.location}</span>
            ),
          },
          {
            title: "Status",
            dataIndex: "statusId",
            width: 110,
            render: (v: string) => {
              const st = meta.statusStyle(v);
              return <Tag style={{ color: st.text, background: st.soft, borderColor: st.border }}>{meta.statusName(v)}</Tag>;
            },
          },
          {
            title: "Peserta",
            width: 90,
            render: (_: unknown, m) => <Tooltip title={m.participants.map((p) => p.name).join(", ")}><Text>{m.participants.length} orang</Text></Tooltip>,
          },
          {
            title: "Hasil",
            width: 120,
            render: (_: unknown, m) =>
              meta.statusKind(m.statusId) === "done" && !m.summary && m.attachments.length === 0 && m.actionItems.length === 0 ? (
                <Tag color="orange" icon={<WarningOutlined />}>Belum ada</Tag>
              ) : (
                <Text type="secondary">{m.attachments.length} file · {m.actionItems.length} tindak lanjut</Text>
              ),
          },
        ]}
      />
      <MeetingFormModal open={open} meeting={null} defaults={{ projectId }} onClose={() => setOpen(false)} />
    </Card>
  );
}
