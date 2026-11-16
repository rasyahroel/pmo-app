// Logika murni untuk menu Laporan: peristiwa kalender, baris laporan per project, dan aturan
// "perlu perhatian". Dipisah dari komponen supaya mudah diuji dan nanti bisa dipindah ke backend
// (GET /reports/summary, /reports/projects, /calendar/events).
import dayjs from "dayjs";
import type { Phase, Project, Task } from "./mock-data";
import type { MeetingRecord } from "./meeting-store";

export type CalEventKind = "meeting" | "task" | "phase-start" | "phase-live";

export type CalEvent = {
  /** unik di seluruh kalender: "meeting:m1", "task:t2", "phase-live:ph-1a" */
  id: string;
  ref: string; // id rapat / task / fase
  kind: CalEventKind;
  date: string; // YYYY-MM-DD
  time?: string; // HH:mm (hanya rapat)
  endTime?: string;
  title: string;
  projectId: string;
  /** teks kedua (project, fase, dst.) */
  subtitle?: string;
  /** rapat batal / task sudah selesai */
  faded?: boolean;
  /** task lewat jatuh tempo */
  overdue?: boolean;
  href: string;
};

export type CalendarInput = {
  meetings: MeetingRecord[];
  tasks: Task[];
  projects: Project[];
  phasesOf: (projectId: string) => Phase[];
  isTaskDone: (statusId: string) => boolean;
  meetingKind: (statusId: string) => "planned" | "done" | "cancelled";
  today: string;
};

export function buildCalendarEvents(i: CalendarInput): CalEvent[] {
  const out: CalEvent[] = [];
  const projectName = (id: string) => i.projects.find((p) => p.id === id)?.name ?? "";

  for (const m of i.meetings) {
    out.push({
      id: `meeting:${m.id}`,
      ref: m.id,
      kind: "meeting",
      date: m.startsAt.slice(0, 10),
      time: dayjs(m.startsAt).format("HH:mm"),
      endTime: dayjs(m.endsAt).format("HH:mm"),
      title: m.title,
      projectId: m.projectId,
      subtitle: projectName(m.projectId),
      faded: i.meetingKind(m.statusId) === "cancelled",
      href: `/meetings/${m.id}`,
    });
  }

  for (const t of i.tasks) {
    if (t.parentId) continue; // sub task tidak ditampilkan agar kalender tidak penuh
    const done = i.isTaskDone(t.status);
    out.push({
      id: `task:${t.id}`,
      ref: t.id,
      kind: "task",
      date: t.dueDate,
      title: t.title,
      projectId: t.projectId,
      subtitle: projectName(t.projectId),
      faded: done,
      overdue: !done && t.dueDate < i.today,
      href: `/tasks/${t.id}`,
    });
  }

  for (const p of i.projects) {
    for (const ph of i.phasesOf(p.id)) {
      out.push({ id: `phase-start:${ph.id}`, ref: ph.id, kind: "phase-start", date: ph.startDate, title: `Mulai ${ph.name}`, projectId: p.id, subtitle: p.name, href: `/projects/${p.id}` });
      out.push({ id: `phase-live:${ph.id}`, ref: ph.id, kind: "phase-live", date: ph.targetLiveDate, title: `Target live ${ph.name}`, projectId: p.id, subtitle: p.name, href: `/projects/${p.id}` });
    }
  }
  return out;
}

/** Pindahkan rapat ke tanggal lain dengan jam dan durasi tetap. */
export function shiftMeeting(m: Pick<MeetingRecord, "startsAt" | "endsAt">, newDate: string) {
  const diff = dayjs(newDate).startOf("day").diff(dayjs(m.startsAt).startOf("day"), "day");
  return {
    startsAt: dayjs(m.startsAt).add(diff, "day").format("YYYY-MM-DDTHH:mm:ss"),
    endsAt: dayjs(m.endsAt).add(diff, "day").format("YYYY-MM-DDTHH:mm:ss"),
  };
}

/** Pindahkan jatuh tempo task; tanggal mulai ikut mundur bila jatuh tempo baru lebih awal darinya. */
export function shiftTaskDue(t: Pick<Task, "startDate" | "dueDate">, newDate: string) {
  return { dueDate: newDate, startDate: newDate < t.startDate ? newDate : t.startDate };
}

// ---------------------------------------------------------------------------
// Laporan per project
// ---------------------------------------------------------------------------
export type ProjectReportRow = {
  project: Project;
  phases: Phase[];
  stage: string; // tahap fase terakhir
  startDate?: string;
  targetDate?: string; // target live paling akhir
  taskProgress: number | null; // rata-rata task induk
  taskTotal: number;
  openTasks: number;
  overdueTasks: number;
  nextMeeting?: string; // YYYY-MM-DD rapat terjadwal terdekat
  reasons: string[];
};

export type ReportInput = {
  projects: Project[];
  phasesOf: (projectId: string) => Phase[];
  tasks: Task[];
  meetings: MeetingRecord[];
  isTaskDone: (statusId: string) => boolean;
  meetingKind: (statusId: string) => "planned" | "done" | "cancelled";
  today: string;
};

export function buildProjectRows(i: ReportInput): ProjectReportRow[] {
  return i.projects.map((project) => {
    const phases = i.phasesOf(project.id);
    const tasks = i.tasks.filter((t) => t.projectId === project.id && !t.parentId);
    const open = tasks.filter((t) => !i.isTaskDone(t.status));
    const overdue = open.filter((t) => t.dueDate < i.today).length;
    const starts = phases.map((p) => p.startDate).sort();
    const targets = phases.map((p) => p.targetLiveDate).sort();
    const targetDate = targets[targets.length - 1];
    const upcoming = i.meetings
      .filter((m) => m.projectId === project.id && i.meetingKind(m.statusId) === "planned" && m.startsAt.slice(0, 10) >= i.today)
      .map((m) => m.startsAt.slice(0, 10))
      .sort()[0];

    const reasons: string[] = [];
    if (project.status === "Hold") reasons.push("Project di-Hold");
    if (project.status === "Active") {
      if (overdue > 0) reasons.push(`${overdue} task terlambat`);
      if (targetDate && project.overallProgress < 100) {
        const days = dayjs(targetDate).diff(dayjs(i.today), "day");
        if (days < 0) reasons.push("Target live terlewat");
        else if (days <= 14 && project.overallProgress < 80) reasons.push(`Target live ${days} hari lagi, progress ${project.overallProgress}%`);
      }
    }

    return {
      project,
      phases,
      stage: phases[phases.length - 1]?.stage ?? "-",
      startDate: starts[0],
      targetDate,
      taskProgress: tasks.length ? Math.round(tasks.reduce((s, t) => s + t.progressPercent, 0) / tasks.length) : null,
      taskTotal: tasks.length,
      openTasks: open.length,
      overdueTasks: overdue,
      nextMeeting: upcoming,
      reasons,
    };
  });
}
