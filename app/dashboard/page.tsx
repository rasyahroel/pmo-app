"use client";

import { useMemo } from "react";
import Link from "next/link";
import dayjs from "dayjs";
import { Button, Card, Col, Empty, Progress, Row, Table, Tag, Typography } from "antd";
import { BarChart, Bar, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { RightOutlined } from "@ant-design/icons";
import PageSkeleton from "@/components/layout/PageSkeleton";
import { DueChip, MyTasksCard, PicProgressCard, useMyWork } from "@/components/dashboard/MyWork";
import { agi } from "@/app/providers";
import { getProjectStatusColor, type PhaseStage, type Project } from "@/lib/mock-data";
import { isAdministrator } from "@/lib/access";
import { useCurrentUser } from "@/lib/acting-user";
import { getEmployees } from "@/lib/employee-registry";
import { useMeetingMeta, useStatusMeta } from "@/lib/master-store";
import { useMeetingStore } from "@/lib/meeting-store";
import { useToday } from "@/lib/task-ui";
import { useMeetingPermissions } from "@/lib/use-meeting-permissions";
import { useMyNotifications } from "@/lib/use-reminders";
import { useUserStore } from "@/lib/user-store";

const { Text, Title } = Typography;

const STATUS_HEX: Record<string, string> = { Active: "#17C653", Hold: "#F6B100", Cancelled: "#F8285A" };
const STAGES: PhaseStage[] = ["Dokumen", "Development", "Testing", "Live"];
const STAGE_HEX: Record<PhaseStage, string> = { Dokumen: "#7BDDE5", Development: "#22A7B8", Testing: "#F6B100", Live: "#17C653" };

function Tile({ label, value, href, tone, hint }: { label: string; value: number | string; href?: string; tone?: string; hint?: string }) {
  const body = (
    <Card size="small" hoverable={!!href} styles={{ body: { padding: "14px 16px" } }} style={{ height: "100%" }}>
      <div style={{ fontSize: 12.5, color: "#6B7185" }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 600, lineHeight: 1.25, color: tone ?? "#1F2937" }}>{value}</div>
      {hint && <div style={{ fontSize: 12, color: "#8A90A2" }}>{hint}</div>}
    </Card>
  );
  return href ? (
    <Link href={href} style={{ display: "block", height: "100%" }}>
      {body}
    </Link>
  ) : (
    body
  );
}

function Section({ title, children, extra }: { title: string; children: React.ReactNode; extra?: React.ReactNode }) {
  return (
    <div style={{ marginTop: 28 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
        <Title level={5} style={{ margin: 0, color: "#206D7E" }}>
          {title}
        </Title>
        {extra}
      </div>
      {children}
    </div>
  );
}

function DashboardContent() {
  const me = useCurrentUser();
  const today = useToday();
  const data = useMyWork();
  const { statuses } = useStatusMeta();
  const { meetings } = useMeetingStore();
  const meta = useMeetingMeta();
  const mperms = useMeetingPermissions();
  const { unread } = useMyNotifications();
  const { users } = useUserStore();
  const admin = isAdministrator(me);

  const hour = today ? dayjs().hour() : -1;
  const greeting = hour < 0 ? "Halo" : hour < 11 ? "Selamat pagi" : hour < 15 ? "Selamat siang" : hour < 19 ? "Selamat sore" : "Selamat malam";

  const rows = data.projectRows;
  const stats = useMemo(() => {
    const n = rows.length;
    const count = (s: string) => rows.filter((r) => r.project.status === s).length;
    return { total: n, active: count("Active"), hold: count("Hold"), cancelled: count("Cancelled"), avg: n ? Math.round(rows.reduce((s, r) => s + r.project.overallProgress, 0) / n) : 0 };
  }, [rows]);

  const upcoming = useMemo(() => {
    if (!today) return [];
    const now = dayjs();
    return meetings.filter((m) => meta.statusKind(m.statusId) === "planned" && dayjs(m.endsAt).isAfter(now)).slice(0, 5);
  }, [meetings, meta, today]);
  const within24h = upcoming.filter((m) => dayjs(m.startsAt).diff(dayjs(), "hour") <= 24).length;

  const noResult = useMemo(() => meetings.filter((m) => meta.statusKind(m.statusId) === "done" && !m.summary && !m.attachments.length && mperms.canManage(m)).length, [meetings, meta, mperms]);
  const unlinked = admin ? users.filter((u) => u.active && !getEmployees().some((e) => e.userId === u.id)).length : 0;

  const attention = [
    data.managedCount > 0 && data.managedLate > 0 && { text: `${data.managedLate} task terlambat di project yang kamu pegang`, href: "/tasks" },
    data.managedCount > 0 && stats.hold > 0 && { text: `${stats.hold} project berstatus Hold`, href: "/projects" },
    data.managedCount > 0 && noResult > 0 && { text: `${noResult} rapat selesai belum ada hasilnya`, href: "/meetings" },
    admin && unlinked > 0 && { text: `${unlinked} akun belum terhubung ke Master Pegawai`, href: "/user-management/users" },
  ].filter(Boolean) as { text: string; href: string }[];

  const progressData = rows.map((r) => ({ name: r.project.name, progress: r.project.overallProgress, status: r.project.status }));
  const statusData = ["Active", "Hold", "Cancelled"].map((s) => ({ name: s, value: rows.filter((r) => r.project.status === s).length })).filter((d) => d.value > 0);
  const taskByStatus = statuses.map((s) => ({ name: s.name, value: data.scopedTasks.filter((t) => !t.parentId && t.status === s.id).length, color: s.color }));
  const byStage = STAGES.map((s) => ({ name: s, value: rows.filter((r) => r.phase?.stage === s).length }));

  return (
    <div>
      {/* Sapaan + cakupan data sesuai role */}
      <Card styles={{ body: { padding: "16px 20px" } }} style={{ background: `linear-gradient(120deg, ${agi[50]}, #fff 60%)`, borderColor: agi[100] }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <Title level={4} style={{ margin: 0 }}>
              {greeting}, {me.name.split(" ")[0]}
            </Title>
            <Text type="secondary">
              {me.roles.map((r) => (
                <Tag key={r} color={agi[100]} style={{ color: agi[800], border: 0 }}>
                  {r}
                </Tag>
              ))}
              {admin ? "Melihat semua project (Administrator)." : `Melihat ${rows.length} project yang kamu ikuti${data.managedCount ? `, ${data.managedCount} kamu pegang sebagai PMO` : ""}.`}
            </Text>
          </div>
          <Link href="/notifications">
            <Button icon={<RightOutlined />} iconPlacement="end">
              {unread > 0 ? `${unread} notifikasi belum dibaca` : "Tidak ada notifikasi baru"}
            </Button>
          </Link>
        </div>
      </Card>

      {attention.length > 0 && (
        <Card size="small" title="Perlu perhatian" style={{ marginTop: 16, borderColor: "#F6D58E", background: "#FFFBF0" }} styles={{ header: { background: "transparent", borderBottomColor: "#F6D58E" } }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {attention.map((a) => (
              <Link key={a.text} href={a.href}>
                <Tag color="warning" style={{ fontSize: 13, padding: "3px 10px", cursor: "pointer", color: "#7A4B00" }}>
                  {a.text} <RightOutlined style={{ fontSize: 10 }} />
                </Tag>
              </Link>
            ))}
          </div>
        </Card>
      )}

      <Section title="Pekerjaan saya">
        <Row gutter={[16, 16]}>
          <Col xs={12} md={6}>
            <Tile label="Task aktif" value={data.active.length} href="/tasks" />
          </Col>
          <Col xs={12} md={6}>
            <Tile label="Terlambat" value={data.overdue.length} href="/tasks" tone={data.overdue.length ? "#C4153F" : undefined} />
          </Col>
          <Col xs={12} md={6}>
            <Tile label="Jatuh tempo ≤ 7 hari" value={data.soon.length} href="/tasks" tone={data.soon.length ? "#9A6200" : undefined} />
          </Col>
          <Col xs={12} md={6}>
            <Tile label="Rapat 24 jam ke depan" value={within24h} href="/meetings" />
          </Col>
        </Row>
        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col xs={24} xl={15}>
            <MyTasksCard data={data} />
          </Col>
          <Col xs={24} xl={9}>
            <Card title="Rapat Mendatang" extra={<Link href="/meetings">Semua rapat</Link>} style={{ height: "100%" }}>
              {upcoming.length === 0 ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Tidak ada rapat terjadwal." />
              ) : (
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {upcoming.map((m, i) => (
                    <div key={m.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "10px 0", borderTop: i ? "1px solid #F0F1F5" : undefined }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 500 }}>{m.title}</div>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {dayjs(m.startsAt).format("DD MMM YYYY, HH:mm")} · {m.isOnline ? "Online" : (m.location ?? "Offline")} · {m.participants.length} peserta
                        </Text>
                      </div>
                      <Tag style={{ marginInlineEnd: 0, alignSelf: "flex-start" }}>{meta.categoryName(m.categoryId)}</Tag>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </Col>
        </Row>
      </Section>

      <Section title={admin ? "Ringkasan semua project" : "Ringkasan project saya"}>
        {rows.length === 0 ? (
          <Card>
            <Empty description="Belum ada project yang terkait denganmu. Project muncul di sini bila kamu anggota tim (PMO/Developer), pembuat project, atau PIC sebuah task." />
          </Card>
        ) : (
          <>
            <Row gutter={[16, 16]}>
              <Col xs={12} md={6}>
                <Tile label="Total project" value={stats.total} href="/projects" />
              </Col>
              <Col xs={12} md={6}>
                <Tile label="Aktif" value={stats.active} tone="#3E8E5A" />
              </Col>
              <Col xs={12} md={6}>
                <Tile label="Hold" value={stats.hold} tone={stats.hold ? "#C08B2C" : undefined} />
              </Col>
              <Col xs={12} md={6}>
                <Tile label="Rata-rata progress" value={`${stats.avg}%`} />
              </Col>
            </Row>

            <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
              <Col xs={24} lg={14}>
                <Card title="Progress per Project">
                  <ResponsiveContainer width="100%" height={Math.max(180, progressData.length * 56)}>
                    <BarChart data={progressData} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#EAF6F8" />
                      <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12 }} unit="%" />
                      <YAxis type="category" dataKey="name" width={170} tick={{ fontSize: 12 }} />
                      <Tooltip formatter={(v) => [`${v}%`, "Progress"]} />
                      <Bar dataKey="progress" radius={[0, 6, 6, 0]} barSize={22}>
                        {progressData.map((d) => (
                          <Cell key={d.name} fill={d.status === "Hold" ? "#F6B100" : d.status === "Cancelled" ? "#F8285A" : agi[400]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Warna batang mengikuti status project: biru = aktif, kuning = hold, merah = dibatalkan.
                  </Text>
                </Card>
              </Col>
              <Col xs={24} lg={10}>
                <Card title="Status Project">
                  <div style={{ position: "relative" }}>
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={58} outerRadius={86} paddingAngle={3}>
                          {statusData.map((d) => (
                            <Cell key={d.name} fill={STATUS_HEX[d.name]} />
                          ))}
                        </Pie>
                        <Legend verticalAlign="bottom" height={24} />
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                    <div style={{ position: "absolute", top: 74, left: 0, right: 0, textAlign: "center", pointerEvents: "none" }}>
                      <div style={{ fontSize: 28, fontWeight: 600, lineHeight: 1 }}>{stats.total}</div>
                      <div style={{ fontSize: 12, color: "#6B7185" }}>project</div>
                    </div>
                  </div>
                </Card>
              </Col>
            </Row>

            <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
              <Col xs={24} lg={12}>
                <Card title="Task per Status" extra={<Text type="secondary" style={{ fontSize: 12 }}>task induk, seperti kolom Task Board</Text>}>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={taskByStatus} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EAF6F8" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} interval={0} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                      <Tooltip formatter={(v) => [v, "Task"]} />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={34}>
                        {taskByStatus.map((d) => (
                          <Cell key={d.name} fill={d.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
              </Col>
              <Col xs={24} lg={12}>
                <Card title="Project per Tahap" extra={<Text type="secondary" style={{ fontSize: 12 }}>tahap fase terakhir tiap project</Text>}>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={byStage} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EAF6F8" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                      <Tooltip formatter={(v) => [v, "Project"]} />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={34}>
                        {byStage.map((d) => (
                          <Cell key={d.name} fill={STAGE_HEX[d.name as PhaseStage]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
              </Col>
            </Row>

            <Card title="Project Berjalan" style={{ marginTop: 16 }} styles={{ body: { paddingTop: 8 } }}>
              <Table
                rowKey={(r) => r.project.id}
                size="middle"
                scroll={{ x: "max-content" }}
                pagination={false}
                dataSource={rows}
                columns={[
                  {
                    title: "Project",
                    render: (_, r) => (
                      <div>
                        <Link href={`/projects/${r.project.id}`} style={{ fontWeight: 500, color: "inherit" }}>
                          {r.project.name}
                        </Link>
                        <div>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {r.project.directorate} · {r.project.subdirectorate}
                          </Text>
                        </div>
                      </div>
                    ),
                  },
                  { title: "Status", width: 100, render: (_, r) => <Tag color={getProjectStatusColor(r.project.status as Project["status"])}>{r.project.status}</Tag> },
                  { title: "Fase berjalan", render: (_, r) => (r.phase ? <span>{r.phase.name} · <Tag color={STAGE_HEX[r.phase.stage]} style={{ color: "#10313C", marginInlineEnd: 0 }}>{r.phase.stage}</Tag></span> : "—") },
                  { title: "Progress", width: 150, render: (_, r) => <Progress percent={r.project.overallProgress} size="small" /> },
                  { title: "Task", width: 140, render: (_, r) => (r.total ? <span>{r.open} aktif{r.late ? <Text style={{ color: "#C4153F" }}> · {r.late} terlambat</Text> : ""}</span> : <Text type="secondary">belum ada</Text>) },
                  { title: "Target live", width: 170, render: (_, r) => (r.target ? <DueChip date={r.target} done={r.project.overallProgress >= 100} today={today} /> : "—") },
                  { title: "PMO", render: (_, r) => <Text style={{ fontSize: 13 }}>{r.pmoNames.join(", ") || "—"}</Text> },
                ]}
              />
            </Card>
            <PicProgressCard data={data} />
          </>
        )}
      </Section>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <PageSkeleton path="/dashboard">
      <DashboardContent />
    </PageSkeleton>
  );
}
