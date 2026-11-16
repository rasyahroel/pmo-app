"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import dayjs, { type Dayjs } from "dayjs";
import "dayjs/locale/id";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { App, Button, Calendar, Card, Checkbox, Col, DatePicker, Empty, Modal, Row, Segmented, Select, Space, Tag, Typography } from "antd";
import { CheckOutlined, LeftOutlined, LockOutlined, RightOutlined } from "@ant-design/icons";
import { projects } from "@/lib/mock-data";
import { useMeetingMeta, useStatusMeta } from "@/lib/master-store";
import { useProjectStructure } from "@/lib/project-structure";
import { useMeetingStore, type MeetingRecord } from "@/lib/meeting-store";
import { useTaskStore } from "@/lib/task-store";
import { useMeetingPermissions } from "@/lib/use-meeting-permissions";
import { useTaskPermissions } from "@/lib/use-task-permissions";
import { buildCalendarEvents, shiftMeeting, shiftTaskDue, type CalEvent, type CalEventKind } from "@/lib/report-data";
import { projectColor, useToday } from "@/lib/task-ui";
import MeetingFormModal from "@/components/meetings/MeetingFormModal";
import { StatusBadge } from "@/components/tasks/TaskStatus";

const { Text, Title } = Typography;

const LAYERS: { key: "meeting" | "task" | "phase"; label: string; color: string; kinds: CalEventKind[] }[] = [
  { key: "meeting", label: "Rapat", color: "#2F80ED", kinds: ["meeting"] },
  { key: "task", label: "Task (jatuh tempo)", color: "#F97316", kinds: ["task"] },
  { key: "phase", label: "Fase (mulai & target live)", color: "#17A34A", kinds: ["phase-start", "phase-live"] },
];
const layerOf = (k: CalEventKind) => LAYERS.find((l) => l.kinds.includes(k))!;
const MAX_CHIPS = 3;

type Draggable = CalEvent & { draggable: boolean };

function chipColor(ev: CalEvent, colorBy: "jenis" | "project") {
  if (ev.kind === "task" && ev.overdue) return "#D92D20";
  return colorBy === "project" ? projectColor(ev.projectId) : layerOf(ev.kind).color;
}

// ---------------------------------------------------------------------------
// Satu peristiwa di sel hari. Rapat bertitik + jam (seperti acara berjam di Google Calendar);
// task dan fase berupa batang berwarna (seperti acara sepanjang hari).
// ---------------------------------------------------------------------------
function Chip({ ev, color, onOpen, overlay }: { ev: Draggable; color: string; onOpen: (e: CalEvent) => void; overlay?: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: ev.id, data: ev, disabled: !ev.draggable || overlay });
  const timed = ev.kind === "meeting";
  const label = timed ? `${ev.time} ${ev.title}` : ev.kind === "task" ? ev.title : ev.title;

  return (
    <div
      ref={overlay ? undefined : setNodeRef}
      {...(overlay ? {} : attributes)}
      {...(overlay ? {} : listeners)}
      role="button"
      tabIndex={0}
      aria-label={`${layerOf(ev.kind).label}: ${ev.title}, ${ev.date}${ev.draggable ? ". Seret untuk memindah tanggal" : ""}`}
      onClick={(e) => {
        e.stopPropagation();
        if (!overlay) onOpen(ev);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          onOpen(ev);
        }
      }}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 5,
        height: 22,
        padding: "0 6px",
        borderRadius: 6,
        fontSize: 12,
        lineHeight: "22px",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        cursor: ev.draggable ? "grab" : "pointer",
        opacity: isDragging ? 0.35 : ev.faded ? 0.55 : 1,
        touchAction: "none",
        textDecoration: ev.faded && ev.kind === "meeting" ? "line-through" : undefined,
        ...(timed
          ? { background: "transparent", color: "#1F2937" }
          : { background: color, color: "#fff", fontWeight: 500 }),
        boxShadow: overlay ? "0 8px 18px rgba(16,49,60,0.3)" : undefined,
      }}
    >
      {timed && <span style={{ width: 8, height: 8, borderRadius: "50%", border: `2px solid ${color}`, flexShrink: 0 }} />}
      {ev.kind === "task" && ev.faded && <CheckOutlined style={{ fontSize: 10 }} />}
      <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{label}</span>
    </div>
  );
}

function DayCell({
  date,
  inMonth,
  isToday,
  isFirst,
  events,
  colorBy,
  onOpen,
  onMore,
  onCreate,
  canCreate,
}: {
  date: Dayjs;
  inMonth: boolean;
  isToday: boolean;
  isFirst: boolean;
  events: Draggable[];
  colorBy: "jenis" | "project";
  onOpen: (e: CalEvent) => void;
  onMore: (date: string) => void;
  onCreate: (date: string) => void;
  canCreate: boolean;
}) {
  const key = date.format("YYYY-MM-DD");
  const { setNodeRef, isOver } = useDroppable({ id: key });
  const shown = events.slice(0, MAX_CHIPS);
  const rest = events.length - shown.length;

  return (
    <div
      ref={setNodeRef}
      onClick={() => canCreate && onCreate(key)}
      title={canCreate ? "Klik area kosong untuk menjadwalkan rapat" : undefined}
      style={{
        minHeight: 118,
        padding: 4,
        borderRight: "1px solid #E5E9EF",
        borderBottom: "1px solid #E5E9EF",
        background: isOver ? "#E8F6F8" : inMonth ? "#fff" : "#FAFBFC",
        cursor: canCreate ? "cell" : "default",
        transition: "background 100ms",
        minWidth: 0,
      }}
    >
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 2 }}>
        <span
          style={{
            minWidth: 26,
            height: 26,
            lineHeight: "26px",
            textAlign: "center",
            borderRadius: 13,
            padding: "0 6px",
            fontSize: 12,
            fontWeight: isToday ? 600 : 500,
            background: isToday ? "#22A7B8" : "transparent",
            color: isToday ? "#fff" : inMonth ? "#1F2937" : "#98A2B3",
          }}
        >
          {isFirst ? date.locale("id").format("D MMM") : date.date()}
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {shown.map((ev) => (
          <Chip key={ev.id} ev={ev} color={chipColor(ev, colorBy)} onOpen={onOpen} />
        ))}
        {rest > 0 && (
          <a
            onClick={(e) => {
              e.stopPropagation();
              onMore(key);
            }}
            style={{ fontSize: 12, color: "#475467", padding: "0 6px", fontWeight: 500 }}
          >
            {rest} lagi
          </a>
        )}
      </div>
    </div>
  );
}

export default function CalendarView() {
  const { message } = App.useApp();
  const today = useToday();
  const { meetings, updateMeeting } = useMeetingStore();
  const { tasks, updateTask } = useTaskStore();
  const { phasesOf } = useProjectStructure();
  const { isDone } = useStatusMeta();
  const meta = useMeetingMeta();
  const meetingPerms = useMeetingPermissions();
  const taskPerms = useTaskPermissions();

  const [cursor, setCursor] = useState<string>(() => dayjs(today).startOf("month").format("YYYY-MM-DD"));
  const [view, setView] = useState<"Bulan" | "Agenda">("Bulan");
  const [layers, setLayers] = useState<Record<string, boolean>>({ meeting: true, task: true, phase: true });
  const [projectIds, setProjectIds] = useState<string[]>([]);
  const [colorBy, setColorBy] = useState<"jenis" | "project">("jenis");
  const [weekStart, setWeekStart] = useState<0 | 1>(1);
  const [active, setActive] = useState<CalEvent | null>(null);
  const [dayList, setDayList] = useState<string | null>(null);
  const [create, setCreate] = useState<string | null>(null);
  const [dragging, setDragging] = useState<Draggable | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const meetingById = useMemo(() => new Map(meetings.map((m) => [m.id, m])), [meetings]);
  const taskById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);

  // semua peristiwa → saring lapisan & project → tandai mana yang boleh digeser
  const events = useMemo<Draggable[]>(() => {
    const all = buildCalendarEvents({
      meetings,
      tasks,
      projects,
      phasesOf,
      isTaskDone: isDone,
      meetingKind: meta.statusKind,
      today,
    });
    return all
      .filter((e) => layers[layerOf(e.kind).key] && (projectIds.length === 0 || projectIds.includes(e.projectId)))
      .map((e) => {
        let draggable = false;
        if (e.kind === "meeting") {
          const m = meetingById.get(e.ref);
          draggable = !!m && meetingPerms.canManage(m);
        } else if (e.kind === "task") {
          const t = taskById.get(e.ref);
          draggable = !!t && taskPerms.canUpdate(t);
        }
        return { ...e, draggable };
      });
  }, [meetings, tasks, phasesOf, isDone, meta, today, layers, projectIds, meetingById, taskById, meetingPerms, taskPerms]);

  const counts = useMemo(() => {
    const month = dayjs(cursor);
    const inMonth = events.filter((e) => dayjs(e.date).isSame(month, "month"));
    return { meeting: inMonth.filter((e) => e.kind === "meeting").length, task: inMonth.filter((e) => e.kind === "task").length, phase: inMonth.filter((e) => e.kind.startsWith("phase")).length };
  }, [events, cursor]);

  const byDate = useMemo(() => {
    const map = new Map<string, Draggable[]>();
    for (const e of events) map.set(e.date, [...(map.get(e.date) ?? []), e]);
    // di tiap hari: rapat berjam dulu (urut jam), lalu task, lalu fase
    const order: Record<CalEventKind, number> = { meeting: 0, task: 1, "phase-start": 2, "phase-live": 3 };
    for (const [k, list] of map) map.set(k, list.sort((a, b) => order[a.kind] - order[b.kind] || (a.time ?? "").localeCompare(b.time ?? "") || a.title.localeCompare(b.title)));
    return map;
  }, [events]);

  // ---- grid bulan
  const first = dayjs(cursor).startOf("month");
  const offset = (first.day() - weekStart + 7) % 7;
  const weeks = Math.ceil((offset + first.daysInMonth()) / 7);
  const gridStart = first.subtract(offset, "day");
  const days = Array.from({ length: weeks * 7 }, (_, i) => gridStart.add(i, "day"));
  const dayNames = Array.from({ length: 7 }, (_, i) => dayjs().day((weekStart + i) % 7).locale("id").format("ddd").toUpperCase());

  const monthEvents = events.filter((e) => dayjs(e.date).isSame(first, "month")).sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? "~").localeCompare(b.time ?? "~"));

  // ---- geser tanggal (drag & drop, atau dari kotak detail)
  function applyMove(ev: CalEvent, newDate: string, withUndo = true): boolean {
    if (newDate === ev.date) return false;
    let undo: (() => { ok: boolean; reason?: string }) | null = null;
    if (ev.kind === "meeting") {
      const m = meetingById.get(ev.ref) as MeetingRecord | undefined;
      if (!m) return false;
      const res = updateMeeting(m.id, shiftMeeting(m, newDate));
      if (!res.ok) {
        message.warning(res.reason);
        return false;
      }
      undo = () => {
        const r = updateMeeting(m.id, { startsAt: m.startsAt, endsAt: m.endsAt });
        return r.ok ? { ok: true } : { ok: false, reason: r.reason };
      };
    } else if (ev.kind === "task") {
      const t = taskById.get(ev.ref);
      if (!t) return false;
      const res = updateTask(t.id, shiftTaskDue(t, newDate));
      if (!res.ok) {
        message.warning(res.reason);
        return false;
      }
      undo = () => {
        const r = updateTask(t.id, { dueDate: t.dueDate, startDate: t.startDate });
        return r.ok ? { ok: true } : { ok: false, reason: r.reason };
      };
    } else {
      message.info("Tanggal fase diubah di tab Fase pada detail project.");
      return false;
    }
    const label = dayjs(newDate).locale("id").format("D MMMM YYYY");
    message.success({
      duration: 6,
      content: (
        <span>
          “{ev.title}” dipindah ke {label}.{" "}
          {withUndo && undo && (
            <a
              onClick={() => {
                const r = undo?.();
                if (r && !r.ok) message.warning(r.reason ?? "Gagal membatalkan.");
                else message.info("Perubahan dibatalkan.");
              }}
            >
              Urungkan
            </a>
          )}
        </span>
      ),
    });
    return true;
  }

  function onDragStart(e: DragStartEvent) {
    setDragging((e.active.data.current as Draggable) ?? null);
  }
  function onDragEnd(e: DragEndEvent) {
    setDragging(null);
    const ev = e.active.data.current as Draggable | undefined;
    if (ev && e.over) applyMove(ev, String(e.over.id));
  }

  const projectOptions = projects.map((p) => ({ value: p.id, label: p.name }));
  const activeMeeting = active?.kind === "meeting" ? meetingById.get(active.ref) : undefined;
  const activeTask = active?.kind === "task" ? taskById.get(active.ref) : undefined;
  const activeDraggable = active ? events.find((e) => e.id === active.id)?.draggable : false;
  const dayEvents = dayList ? byDate.get(dayList) ?? [] : [];

  return (
    <Row gutter={[16, 16]}>
      {/* ---------- sidebar seperti Google Calendar ---------- */}
      <Col xs={24} lg={6} xl={5}>
        <Space orientation="vertical" size={14} style={{ width: "100%" }}>
          <Card size="small" styles={{ body: { padding: 8 } }}>
            <Calendar
              fullscreen={false}
              value={dayjs(cursor)}
              onSelect={(d) => setCursor(d.startOf("month").format("YYYY-MM-DD"))}
              onPanelChange={(d) => setCursor(d.startOf("month").format("YYYY-MM-DD"))}
            />
          </Card>

          <Card size="small" title="Kalender saya">
            <Space orientation="vertical" size={8} style={{ width: "100%" }}>
              {LAYERS.map((l) => (
                <Checkbox key={l.key} checked={layers[l.key]} onChange={(e) => setLayers({ ...layers, [l.key]: e.target.checked })}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 3, background: l.color, display: "inline-block" }} />
                    {l.label}
                    <Text type="secondary" style={{ fontSize: 12 }}>({counts[l.key]})</Text>
                  </span>
                </Checkbox>
              ))}
            </Space>
            <div style={{ marginTop: 12 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>Project</Text>
              <Select mode="multiple" allowClear maxTagCount="responsive" style={{ width: "100%", marginTop: 4 }} placeholder="Semua project" value={projectIds} onChange={setProjectIds} options={projectOptions} optionFilterProp="label" />
            </div>
            <div style={{ marginTop: 12 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>Warna berdasarkan</Text>
              <Segmented block size="small" style={{ marginTop: 4 }} value={colorBy} onChange={(v) => setColorBy(v as "jenis" | "project")} options={[{ value: "jenis", label: "Jenis" }, { value: "project", label: "Project" }]} />
            </div>
            <div style={{ marginTop: 12 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>Minggu dimulai</Text>
              <Segmented block size="small" style={{ marginTop: 4 }} value={weekStart} onChange={(v) => setWeekStart(v as 0 | 1)} options={[{ value: 1, label: "Senin" }, { value: 0, label: "Minggu" }]} />
            </div>
          </Card>

          <Text type="secondary" style={{ fontSize: 12, display: "block" }}>
            Seret rapat atau task ke tanggal lain untuk menjadwal ulang (sesuai hak aksesmu). Tanggal fase diubah di tab Fase pada project.
          </Text>
        </Space>
      </Col>

      {/* ---------- kalender ---------- */}
      <Col xs={24} lg={18} xl={19}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
          <Button shape="round" onClick={() => setCursor(dayjs(today).startOf("month").format("YYYY-MM-DD"))}>Hari ini</Button>
          <Button shape="circle" type="text" icon={<LeftOutlined />} aria-label="Bulan sebelumnya" onClick={() => setCursor(dayjs(cursor).subtract(1, "month").format("YYYY-MM-DD"))} />
          <Button shape="circle" type="text" icon={<RightOutlined />} aria-label="Bulan berikutnya" onClick={() => setCursor(dayjs(cursor).add(1, "month").format("YYYY-MM-DD"))} />
          <Title level={3} style={{ margin: 0, minWidth: 190 }}>{first.locale("id").format("MMMM YYYY")}</Title>
          <span style={{ marginInlineStart: "auto" }}>
            <Segmented value={view} onChange={(v) => setView(v as "Bulan" | "Agenda")} options={["Bulan", "Agenda"]} />
          </span>
        </div>

        {view === "Bulan" ? (
          <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
            <div style={{ border: "1px solid #E5E9EF", borderRadius: 12, overflow: "hidden", background: "#fff" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", borderBottom: "1px solid #E5E9EF", background: "#FAFBFC" }}>
                {dayNames.map((n) => (
                  <div key={n} style={{ textAlign: "center", padding: "8px 0", fontSize: 11, fontWeight: 600, color: "#667085", letterSpacing: 0.4, borderRight: "1px solid #E5E9EF" }}>{n}</div>
                ))}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))" }}>
                {days.map((d) => {
                  const key = d.format("YYYY-MM-DD");
                  return (
                    <DayCell
                      key={key}
                      date={d}
                      inMonth={d.isSame(first, "month")}
                      isToday={key === today}
                      isFirst={d.date() === 1}
                      events={byDate.get(key) ?? []}
                      colorBy={colorBy}
                      onOpen={setActive}
                      onMore={setDayList}
                      onCreate={setCreate}
                      canCreate={meetingPerms.canCreateAny}
                    />
                  );
                })}
              </div>
            </div>
            <DragOverlay>{dragging ? <Chip ev={dragging} color={chipColor(dragging, colorBy)} onOpen={() => undefined} overlay /> : null}</DragOverlay>
          </DndContext>
        ) : (
          <Card>
            {monthEvents.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Tidak ada jadwal bulan ini." />
            ) : (
              <div style={{ display: "flex", flexDirection: "column" }}>
                {Array.from(new Set(monthEvents.map((e) => e.date))).map((date) => (
                  <div key={date} style={{ display: "grid", gridTemplateColumns: "120px minmax(0,1fr)", gap: 12, padding: "10px 0", borderBottom: "1px solid #F0F1F5" }}>
                    <div>
                      <div style={{ fontSize: 20, fontWeight: 600, color: date === today ? "#22A7B8" : undefined }}>{dayjs(date).date()}</div>
                      <Text type="secondary" style={{ fontSize: 12 }}>{dayjs(date).locale("id").format("ddd, MMM YYYY")}</Text>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {(byDate.get(date) ?? []).map((ev) => (
                        <a key={ev.id} onClick={() => setActive(ev)} style={{ display: "flex", gap: 10, alignItems: "center", color: "inherit", opacity: ev.faded ? 0.55 : 1 }}>
                          <span style={{ width: 4, alignSelf: "stretch", borderRadius: 2, background: chipColor(ev, colorBy) }} />
                          <span style={{ width: 54, fontSize: 13, color: "#667085" }}>{ev.time ?? "Seharian"}</span>
                          <span>
                            <span style={{ fontWeight: 500, textDecoration: ev.faded && ev.kind === "meeting" ? "line-through" : undefined }}>{ev.title}</span>
                            <Text type="secondary" style={{ fontSize: 12, display: "block" }}>{layerOf(ev.kind).label} · {ev.subtitle}</Text>
                          </span>
                        </a>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}
      </Col>

      {/* ---------- detail peristiwa ---------- */}
      <Modal open={!!active} onCancel={() => setActive(null)} footer={null} destroyOnHidden width={460} title={active ? layerOf(active.kind).label : ""}>
        {active && (
          <Space orientation="vertical" size={10} style={{ width: "100%" }}>
            <div>
              <Title level={4} style={{ margin: 0, wordBreak: "break-word" }}>{active.title}</Title>
              <Text type="secondary">{active.subtitle}</Text>
            </div>
            <div>
              <Text strong>{dayjs(active.date).locale("id").format("dddd, D MMMM YYYY")}</Text>
              {active.time && <Text> · {active.time}–{active.endTime}</Text>}
            </div>
            {activeMeeting && (
              <Space size={6} wrap>
                <Tag>{meta.categoryName(activeMeeting.categoryId)}</Tag>
                <Tag style={{ color: meta.statusStyle(activeMeeting.statusId).text, background: meta.statusStyle(activeMeeting.statusId).soft, borderColor: meta.statusStyle(activeMeeting.statusId).border }}>{meta.statusName(activeMeeting.statusId)}</Tag>
                <Text type="secondary">{activeMeeting.isOnline ? "Online" : activeMeeting.location} · {activeMeeting.participants.length} peserta</Text>
              </Space>
            )}
            {activeTask && (
              <Space size={8} wrap>
                <StatusBadge status={activeTask.status} />
                <Text type="secondary">PIC: {activeTask.pics.join(", ") || "—"} · progress {activeTask.progressPercent}%</Text>
                {active.overdue && <Tag color="red">Terlambat</Tag>}
              </Space>
            )}
            {active.kind.startsWith("phase") && (
              <Text type="secondary">
                <LockOutlined /> Tanggal fase hanya bisa diubah di tab Fase pada detail project.
              </Text>
            )}
            {activeDraggable && (
              <div>
                <Text type="secondary" style={{ fontSize: 12, display: "block", marginBottom: 4 }}>Pindah ke tanggal lain</Text>
                <DatePicker
                  allowClear={false}
                  value={dayjs(active.date)}
                  style={{ width: "100%" }}
                  onChange={(d) => {
                    if (d && applyMove(active, d.format("YYYY-MM-DD"))) setActive(null);
                  }}
                />
              </div>
            )}
            <Link href={active.href}><Button type="primary">Buka detail</Button></Link>
          </Space>
        )}
      </Modal>

      {/* ---------- semua peristiwa di satu hari ---------- */}
      <Modal open={dayList !== null} onCancel={() => setDayList(null)} footer={null} destroyOnHidden width={440} title={dayList ? dayjs(dayList).locale("id").format("dddd, D MMMM YYYY") : ""}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {dayEvents.map((ev) => (
            <Chip key={ev.id} ev={{ ...ev, draggable: false }} color={chipColor(ev, colorBy)} onOpen={(e) => { setDayList(null); setActive(e); }} overlay />
          ))}
        </div>
      </Modal>

      <MeetingFormModal open={create !== null} meeting={null} defaults={{ date: create ?? undefined }} onClose={() => setCreate(null)} />
    </Row>
  );
}
