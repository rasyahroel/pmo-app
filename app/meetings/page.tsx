"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import dayjs, { type Dayjs } from "dayjs";
import "dayjs/locale/id";
import { App, Avatar, Button, Card, Col, DatePicker, Empty, Input, Popconfirm, Row, Segmented, Select, Space, Statistic, Tag, Tooltip, Typography } from "antd";
import {
  CalendarOutlined,
  DeleteOutlined,
  EditOutlined,
  EnvironmentOutlined,
  FileDoneOutlined,
  PaperClipOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  TeamOutlined,
  VideoCameraOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import PageSkeleton from "@/components/layout/PageSkeleton";
import MeetingFormModal from "@/components/meetings/MeetingFormModal";
import { projects } from "@/lib/mock-data";
import { useMeetingMeta } from "@/lib/master-store";
import { useMeetingStore, type MeetingRecord } from "@/lib/meeting-store";
import { useMeetingPermissions } from "@/lib/use-meeting-permissions";
import { initials, projectColor, useToday } from "@/lib/task-ui";
import { agi } from "@/app/providers";

const { Text } = Typography;
const { RangePicker } = DatePicker;

const projectName = (id: string) => projects.find((p) => p.id === id)?.name ?? "-";
const dayLabel = (d: string) => dayjs(d).locale("id").format("dddd, D MMMM YYYY");
const hostOf = (u?: string) => {
  try {
    return u ? new URL(u).host : "";
  } catch {
    return "";
  }
};

type Mode = "all" | "online" | "offline";

function Label({ children }: { children: string }) {
  return <div style={{ fontSize: 12, color: "#667085", marginBottom: 4 }}>{children}</div>;
}

export default function MeetingsPage() {
  const { message } = App.useApp();
  const store = useMeetingStore();
  const meta = useMeetingMeta();
  const perms = useMeetingPermissions();
  const today = useToday();

  const [range, setRange] = useState<[Dayjs, Dayjs] | null>(null);
  const [projectIds, setProjectIds] = useState<string[]>([]);
  const [mode, setMode] = useState<Mode>("all");
  const [place, setPlace] = useState("");
  const [people, setPeople] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [form, setForm] = useState<{ meeting: MeetingRecord | null } | null>(null);

  const all = store.meetings;
  const peopleOptions = useMemo(() => Array.from(new Set(all.flatMap((m) => m.participants.map((p) => p.name)))).sort(), [all]);
  const projectOptions = useMemo(() => projects.filter((p) => all.some((m) => m.projectId === p.id)).map((p) => ({ value: p.id, label: p.name })), [all]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const placeNeedle = place.trim().toLowerCase();
    return all.filter((m) => {
      if (range) {
        const d = dayjs(m.startsAt);
        if (d.isBefore(range[0].startOf("day")) || d.isAfter(range[1].endOf("day"))) return false;
      }
      if (projectIds.length && !projectIds.includes(m.projectId)) return false;
      if (mode === "online" && !m.isOnline) return false;
      if (mode === "offline" && m.isOnline) return false;
      if (placeNeedle && !(m.location ?? "").toLowerCase().includes(placeNeedle)) return false;
      if (people.length && !m.participants.some((p) => people.includes(p.name))) return false;
      if (categories.length && !categories.includes(m.categoryId)) return false;
      if (statuses.length && !statuses.includes(m.statusId)) return false;
      if (needle) {
        const hay = [m.title, m.description, m.location, projectName(m.projectId), m.summary, ...m.participants.map((p) => p.name)].join(" ").toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [all, range, projectIds, mode, place, people, categories, statuses, q]);

  const dateOf = (m: MeetingRecord) => m.startsAt.slice(0, 10);
  const upcoming = filtered.filter((m) => dateOf(m) >= today).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const past = filtered.filter((m) => dateOf(m) < today).sort((a, b) => b.startsAt.localeCompare(a.startsAt));

  const noMom = (m: MeetingRecord) => meta.statusKind(m.statusId) === "done" && !m.summary && m.attachments.length === 0 && m.actionItems.length === 0;
  const stats = {
    planned: all.filter((m) => meta.statusKind(m.statusId) === "planned" && dateOf(m) >= today).length,
    today: all.filter((m) => dateOf(m) === today && meta.statusKind(m.statusId) !== "cancelled").length,
    week: all.filter((m) => {
      const d = dayjs(m.startsAt);
      return meta.statusKind(m.statusId) === "planned" && !d.isBefore(dayjs(today)) && d.isBefore(dayjs(today).add(7, "day"));
    }).length,
    noMom: all.filter(noMom).length,
  };

  const activeFilters = [range, projectIds.length, mode !== "all", place.trim(), people.length, categories.length, statuses.length, q.trim()].filter(Boolean).length;
  function reset() {
    setRange(null);
    setProjectIds([]);
    setMode("all");
    setPlace("");
    setPeople([]);
    setCategories([]);
    setStatuses([]);
    setQ("");
  }
  function preset(kind: "today" | "week" | "month" | "upcoming") {
    const t = dayjs(today);
    if (kind === "today") setRange([t, t]);
    else if (kind === "week") setRange([t.startOf("week"), t.endOf("week")]);
    else if (kind === "month") setRange([t.startOf("month"), t.endOf("month")]);
    else setRange([t, t.add(1, "year")]);
  }

  function remove(m: MeetingRecord) {
    const res = store.deleteMeeting(m.id);
    if (res.ok) message.success("Rapat dihapus.");
    else message.warning(res.reason);
  }

  function renderGroup(title: string, list: MeetingRecord[], tone: string) {
    if (list.length === 0) return null;
    const byDay = new Map<string, MeetingRecord[]>();
    for (const m of list) byDay.set(dateOf(m), [...(byDay.get(dateOf(m)) ?? []), m]);
    return (
      <section key={title}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "20px 0 8px" }}>
          <span style={{ width: 4, height: 18, borderRadius: 2, background: tone }} />
          <Text strong style={{ fontSize: 16 }}>{title}</Text>
          <Tag style={{ marginInlineEnd: 0 }}>{list.length}</Tag>
        </div>
        {Array.from(byDay.entries()).map(([day, items]) => (
          <div key={day} style={{ marginBottom: 14 }}>
            <Text type="secondary" style={{ fontSize: 13, fontWeight: 500 }}>
              {day === today ? `Hari ini · ${dayLabel(day)}` : dayLabel(day)}
            </Text>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 6 }}>
              {items.map((m) => (
                <MeetingCard key={m.id} m={m} today={today} noMom={noMom(m)} onEdit={() => setForm({ meeting: m })} onDelete={() => remove(m)} />
              ))}
            </div>
          </div>
        ))}
      </section>
    );
  }

  return (
    <PageSkeleton path="/meetings">
      <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
        <Col xs={12} md={6}><Card><Statistic title="Akan datang" value={stats.planned} prefix={<CalendarOutlined />} /></Card></Col>
        <Col xs={12} md={6}><Card><Statistic title="Hari ini" value={stats.today} /></Card></Col>
        <Col xs={12} md={6}><Card><Statistic title="7 hari ke depan" value={stats.week} /></Card></Col>
        <Col xs={12} md={6}>
          <Tooltip title="Rapat berstatus selesai yang belum punya ringkasan, file, atau tindak lanjut">
            <Card><Statistic title="Hasil rapat belum ada" value={stats.noMom} prefix={<WarningOutlined />} styles={{ content: { color: stats.noMom ? "#9A6200" : undefined } }} /></Card>
          </Tooltip>
        </Col>
      </Row>

      <Card size="small" styles={{ body: { padding: 14 } }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12 }}>
          <div>
            <Label>Kapan</Label>
            <RangePicker style={{ width: "100%" }} value={range} onChange={(v) => setRange(v && v[0] && v[1] ? [v[0], v[1]] : null)} />
            <Space size={4} wrap style={{ marginTop: 6 }}>
              <Button size="small" onClick={() => preset("today")}>Hari ini</Button>
              <Button size="small" onClick={() => preset("week")}>Minggu ini</Button>
              <Button size="small" onClick={() => preset("month")}>Bulan ini</Button>
              <Button size="small" onClick={() => preset("upcoming")}>Mendatang</Button>
            </Space>
          </div>
          <div>
            <Label>Project apa</Label>
            <Select mode="multiple" allowClear maxTagCount="responsive" style={{ width: "100%" }} placeholder="Semua project" value={projectIds} onChange={setProjectIds} options={projectOptions} optionFilterProp="label" />
          </div>
          <div>
            <Label>Dimana</Label>
            <Segmented
              block
              value={mode}
              onChange={(v) => setMode(v as Mode)}
              options={[
                { value: "all", label: "Semua" },
                { value: "online", label: "Online" },
                { value: "offline", label: "Offline" },
              ]}
            />
            {mode !== "online" && (
              <Input allowClear prefix={<EnvironmentOutlined />} placeholder="Cari lokasi…" value={place} onChange={(e) => setPlace(e.target.value)} style={{ marginTop: 6 }} />
            )}
          </div>
          <div>
            <Label>Siapa saja yang hadir</Label>
            <Select mode="multiple" allowClear maxTagCount="responsive" style={{ width: "100%" }} placeholder="Semua peserta" value={people} onChange={setPeople} options={peopleOptions.map((n) => ({ value: n, label: n }))} />
          </div>
          <div>
            <Label>Kategori</Label>
            <Select mode="multiple" allowClear maxTagCount="responsive" style={{ width: "100%" }} placeholder="Semua kategori" value={categories} onChange={setCategories} options={meta.categories.map((c) => ({ value: c.id, label: c.name }))} />
          </div>
          <div>
            <Label>Status</Label>
            <Select mode="multiple" allowClear maxTagCount="responsive" style={{ width: "100%" }} placeholder="Semua status" value={statuses} onChange={setStatuses} options={meta.statuses.map((s) => ({ value: s.id, label: s.name }))} />
          </div>
          <div>
            <Label>Cari kata</Label>
            <Input allowClear prefix={<SearchOutlined />} placeholder="Judul, agenda, hasil, nama…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12, gap: 8, flexWrap: "wrap" }}>
          <Text type="secondary">
            Menampilkan <b>{filtered.length}</b> dari {all.length} rapat
            {activeFilters > 0 && <Tag color="cyan" style={{ marginInlineStart: 8 }}>{activeFilters} filter aktif</Tag>}
          </Text>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={reset} disabled={activeFilters === 0}>Reset filter</Button>
            {perms.canCreateAny && (
              <Button type="primary" icon={<PlusOutlined />} onClick={() => setForm({ meeting: null })}>
                Jadwalkan Rapat
              </Button>
            )}
          </Space>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <Card style={{ marginTop: 16 }}>
          <Empty description={all.length === 0 ? "Belum ada rapat yang bisa kamu lihat." : "Tidak ada rapat yang cocok dengan filter."}>
            {activeFilters > 0 ? (
              <Button onClick={reset}>Reset filter</Button>
            ) : (
              perms.canCreateAny && (
                <Button type="primary" icon={<PlusOutlined />} onClick={() => setForm({ meeting: null })}>
                  Jadwalkan rapat pertama
                </Button>
              )
            )}
          </Empty>
        </Card>
      ) : (
        <>
          {renderGroup("Hari ini dan akan datang", upcoming, "#22A7B8")}
          {renderGroup("Sebelumnya", past, "#98A2B3")}
        </>
      )}

      <MeetingFormModal open={form !== null} meeting={form?.meeting ?? null} onClose={() => setForm(null)} />
    </PageSkeleton>
  );
}

function MeetingCard({ m, today, noMom, onEdit, onDelete }: { m: MeetingRecord; today: string; noMom: boolean; onEdit: () => void; onDelete: () => void }) {
  const meta = useMeetingMeta();
  const perms = useMeetingPermissions();
  const st = meta.statusStyle(m.statusId);
  const kind = meta.statusKind(m.statusId);
  const canManage = perms.canManage(m);
  const converted = m.actionItems.filter((i) => i.taskId).length;
  const joinable = m.isOnline && m.meetingUrl && kind === "planned" && m.startsAt.slice(0, 10) === today;

  return (
    <div
      className="task-card"
      style={{
        display: "grid",
        gridTemplateColumns: "88px minmax(0, 1fr) auto",
        gap: 14,
        alignItems: "center",
        background: "#fff",
        borderRadius: 12,
        borderStyle: "solid",
        borderWidth: "1px 1px 1px 4px",
        borderColor: `${st.border} ${st.border} ${st.border} ${st.main}`,
        padding: "12px 14px",
        boxShadow: "0 1px 2px rgba(16,49,60,0.07)",
        opacity: kind === "cancelled" ? 0.7 : 1,
      }}
    >
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 20, fontWeight: 600, lineHeight: 1.1 }}>{dayjs(m.startsAt).format("HH:mm")}</div>
        <Text type="secondary" style={{ fontSize: 12 }}>s/d {dayjs(m.endsAt).format("HH:mm")}</Text>
      </div>

      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: projectColor(m.projectId), flexShrink: 0 }} />
          <Text type="secondary" ellipsis style={{ fontSize: 12 }}>{projectName(m.projectId)}</Text>
        </div>
        <Link href={`/meetings/${m.id}`} style={{ fontWeight: 600, fontSize: 15, color: kind === "cancelled" ? "#98A2B3" : "inherit", textDecoration: kind === "cancelled" ? "line-through" : undefined }}>
          {m.title}
        </Link>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 10px", alignItems: "center", marginTop: 6 }}>
          <Tag style={{ marginInlineEnd: 0, color: st.text, background: st.soft, borderColor: st.border }}>{meta.statusName(m.statusId)}</Tag>
          <Tag style={{ marginInlineEnd: 0 }}>{meta.categoryName(m.categoryId)}</Tag>
          <span style={{ fontSize: 13, color: "#475467", display: "inline-flex", alignItems: "center", gap: 4, minWidth: 0 }}>
            {m.isOnline ? <VideoCameraOutlined style={{ color: "#2F80ED" }} /> : <EnvironmentOutlined style={{ color: "#F97316" }} />}
            {m.isOnline ? `Online · ${hostOf(m.meetingUrl) || "link"}` : m.location}
          </span>
          <Tooltip title={m.participants.map((p) => p.name).join(", ")}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Avatar.Group max={{ count: 4, style: { background: agi[100], color: agi[800], fontSize: 10 } }} size={22}>
                {m.participants.map((p) => (
                  <Avatar key={p.id} style={{ background: p.external ? "#F6D68A" : agi[200], color: p.external ? "#7A5200" : agi[800], fontSize: 10 }}>{initials(p.name)}</Avatar>
                ))}
              </Avatar.Group>
              <Text type="secondary" style={{ fontSize: 12 }}><TeamOutlined /> {m.participants.length}</Text>
            </span>
          </Tooltip>
          {noMom && <Tag color="orange" icon={<WarningOutlined />} style={{ marginInlineEnd: 0 }}>Hasil rapat belum ada</Tag>}
          {m.attachments.length > 0 && <Text type="secondary" style={{ fontSize: 12 }}><PaperClipOutlined /> {m.attachments.length} file</Text>}
          {m.actionItems.length > 0 && <Text type="secondary" style={{ fontSize: 12 }}><FileDoneOutlined /> {converted}/{m.actionItems.length} jadi task</Text>}
        </div>
      </div>

      <Space orientation="vertical" size={6} style={{ alignItems: "flex-end" }}>
        {joinable && (
          <Button type="primary" size="small" icon={<VideoCameraOutlined />} href={m.meetingUrl} target="_blank" rel="noopener noreferrer">
            Gabung
          </Button>
        )}
        <Space size={4}>
          <Link href={`/meetings/${m.id}`}><Button size="small">Buka</Button></Link>
          {canManage && <Button size="small" icon={<EditOutlined />} aria-label="Ubah rapat" onClick={onEdit} />}
          {canManage && (
            <Popconfirm title="Hapus rapat ini?" description={m.title} okText="Hapus" cancelText="Batal" okButtonProps={{ danger: true }} onConfirm={onDelete}>
              <Button size="small" danger icon={<DeleteOutlined />} aria-label="Hapus rapat" />
            </Popconfirm>
          )}
        </Space>
      </Space>
    </div>
  );
}
