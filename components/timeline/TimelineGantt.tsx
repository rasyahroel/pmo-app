"use client";

import { Fragment, useMemo } from "react";
import Link from "next/link";
import { Empty, Tag, Tooltip, Typography } from "antd";
import dayjs from "dayjs";
import { getProjectStatusColor, type PhaseStage, type Project } from "@/lib/mock-data";
import { useTaskStore } from "@/lib/task-store";
import { useTestStore } from "@/lib/test-store";
import { STAGES, STAGE_COLOR, daysBetween, parallelOf, scheduleOf, skipReason, stageProgress, stageState } from "@/lib/timeline-schedule";
import { fmt, fmtFull } from "@/components/timeline/TimelineTable";

const { Text } = Typography;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const LABEL_W = 300;
const ROW_H = 36;
const BORDER = "#E6E8EF";
const SOFT = "#EEF0F5";

// Tujuan klik tiap tahap: tab di detail project (atau halaman Pengujian untuk Testing).
const stageHref = (projectId: string, stage: PhaseStage) =>
  stage === "Testing"
    ? `/testing?projectId=${projectId}`
    : `/projects/${projectId}?tab=${stage === "Dokumen" ? "dokumen" : stage === "Development" ? "task-rapat" : "git-env"}`;

// Gantt: per project → per fase → satu baris per tahap (Dokumen, Development, Testing, Live).
export default function TimelineGantt({ projects, today, range }: { projects: Project[]; today: string; range?: [string, string] | null }) {
  const { tasks } = useTaskStore();
  const { records: tests } = useTestStore();
  const { min, span, months } = useMemo(() => {
    const dates = projects.flatMap((p) =>
      p.phases.flatMap((ph) => [ph.startDate, ph.targetLiveDate, ...STAGES.flatMap((s) => { const r = scheduleOf(ph, tasks, today, tests)[s]; return r ? [r.start, r.end] : []; })]),
    );
    if (dates.length === 0) return { min: dayjs(), span: 1, months: [] as { label: string; left: number; width: number }[] };
    // kalau ada filter periode, sumbu waktu dipotong sesuai periode itu
    const start = dayjs(range ? range[0] : dates.reduce((a, b) => (a < b ? a : b))).startOf("month");
    const end = dayjs(range ? range[1] : dates.reduce((a, b) => (a > b ? a : b))).endOf("month");
    const total = end.diff(start, "day") + 1;
    const ms: { label: string; left: number; width: number }[] = [];
    for (let m = start; m.isBefore(end); m = m.add(1, "month")) {
      ms.push({
        label: `${MONTHS[m.month()]}${m.month() === 0 || ms.length === 0 ? ` ${m.year()}` : ""}`,
        left: (m.diff(start, "day") / total) * 100,
        width: (m.daysInMonth() / total) * 100,
      });
    }
    return { min: start, span: total, months: ms };
  }, [projects, tasks, tests, today, range]);

  if (projects.length === 0) return <Empty description="Tidak ada project/fase yang cocok." style={{ padding: 40 }} />;

  const pos = (d: string) => (dayjs(d).diff(min, "day") / span) * 100;
  const todayPos = pos(today);
  const showToday = !!today && todayPos >= 0 && todayPos <= 100;
  const grid = months.map((m) => (
    <div key={m.left} style={{ position: "absolute", left: `${m.left}%`, top: 0, bottom: 0, borderLeftStyle: "solid", borderLeftWidth: 1, borderLeftColor: "#F0F1F5" }} />
  ));
  const todayLine = showToday && <div style={{ position: "absolute", left: `${todayPos}%`, top: 0, bottom: 0, width: 2, background: "#E5484D", zIndex: 2 }} />;

  return (
    <div style={{ overflowX: "auto", background: "#fff", borderStyle: "solid", borderWidth: 1, borderColor: BORDER, borderRadius: 8 }}>
      <div style={{ minWidth: 1150 }}>
        <div style={{ display: "flex", background: "#F5F6FA", borderBottomStyle: "solid", borderBottomWidth: 1, borderBottomColor: BORDER }}>
          <div style={{ width: LABEL_W, flexShrink: 0, padding: "8px 12px", fontWeight: 600, fontSize: 13 }}>Project / Fase / Tahap</div>
          <div style={{ position: "relative", flex: 1, height: 34 }}>
            {months.map((m) => (
              <div
                key={m.left}
                style={{
                  position: "absolute", left: `${m.left}%`, width: `${m.width}%`, top: 0, bottom: 0, fontSize: 11, color: "#6B7185", padding: "9px 4px",
                  borderLeftStyle: "solid", borderLeftWidth: 1, borderLeftColor: BORDER, whiteSpace: "nowrap", overflow: "hidden",
                }}
              >
                {m.label}
              </div>
            ))}
          </div>
        </div>

        {projects.map((p) => (
          <Fragment key={p.id}>
            <div style={{ padding: "8px 12px", background: "#EEF1F7", borderBottomStyle: "solid", borderBottomWidth: 1, borderBottomColor: BORDER, fontWeight: 600, fontSize: 13 }}>
              <Link href={`/projects/${p.id}`} style={{ color: "inherit" }}>
                {p.name}
              </Link>
              <Tag color={getProjectStatusColor(p.status)} style={{ marginLeft: 8 }}>
                {p.status}
              </Tag>
              {p.crNumber && (
                <Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>
                  {p.crNumber}
                </Text>
              )}
            </div>

            {p.phases.map((ph) => {
              const sch = scheduleOf(ph, tasks, today, tests);
              const parallel = parallelOf(sch);
              return (
                <Fragment key={ph.id}>
                  <div style={{ padding: "6px 12px 6px 24px", background: "#FAFBFD", borderBottomStyle: "solid", borderBottomWidth: 1, borderBottomColor: SOFT, fontSize: 13 }}>
                    <Link href={`/projects/${p.id}?tab=fase`} style={{ fontWeight: 600, color: "inherit" }}>
                      {ph.name}
                    </Link>{" "}
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      · sekarang di {ph.stage} · {ph.progressPercent}% · {fmtFull(ph.startDate)} – {fmtFull(ph.targetLiveDate)}
                    </Text>
                    {parallel.map((x) => (
                      <Tooltip key={`${x.a}-${x.b}`} title={`${x.a} dan ${x.b} dikerjakan bersamaan ${fmtFull(x.start)} – ${fmtFull(x.end)}`}>
                        <Tag color="orange" style={{ marginLeft: 8, fontSize: 11 }}>
                          Paralel: {x.a} ∥ {x.b} · {x.days}h
                        </Tag>
                      </Tooltip>
                    ))}
                  </div>

                  {STAGES.map((s) => {
                    const skip = skipReason(ph, s, p.phases);
                    const r = skip ? undefined : sch[s];
                    const prog = stageProgress(ph, s);
                    const st = r ? stageState(r, prog, today) : "upcoming";
                    const dayCount = r ? daysBetween(r.start, r.end) : 0;
                    const w = r ? Math.max((dayCount / span) * 100, 0.6) : 0;
                    return (
                      <div key={s} style={{ display: "flex", alignItems: "center", height: ROW_H, borderBottomStyle: "solid", borderBottomWidth: 1, borderBottomColor: SOFT }}>
                        <div style={{ width: LABEL_W, flexShrink: 0, padding: "0 12px 0 44px", fontSize: 13, display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap" }}>
                          <span style={{ width: 9, height: 9, borderRadius: 2, background: STAGE_COLOR[s], flexShrink: 0 }} />
                          <Link href={stageHref(p.id, s)} style={{ color: "inherit" }}>
                            {s}
                          </Link>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {skip ? "tidak diperlukan" : r ? (r.start === r.end ? fmt(r.start) : `${fmt(r.start)} – ${fmt(r.end)} · ${dayCount}h`) : "belum ada data"}
                          </Text>
                        </div>
                        <div style={{ position: "relative", flex: 1, height: "100%", overflow: "hidden" }}>
                          {grid}
                          {skip && (
                            <Text type="secondary" style={{ position: "absolute", left: 12, top: 0, bottom: 0, display: "flex", alignItems: "center", fontSize: 12, fontStyle: "italic", zIndex: 1 }}>
                              {skip}
                            </Text>
                          )}
                          {r &&
                            parallel
                              .filter((x) => x.a === s || x.b === s)
                              .map((x) => (
                                <div
                                  key={`${x.a}-${x.b}`}
                                  style={{ position: "absolute", left: `${pos(x.start)}%`, width: `${Math.max((x.days / span) * 100, 0.4)}%`, top: 0, bottom: 0, background: "#F59E0B1F" }}
                                />
                              ))}
                          {r && (
                            <Tooltip title={`${ph.name} · ${s}: ${fmtFull(r.start)} – ${fmtFull(r.end)} (${dayCount} hari) · progress ${prog}% · sumber: ${r.source}${st === "late" ? " · terlambat" : ""}`}>
                              <Link
                                href={stageHref(p.id, s)}
                                aria-label={`${p.name} ${ph.name} ${s}`}
                                style={{
                                  position: "absolute", left: `${pos(r.start)}%`, width: `${w}%`, top: 8, height: ROW_H - 16, borderRadius: 4, overflow: "hidden",
                                  background: `${STAGE_COLOR[s]}40`, borderStyle: "solid", borderWidth: 1, borderColor: st === "late" ? "#E5484D" : STAGE_COLOR[s], display: "block",
                                }}
                              >
                                <div style={{ width: `${prog}%`, height: "100%", background: STAGE_COLOR[s] }} />
                              </Link>
                            </Tooltip>
                          )}
                          {todayLine}
                        </div>
                      </div>
                    );
                  })}
                </Fragment>
              );
            })}
          </Fragment>
        ))}
      </div>
    </div>
  );
}
