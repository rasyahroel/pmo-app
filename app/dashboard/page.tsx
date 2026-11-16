"use client";

import { Row, Col, Card, Statistic, Table, Tag, Progress, Typography } from "antd";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { projects, meetings, getProjectStatusColor } from "@/lib/mock-data";
import PageSkeleton from "@/components/layout/PageSkeleton";
import { agi } from "@/app/providers";

const { Text } = Typography;

const STATUS_COLOR_HEX: Record<string, string> = {
  Active: "#17C653",
  Hold: "#F6B100",
  Cancelled: "#F8285A",
};

export default function DashboardPage() {
  const total = projects.length;
  const active = projects.filter((p) => p.status === "Active").length;
  const hold = projects.filter((p) => p.status === "Hold").length;
  const avgProgress = Math.round(
    projects.reduce((sum, p) => sum + p.overallProgress, 0) / total
  );

  const upcoming = meetings
    .filter((m) => m.status === "Scheduled")
    .sort((a, b) => a.date.localeCompare(b.date));

  const progressData = projects.map((p) => ({
    name: p.name.length > 16 ? p.name.slice(0, 16) + "…" : p.name,
    progress: p.overallProgress,
  }));

  const statusData = ["Active", "Hold", "Cancelled"]
    .map((status) => ({
      name: status,
      value: projects.filter((p) => p.status === status).length,
    }))
    .filter((d) => d.value > 0);

  return (
    <PageSkeleton path="/dashboard">
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={12} sm={12} md={6}>
          <Card>
            <Statistic title="Total Project" value={total} />
          </Card>
        </Col>
        <Col xs={12} sm={12} md={6}>
          <Card>
            <Statistic
              title="Project Aktif"
              value={active}
              styles={{ content: { color: "#3E8E5A" } }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={12} md={6}>
          <Card>
            <Statistic
              title="Project Hold"
              value={hold}
              styles={{ content: { color: "#C08B2C" } }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={12} md={6}>
          <Card>
            <Statistic title="Rata-rata Progress" value={avgProgress} suffix="%" />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} lg={16}>
          <Card title="Progress per Project">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={progressData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EAF6F8" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} interval={0} />
                <YAxis tick={{ fontSize: 12 }} domain={[0, 100]} />
                <Tooltip formatter={(v) => [`${v}%`, "Progress"]} />
                <Bar dataKey="progress" fill={agi[400]} radius={[6, 6, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card title="Distribusi Status Project">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={statusData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={3}
                >
                  {statusData.map((d) => (
                    <Cell key={d.name} fill={STATUS_COLOR_HEX[d.name]} />
                  ))}
                </Pie>
                <Legend verticalAlign="bottom" height={24} />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <Card title="Project Berjalan" styles={{ body: { paddingTop: 8 } }}>
            <Table
              rowKey="id"
              scroll={{ x: "max-content" }}
              pagination={false}
              dataSource={projects}
              columns={[
                {
                  title: "Project",
                  dataIndex: "name",
                  render: (v, r) => (
                    <div>
                      <div style={{ fontWeight: 500 }}>{v}</div>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {r.directorate} · {r.subdirectorate}
                      </Text>
                    </div>
                  ),
                },
                {
                  title: "Status",
                  dataIndex: "status",
                  width: 110,
                  render: (v) => <Tag color={getProjectStatusColor(v)}>{v}</Tag>,
                },
                {
                  title: "Fase Berjalan",
                  render: (_, r) => {
                    const active = r.phases[r.phases.length - 1];
                    return `${active.name} · ${active.stage}`;
                  },
                },
                {
                  title: "Progress",
                  dataIndex: "overallProgress",
                  width: 160,
                  render: (v) => <Progress percent={v} size="small" />,
                },
              ]}
            />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card title="Rapat Mendatang">
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {upcoming.map((m) => (
                <div
                  key={m.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    paddingBottom: 14,
                    borderBottom: "1px solid #F0F1F5",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 500 }}>{m.title}</div>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {new Date(m.date).toLocaleString("id-ID", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </Text>
                  </div>
                  <Tag>{m.category}</Tag>
                </div>
              ))}
            </div>
          </Card>
        </Col>
      </Row>
    </PageSkeleton>
  );
}
