"use client";

import { useMemo, useState } from "react";
import { Alert, DatePicker, Input, Segmented, Select, Space, Typography } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import dayjs, { type Dayjs } from "dayjs";
import PageSkeleton from "@/components/layout/PageSkeleton";
import TimelineTable from "@/components/timeline/TimelineTable";
import TimelineGantt from "@/components/timeline/TimelineGantt";
import { projects, type PhaseStage } from "@/lib/mock-data";
import { STAGES, STAGE_COLOR } from "@/lib/timeline-schedule";
import { useToday } from "@/lib/task-ui";

const { Text } = Typography;

const PRESETS: { label: string; value: [Dayjs, Dayjs] }[] = [
  { label: "Bulan ini", value: [dayjs().startOf("month"), dayjs().endOf("month")] },
  { label: "3 bulan ke depan", value: [dayjs().startOf("month"), dayjs().add(2, "month").endOf("month")] },
  { label: "Kuartal ini", value: [dayjs().month(Math.floor(dayjs().month() / 3) * 3).startOf("month"), dayjs().month(Math.floor(dayjs().month() / 3) * 3 + 2).endOf("month")] },
  { label: "Tahun ini", value: [dayjs().startOf("year"), dayjs().endOf("year")] },
];

export default function TimelinePage() {
  const today = useToday();
  const [view, setView] = useState<"table" | "gantt">("gantt");
  const [projectId, setProjectId] = useState<string>("all");
  const [stage, setStage] = useState<PhaseStage | "all">("all");
  const [q, setQ] = useState("");
  const [period, setPeriod] = useState<[Dayjs, Dayjs] | null>(null);
  const range: [string, string] | null = period ? [period[0].format("YYYY-MM-DD"), period[1].format("YYYY-MM-DD")] : null;

  // Filter: project, tahap fase saat ini, periode (fase yang rentangnya beririsan), dan pencarian
  // (nama project, nomor CR/BR, nama fase, tahap).
  const shown = useMemo(() => {
    const kw = q.trim().toLowerCase();
    const [from, to] = range ?? ["", ""];
    return projects
      .filter((p) => projectId === "all" || p.id === projectId)
      .map((p) => {
        const projectHit = !!kw && [p.name, p.crNumber, p.brNumber].some((x) => x?.toLowerCase().includes(kw));
        const phases = p.phases.filter(
          (ph) =>
            (stage === "all" || ph.stage === stage) &&
            (!range || (ph.startDate <= to && ph.targetLiveDate >= from)) &&
            (!kw || projectHit || `${ph.name} ${ph.stage}`.toLowerCase().includes(kw)),
        );
        return { ...p, phases };
      })
      .filter((p) => p.phases.length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, stage, q, range?.[0], range?.[1]]);

  return (
    <PageSkeleton path="/timeline">
      <Space orientation="vertical" size={16} style={{ width: "100%" }}>
        <Alert
          type="info"
          showIcon
          title="Data halaman ini diambil otomatis dari menu lain"
          description={
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              <li>
                <b>Project, fase, status, progress</b> ← data project (Project › detail).
              </li>
              <li>
                <b>Dokumen</b> ← tanggal mulai fase sampai tanggal approval terakhir dokumen (Project › detail › Dokumen); kalau belum semua approved, berjalan sampai hari ini.
              </li>
              <li>
                <b>Development</b> ← tanggal mulai–due task di <b>Task Board</b> (kategori Development/Migrasi). <b>Testing</b> ← task kategori Testing <i>dan</i> periode yang diisi di menu <b>Pengujian</b>. Ubah task atau pengujian, timeline ikut berubah.
              </li>
              <li>
                <b>Tidak semua tahap ada di setiap fase.</b> Fase lanjutan (mis. Fase 2) yang tidak punya dokumen baru dan merujuk fase sebelumnya ditandai “tidak ada dokumen baru” — langsung ke Development, dan tidak dihitung terlambat. Dokumen hasil testing &amp; migrasi dihitung di tahapnya masing-masing.
              </li>
              <li>
                <b>Live</b> ← target live fase. Tahap yang belum punya data tampil “belum ada data”.
              </li>
              <li>
                <b>Paralel</b> — tahap yang jadwalnya tumpang-tindih ditandai tag oranye &amp; area arsir di Gantt.
              </li>
            </ul>
          }
        />

        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", justifyContent: "space-between" }}>
          <Space wrap>
            <Segmented
              value={view}
              onChange={(v) => setView(v as "table" | "gantt")}
              options={[
                { label: "Tabel", value: "table" },
                { label: "Gantt", value: "gantt" },
              ]}
            />
            <Select
              value={projectId}
              onChange={setProjectId}
              style={{ minWidth: 240 }}
              options={[{ value: "all", label: "Semua project" }, ...projects.map((p) => ({ value: p.id, label: p.name }))]}
            />
            <Select
              value={stage}
              onChange={setStage}
              style={{ minWidth: 170 }}
              options={[{ value: "all", label: "Semua tahap fase" }, ...STAGES.map((s) => ({ value: s, label: `Sedang di ${s}` }))]}
            />
            <DatePicker.RangePicker
              value={period}
              onChange={(v) => setPeriod(v && v[0] && v[1] ? [v[0], v[1]] : null)}
              picker="month"
              format="MM/YYYY"
              presets={PRESETS}
              placeholder={["Dari bulan", "Sampai bulan"]}
              allowClear
            />
            <Input allowClear prefix={<SearchOutlined />} placeholder="Cari project, CR/BR, fase..." value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 220 }} />
          </Space>
          <Space size={14} wrap>
            {STAGES.map((s) => (
              <span key={s} style={{ fontSize: 12 }}>
                <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: STAGE_COLOR[s], marginRight: 5 }} />
                {s}
              </span>
            ))}
            {view === "gantt" && (
              <>
                <span style={{ fontSize: 12 }}>
                  <span style={{ display: "inline-block", width: 2, height: 12, background: "#E5484D", marginRight: 5, verticalAlign: "middle" }} />
                  Hari ini
                </span>
                <span style={{ fontSize: 12 }}>
                  <span style={{ display: "inline-block", width: 12, height: 12, background: "#F59E0B33", marginRight: 5, verticalAlign: "middle" }} />
                  Paralel
                </span>
              </>
            )}
          </Space>
        </div>

        {view === "table" ? <TimelineTable projects={shown} today={today} /> : <TimelineGantt projects={shown} today={today} range={range} />}

        <Text type="secondary" style={{ fontSize: 12 }}>
          Klik nama project / fase / tahap untuk membuka halamannya. Di Gantt, bagian bar yang pekat = progress tahap, tepi merah = lewat jadwal tapi belum 100%. Di Tabel: merah = terlambat, biru = berjalan, hijau = selesai.
        </Text>
      </Space>
    </PageSkeleton>
  );
}
