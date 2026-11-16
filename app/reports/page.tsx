"use client";

import { Collapse, Tabs } from "antd";
import { BarChartOutlined, CalendarOutlined, TableOutlined } from "@ant-design/icons";
import PageSkeleton from "@/components/layout/PageSkeleton";
import ReportSummary from "@/components/reports/ReportSummary";
import CalendarView from "@/components/reports/CalendarView";
import ProjectReportTable from "@/components/reports/ProjectReportTable";

// Laporan: tiga cara melihat kondisi seluruh project.
//  - Ringkasan : angka penting dan daftar project yang perlu perhatian.
//  - Kalender  : rapat, jatuh tempo task, serta mulai dan target live fase dalam satu kalender.
//  - Tabel     : data lengkap per project (dan per fase) untuk rapat dan ekspor.
export default function ReportsPage() {
  return (
    <PageSkeleton path="/reports">
      <Collapse
        style={{ marginBottom: 16, background: "#F5FAFB" }}
        items={[
          {
            key: "about",
            label: <b>Laporan ini untuk apa?</b>,
            children: (
              <ul style={{ margin: 0, paddingInlineStart: 20, lineHeight: 1.8 }}>
                <li><b>Ringkasan</b>: melihat sekilas kesehatan semua project, jumlah task terlambat, rapat tanpa hasil, dan <b>project yang perlu perhatian</b> (di-Hold, ada task terlambat, atau target live mepet) tanpa membuka satu per satu.</li>
                <li><b>Kalender</b>: satu kalender untuk <b>rapat</b>, <b>jatuh tempo task</b>, serta <b>mulai dan target live fase</b>. Bisa disaring per project, dan rapat atau task bisa <b>digeser ke tanggal lain</b> (sesuai hak aksesmu).</li>
                <li><b>Tabel Project</b>: data lengkap per project (tahap, target, progress, task aktif, terlambat, rapat berikutnya) yang bisa dibuka per fase dan <b>diekspor ke CSV</b> untuk bahan rapat atau pelaporan berkala.</li>
              </ul>
            ),
          },
        ]}
      />
      <Tabs
        defaultActiveKey="summary"
        destroyOnHidden
        items={[
          { key: "summary", label: <span><BarChartOutlined /> Ringkasan</span>, children: <ReportSummary /> },
          { key: "calendar", label: <span><CalendarOutlined /> Kalender</span>, children: <CalendarView /> },
          { key: "table", label: <span><TableOutlined /> Tabel Project</span>, children: <ProjectReportTable /> },
        ]}
      />
    </PageSkeleton>
  );
}
