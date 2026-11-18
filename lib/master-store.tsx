"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { setEmployeeRegistry } from "@/lib/employee-registry";
import {
  masterMeetingCategories,
  masterTestTypes,
  masterApprovalLevels,
  masterDependencySystems,
  masterDirektorat,
  masterDocumentTypes,
  masterProjectCategories,
  masterProjectPriorities,
  masterProjectRoles,
  masterSubdit,
  masterVendors,
  employees as seedEmployees,
  type DocType,
  type Employee,
  type ProjectCategory,
  type ProjectPriority,
  masterTaskCategories,
  masterTaskStatuses,
  type TaskCategoryDef,
  type TaskStatusDef,
} from "@/lib/mock-data";
import { deriveStatusStyle, type StatusStyle } from "@/lib/task-ui";

// ---------------------------------------------------------------------------
// Store master untuk parameter yang dipakai banyak layar: Status Task, Kategori Task,
// Status Rapat, dan Kategori Rapat. Task/rapat menyimpan ID-nya (bukan nama), jadi mengganti
// nama atau warna di Master Data langsung berlaku di semua tempat.
//
// Sementara di memori. Padanan backend: /master/task-statuses, /master/task-categories,
// /master/meeting-statuses, /master/meeting-categories (+ /master/task-statuses/reorder).
// ---------------------------------------------------------------------------

export type MeetingStatusKind = "planned" | "done" | "cancelled";
export type MeetingStatusDef = { id: string; name: string; color: string; kind: MeetingStatusKind };
export type MeetingCategoryDef = { id: string; name: string };
/** daftar nama sederhana yang dipakai form lain (kunci = nama daftar) */
export type ListKey = "directorates" | "vendors" | "projectCategories" | "projectPriorities" | "dependencySystems" | "approvalLevels" | "projectRoles";
export type SubditDef = { directorate: string; subdirectorate: string };
export type DocTypeDef = { type: string; description: string };
/** Jenis testing + aturan urutannya. Urutan di daftar = urutan alur pengujian. `type` dipakai sebagai kunci. */
export type TestTypeDef = { type: string; requiresPrevious: boolean; allowParallel: boolean };

// ID seed rapat harus sama dengan yang dipakai data awal di meeting-store.
const SEED_MEETING_STATUSES: MeetingStatusDef[] = [
  { id: "ms-scheduled", name: "Scheduled", color: "#2F80ED", kind: "planned" },
  { id: "ms-done", name: "Done", color: "#17C653", kind: "done" },
  { id: "ms-cancelled", name: "Cancelled", color: "#F8285A", kind: "cancelled" },
];
const SEED_MEETING_CATEGORIES: MeetingCategoryDef[] = masterMeetingCategories.map((name) => ({
  id: `mc-${name.toLowerCase()}`,
  name,
}));

type MasterStore = {
  /** urutan = urutan kolom di Task Board */
  taskStatuses: TaskStatusDef[];
  addTaskStatus: (input: Omit<TaskStatusDef, "id">) => string;
  updateTaskStatus: (id: string, patch: Partial<Omit<TaskStatusDef, "id">>) => void;
  deleteTaskStatus: (id: string) => void;
  /** geser urutan (-1 = ke kiri/atas, 1 = ke kanan/bawah) */
  moveTaskStatus: (id: string, direction: -1 | 1) => void;

  taskCategories: TaskCategoryDef[];
  addTaskCategory: (name: string) => string;
  updateTaskCategory: (id: string, name: string) => void;
  deleteTaskCategory: (id: string) => void;

  meetingStatuses: MeetingStatusDef[];
  addMeetingStatus: (input: Omit<MeetingStatusDef, "id">) => string;
  updateMeetingStatus: (id: string, patch: Partial<Omit<MeetingStatusDef, "id">>) => void;
  deleteMeetingStatus: (id: string) => void;
  moveMeetingStatus: (id: string, direction: -1 | 1) => void;

  meetingCategories: MeetingCategoryDef[];
  addMeetingCategory: (name: string) => string;
  renameMeetingCategory: (id: string, name: string) => void;
  deleteMeetingCategory: (id: string) => void;

  testTypes: TestTypeDef[];
  addTestType: (def: TestTypeDef) => void;
  updateTestType: (type: string, patch: Partial<Omit<TestTypeDef, "type">>) => void;
  deleteTestType: (type: string) => void;
  moveTestType: (type: string, direction: -1 | 1) => void;

  // daftar nama sederhana (Direktorat, Vendor, Kategori/Priority Project, Sistem Dependency, Level Approval, Role Project)
  lists: Record<ListKey, string[]>;
  addListItem: (key: ListKey, name: string) => void;
  renameListItem: (key: ListKey, from: string, to: string) => void;
  deleteListItem: (key: ListKey, name: string) => void;
  moveListItem: (key: ListKey, name: string, direction: -1 | 1) => void;

  subdits: SubditDef[];
  addSubdit: (d: SubditDef) => void;
  updateSubdit: (from: SubditDef, to: SubditDef) => void;
  deleteSubdit: (d: SubditDef) => void;

  documentTypes: DocTypeDef[];
  addDocumentType: (d: DocTypeDef) => void;
  updateDocumentType: (type: string, patch: Partial<DocTypeDef>) => void;
  deleteDocumentType: (type: string) => void;

  employees: Employee[];
  addEmployee: (e: Omit<Employee, "id">) => string;
  updateEmployee: (id: string, patch: Partial<Omit<Employee, "id">>) => void;
  deleteEmployee: (id: string) => void;
};

const Ctx = createContext<MasterStore | null>(null);

let seq = 0;
const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}${(seq++).toString(36)}`;

function shift<T extends { id: string }>(list: T[], id: string, direction: -1 | 1): T[] {
  const i = list.findIndex((x) => x.id === id);
  const j = i + direction;
  if (i < 0 || j < 0 || j >= list.length) return list;
  const next = list.slice();
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

export function MasterStoreProvider({ children }: { children: ReactNode }) {
  const [taskStatuses, setTaskStatuses] = useState<TaskStatusDef[]>(() => masterTaskStatuses.map((s) => ({ ...s })));
  const [taskCategories, setTaskCategories] = useState<TaskCategoryDef[]>(() => masterTaskCategories.map((c) => ({ ...c })));
  const [meetingStatuses, setMeetingStatuses] = useState<MeetingStatusDef[]>(() => SEED_MEETING_STATUSES.map((s) => ({ ...s })));
  const [meetingCategories, setMeetingCategories] = useState<MeetingCategoryDef[]>(() =>
    SEED_MEETING_CATEGORIES.map((c) => ({ ...c })),
  );

  const [testTypes, setTestTypes] = useState<TestTypeDef[]>(() => masterTestTypes.map((t) => ({ ...t })));

  const [lists, setLists] = useState<Record<ListKey, string[]>>(() => ({
    directorates: [...masterDirektorat],
    vendors: [...masterVendors],
    projectCategories: [...masterProjectCategories],
    projectPriorities: [...masterProjectPriorities],
    dependencySystems: [...masterDependencySystems],
    approvalLevels: [...masterApprovalLevels],
    projectRoles: [...masterProjectRoles],
  }));
  const [subdits, setSubdits] = useState<SubditDef[]>(() => masterSubdit.map((x) => ({ ...x })));
  const [documentTypes, setDocumentTypes] = useState<DocTypeDef[]>(() => masterDocumentTypes.map((x) => ({ ...x })));
  const [employees, setEmployeesState] = useState<Employee[]>(() => seedEmployees.map((e) => ({ ...e, roles: [...e.roles] })));
  const employeesRef = useRef(employees);
  // semua perubahan pegawai lewat sini: state React + salinan untuk fungsi hak akses
  const setEmployees = useCallback((fn: (p: Employee[]) => Employee[]) => {
    employeesRef.current = fn(employeesRef.current);
    setEmployeeRegistry(employeesRef.current);
    setEmployeesState(employeesRef.current);
  }, []);

  const value = useMemo<MasterStore>(
    () => ({
      taskStatuses,
      addTaskStatus: (input) => {
        const id = newId("ts");
        setTaskStatuses((p) => [...p, { ...input, id }]);
        return id;
      },
      updateTaskStatus: (id, patch) => setTaskStatuses((p) => p.map((s) => (s.id === id ? { ...s, ...patch } : s))),
      deleteTaskStatus: (id) => setTaskStatuses((p) => p.filter((s) => s.id !== id)),
      moveTaskStatus: (id, d) => setTaskStatuses((p) => shift(p, id, d)),

      taskCategories,
      addTaskCategory: (name) => {
        const id = newId("tc");
        setTaskCategories((p) => [...p, { id, name }]);
        return id;
      },
      updateTaskCategory: (id, name) => setTaskCategories((p) => p.map((c) => (c.id === id ? { ...c, name } : c))),
      deleteTaskCategory: (id) => setTaskCategories((p) => p.filter((c) => c.id !== id)),

      meetingStatuses,
      addMeetingStatus: (input) => {
        const id = newId("ms");
        setMeetingStatuses((p) => [...p, { ...input, id }]);
        return id;
      },
      updateMeetingStatus: (id, patch) => setMeetingStatuses((p) => p.map((s) => (s.id === id ? { ...s, ...patch } : s))),
      deleteMeetingStatus: (id) => setMeetingStatuses((p) => p.filter((s) => s.id !== id)),
      moveMeetingStatus: (id, d) => setMeetingStatuses((p) => shift(p, id, d)),

      meetingCategories,
      addMeetingCategory: (name) => {
        const id = newId("mc");
        setMeetingCategories((p) => [...p, { id, name }]);
        return id;
      },
      renameMeetingCategory: (id, name) => setMeetingCategories((p) => p.map((c) => (c.id === id ? { ...c, name } : c))),
      deleteMeetingCategory: (id) => setMeetingCategories((p) => p.filter((c) => c.id !== id)),

      testTypes,
      addTestType: (def) => setTestTypes((p) => [...p, def]),
      updateTestType: (type, patch) => setTestTypes((p) => p.map((t) => (t.type === type ? { ...t, ...patch } : t))),
      deleteTestType: (type) => setTestTypes((p) => p.filter((t) => t.type !== type)),
      moveTestType: (type, d) =>
        setTestTypes((p) => {
          const i = p.findIndex((t) => t.type === type);
          const j = i + d;
          if (i < 0 || j < 0 || j >= p.length) return p;
          const next = p.slice();
          [next[i], next[j]] = [next[j], next[i]];
          return next;
        }),

      lists,
      addListItem: (key, name) => setLists((p) => ({ ...p, [key]: [...p[key], name] })),
      renameListItem: (key, from, to) => setLists((p) => ({ ...p, [key]: p[key].map((x) => (x === from ? to : x)) })),
      deleteListItem: (key, name) => setLists((p) => ({ ...p, [key]: p[key].filter((x) => x !== name) })),
      moveListItem: (key, name, d) =>
        setLists((p) => {
          const arr = p[key].slice();
          const i = arr.indexOf(name);
          const j = i + d;
          if (i < 0 || j < 0 || j >= arr.length) return p;
          [arr[i], arr[j]] = [arr[j], arr[i]];
          return { ...p, [key]: arr };
        }),

      subdits,
      addSubdit: (d) => setSubdits((p) => [...p, d]),
      updateSubdit: (from, to) => setSubdits((p) => p.map((x) => (x.directorate === from.directorate && x.subdirectorate === from.subdirectorate ? to : x))),
      deleteSubdit: (d) => setSubdits((p) => p.filter((x) => !(x.directorate === d.directorate && x.subdirectorate === d.subdirectorate))),

      documentTypes,
      addDocumentType: (d) => setDocumentTypes((p) => [...p, d]),
      updateDocumentType: (type, patch) => setDocumentTypes((p) => p.map((x) => (x.type === type ? { ...x, ...patch } : x))),
      deleteDocumentType: (type) => setDocumentTypes((p) => p.filter((x) => x.type !== type)),

      employees,
      addEmployee: (e) => {
        const id = newId("emp");
        setEmployees((p) => [...p, { ...e, id }]);
        return id;
      },
      updateEmployee: (id, patch) => setEmployees((p) => p.map((x) => (x.id === id ? { ...x, ...patch } : x))),
      deleteEmployee: (id) => setEmployees((p) => p.filter((x) => x.id !== id)),
    }),
    [taskStatuses, taskCategories, meetingStatuses, meetingCategories, testTypes, lists, subdits, documentTypes, employees, setEmployees],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useMasterStore(): MasterStore {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useMasterStore harus dipakai di dalam <MasterStoreProvider>.");
  return ctx;
}

const FALLBACK_COLOR = "#99A1B7";

/** Pembantu baca status task: nama, warna, dan apakah berarti "selesai". */
export function useStatusMeta() {
  const { taskStatuses } = useMasterStore();
  return useMemo(() => {
    const byId = new Map(taskStatuses.map((s) => [s.id, s]));
    return {
      statuses: taskStatuses,
      byId,
      isDone: (id: string) => byId.get(id)?.isDone ?? false,
      nameOf: (id: string) => byId.get(id)?.name ?? "Tanpa status",
      styleOf: (id: string): StatusStyle => deriveStatusStyle(byId.get(id)?.color ?? FALLBACK_COLOR),
    };
  }, [taskStatuses]);
}

export function useCategoryName() {
  const { taskCategories } = useMasterStore();
  return useMemo(() => {
    const byId = new Map(taskCategories.map((c) => [c.id, c.name]));
    return (id: string) => byId.get(id) ?? "-";
  }, [taskCategories]);
}

/** Pembantu baca status & kategori rapat. */
export function useMeetingMeta() {
  const { meetingStatuses, meetingCategories } = useMasterStore();
  return useMemo(() => {
    const st = new Map(meetingStatuses.map((s) => [s.id, s]));
    const ct = new Map(meetingCategories.map((c) => [c.id, c.name]));
    return {
      statuses: meetingStatuses,
      categories: meetingCategories,
      statusName: (id: string) => st.get(id)?.name ?? "Tanpa status",
      statusKind: (id: string): MeetingStatusKind => st.get(id)?.kind ?? "planned",
      statusStyle: (id: string): StatusStyle => deriveStatusStyle(st.get(id)?.color ?? FALLBACK_COLOR),
      categoryName: (id: string) => ct.get(id) ?? "-",
      /** id status pertama dengan arti tertentu (untuk nilai awal form) */
      firstStatusOfKind: (kind: MeetingStatusKind) => meetingStatuses.find((s) => s.kind === kind)?.id ?? meetingStatuses[0]?.id,
    };
  }, [meetingStatuses, meetingCategories]);
}

/**
 * Daftar master dengan NAMA yang sama seperti konstanta di mock-data, supaya form lain cukup
 * mengganti sumbernya: `const { masterDirektorat, getSubditOptions, ... } = useMasterLists();`
 */
export function useMasterLists() {
  const { lists, subdits, documentTypes, employees } = useMasterStore();
  return useMemo(
    () => ({
      masterDirektorat: lists.directorates,
      masterVendors: lists.vendors,
      masterProjectCategories: lists.projectCategories as ProjectCategory[],
      masterProjectPriorities: lists.projectPriorities as ProjectPriority[],
      masterDependencySystems: lists.dependencySystems,
      masterApprovalLevels: lists.approvalLevels,
      masterProjectRoles: lists.projectRoles,
      masterSubdit: subdits,
      masterDocumentTypes: documentTypes as { type: DocType; description: string }[],
      employees,
      getSubditOptions: (directorate?: string) => (directorate ? subdits.filter((s) => s.directorate === directorate) : subdits),
    }),
    [lists, subdits, documentTypes, employees],
  );
}
