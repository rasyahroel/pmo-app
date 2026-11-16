"use client";

import { Fragment } from "react";
import Link from "next/link";
import { Progress, Tag, Tooltip, Typography } from "antd";
import dayjs from "dayjs";
import { getProjectStatusColor, type Phase, type Project, type Task } from "@/lib/mock-data";
import { useTaskStore } from "@/lib/task-store";
import { STAGES, STAGE_COLOR, daysBetween, parallelOf, scheduleOf, skipReason, stageProgress, stageState, type StageState } from "@/lib/timeline-schedule";

const { Text } = Typography;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
export const fmt = (d: string) => {
  const x = dayjs(d);
  return `${x.date()} ${MONTHS[x.month()]}`;
};
export const fmtFull = (d: string) => `${fmt(d)} ${dayjs(d).year()}`;

const STATE_BG: Record<StageState, string> = {
  done: "#F1F8F3",
  active: "#EAF4FB",
  late: "#FDF1F0",
  upcoming: "transparent",
};
const STATE_TEXT: Record<StageState, string> = {
  done: "#3E8E5A",
  active: "#1677C8",
  late: "#CF3E36",
  upcoming: "#8A90A2",
};
const STATE_LABEL: Record<StageState, string> = { done: "Selesai", active: "Berjalan", late: "Terlambat", upcoming: "Belum mulai" };

const cell: React.CSSProperties = {
  borderBottomStyle: "solid",
  borderBottomWidth: 1,
  borderBottomColor: "#E6E8EF",
  borderRightStyle: "solid",
  borderRightWidth: 1,
  borderRightColor: "#E6E8EF",
  padding: "8px 10px",
  verticalAlign: "top",
  fontSize: 13,
};
const head: React.CSSProperties = {
  ...cell,
  background: "#F5F6FA",
  fontWeight: 600,
  position: "sticky",
  top: 0,
  zIndex: 1,
  whiteSpace: "nowrap",
};

// Tabel ala Excel: satu baris per fase, kolom per tahap berisi rentang tanggal + lama (hari) + progress.
export default function TimelineTable({ projects, today }: { projects: Project[]; today: string }) {
  const { tasks } = useTaskStore();
  return (
    <div style={{ overflowX: "auto", background: "#fff", borderStyle: "solid", borderWidth: 1, borderColor: "#E6E8EF", borderRadius: 8 }}>
      <table style={{ borderCollapse: "separate", borderSpacing: 0, width: "100%", minWidth: 1180 }}>
        <thead>
          <tr>
            <th style={{ ...head, textAlign: "left", minWidth: 200 }}>Project</th>
            <th style={{ ...head, textAlign: "left", minWidth: 120 }}>Fase</th>
            {STAGES.map((s) => (
              <th key={s} style={{ ...head, textAlign: "left", minWidth: 150 }}>
                <span style={{ display: "inline-block", width: 9, height: 9, borderRadius: 2, background: STAGE_COLOR[s], marginRight: 6 }} />
                {s}
              </th>
            ))}
            <th style={{ ...head, textAlign: "left", minWidth: 150 }}>Total fase</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((p) => (
            <Fragment key={p.id}>
              {p.phases.map((ph, i) => (
                <PhaseRow key={ph.id} project={p} phase={ph} tasks={tasks} first={i === 0} rowSpan={p.phases.length} today={today} />
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PhaseRow({ project, phase, tasks, first, rowSpan, today }: { project: Project; phase: Phase; tasks: Task[]; first: boolean; rowSpan: number; today: string }) {
  const sch = scheduleOf(phase, tasks, today);
  const parallel = parallelOf(sch);
  const total = daysBetween(phase.startDate, phase.targetLiveDate);
  const left = dayjs(phase.targetLiveDate).diff(dayjs(today), "day");
  const done = phase.stage === "Live" && phase.progressPercent >= 100;
  return (
    <tr>
      {first && (
        <td rowSpan={rowSpan} style={{ ...cell, background: "#FAFBFD" }}>
          <Link href={`/projects/${project.id}`} style={{ fontWeight: 600, color: "inherit" }}>
            {project.name}
          </Link>
          <div />
          <Tag color={getProjectStatusColor(project.status)} style={{ marginTop: 4 }}>
            {project.status}
          </Tag>
        </td>
      )}
      <td style={cell}>
        <Link href={`/projects/${project.id}?tab=fase`} style={{ fontWeight: 500, color: "inherit" }}>
          {phase.name}
        </Link>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {phase.stage}
        </Text>
      </td>
      {STAGES.map((s) => {
        const skip = skipReason(phase, s, project.phases);
        if (skip) {
          return (
            <td key={s} style={{ ...cell, color: "#8A90A2", fontSize: 12, fontStyle: "italic", background: "#F8F9FB" }}>
              {skip}
            </td>
          );
        }
        const r = sch[s];
        if (!r) {
          return (
            <td key={s} style={{ ...cell, color: "#B6BBC9", fontSize: 12 }}>
              belum ada data
            </td>
          );
        }
        const prog = stageProgress(phase, s);
        const st = stageState(r, prog, today);
        return (
          <td key={s} style={{ ...cell, background: STATE_BG[st] }}>
            <Tooltip title={`${fmtFull(r.start)} – ${fmtFull(r.end)} · ${STATE_LABEL[st]} · sumber: ${r.source}`}>
              <div style={{ fontWeight: 500 }}>
                {r.start === r.end ? fmt(r.start) : `${fmt(r.start)} – ${fmt(r.end)}`}
              </div>
            </Tooltip>
            <div style={{ fontSize: 12, color: STATE_TEXT[st] }}>
              {daysBetween(r.start, r.end)} hari · {STATE_LABEL[st]}
            </div>
            {parallel
              .filter((x) => x.a === s || x.b === s)
              .map((x) => (
                <div key={`${x.a}-${x.b}`} style={{ fontSize: 11, color: "#B7791F" }}>
                  ∥ paralel dgn {x.a === s ? x.b : x.a} ({x.days}h)
                </div>
              ))}
            <Progress percent={prog} size="small" showInfo={false} strokeColor={STAGE_COLOR[s]} style={{ marginTop: 2, marginBottom: 0 }} />
          </td>
        );
      })}
      <td style={cell}>
        <div style={{ fontWeight: 500 }}>
          {fmtFull(phase.startDate)} – {fmtFull(phase.targetLiveDate)}
        </div>
        <div style={{ fontSize: 12, color: done ? "#3E8E5A" : left < 0 ? "#CF3E36" : "#8A90A2" }}>
          {total} hari · {done ? "Sudah live" : left < 0 ? `lewat ${-left} hari` : `sisa ${left} hari`}
        </div>
        <Progress percent={phase.progressPercent} size="small" style={{ marginBottom: 0 }} />
      </td>
    </tr>
  );
}
