"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Alert, App, AutoComplete, Button, DatePicker, Form, Input, InputNumber, Modal, Popconfirm, Progress, Segmented, Select, Space, Tag, Tooltip, Typography } from "antd";
import { DeleteOutlined, EditOutlined, PlusOutlined } from "@ant-design/icons";
import dayjs, { type Dayjs } from "dayjs";
import PageSkeleton from "@/components/layout/PageSkeleton";
import DataTable from "@/components/common/DataTable";
import { getTestStatusColor, projects, type TestStatus } from "@/lib/mock-data";
import { useMasterStore } from "@/lib/master-store";
import { useProjectStructure } from "@/lib/project-structure";
import { TEST_STATUSES, blockedBy, breaksDependents, gateOf, normalizeProgress, validateTest, type TestRecord } from "@/lib/test-logic";
import { useTestStore } from "@/lib/test-store";

const { Text } = Typography;

const STATUS_STYLE: Record<TestStatus, { color: string; bg: string }> = {
  "Not Started": { color: "#6B7185", bg: "#F3F4F8" },
  "On Going": { color: "#1677C8", bg: "#EAF4FB" },
  Passed: { color: "#1E9E4F", bg: "#EAF7EF" },
  Failed: { color: "#CF3E36", bg: "#FDF1F0" },
};
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const fmt = (d?: string) => (d ? `${dayjs(d).date()} ${MONTHS[dayjs(d).month()]} ${dayjs(d).year()}` : "");
const period = (r: TestRecord) => (r.startDate || r.endDate ? `${r.startDate ? fmt(r.startDate) : "?"} – ${r.endDate ? fmt(r.endDate) : "?"}` : "—");

type Row = TestRecord & { projectName: string; phaseName: string; blocked: string | null };
type FormValues = {
  projectId: string;
  phaseId: string;
  type: string;
  status: TestStatus;
  progressPercent: number;
  pic: string;
  dates: [Dayjs, Dayjs] | null;
  notes?: string;
};

function TestingContent() {
  const { message } = App.useApp();
  const params = useSearchParams();
  const { records, addTest, updateTest, deleteTest } = useTestStore();
  const { testTypes } = useMasterStore();
  const { phasesOf, pmoOf, developersOf } = useProjectStructure();

  const rawProject = params.get("projectId");
  const [projectId, setProjectId] = useState<string>(rawProject && projects.some((p) => p.id === rawProject) ? rawProject : "all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<TestStatus | "all">("all");
  const [view, setView] = useState<"list" | "matrix">("list");
  const [editing, setEditing] = useState<{ id: string | null; initial: Partial<FormValues> } | null>(null);
  const [form] = Form.useForm<FormValues>();
  const watched = Form.useWatch([], form) as Partial<FormValues> | undefined;

  const phaseName = (pid: string, phid: string) => phasesOf(pid).find((x) => x.id === phid)?.name ?? "-";
  const projectName = (pid: string) => projects.find((p) => p.id === pid)?.name ?? "-";

  const rows = useMemo<Row[]>(
    () =>
      records.map((r) => ({
        ...r,
        projectName: projectName(r.projectId),
        phaseName: phaseName(r.projectId, r.phaseId),
        blocked: r.status === "Not Started" ? blockedBy(records, testTypes, r.phaseId, r.type) : null,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [records, testTypes, phasesOf],
  );
  const scoped = useMemo(() => rows.filter((r) => (projectId === "all" || r.projectId === projectId) && (typeFilter === "all" || r.type === typeFilter)), [rows, projectId, typeFilter]);
  const shown = useMemo(() => scoped.filter((r) => statusFilter === "all" || r.status === statusFilter), [scoped, statusFilter]);
  const counts = useMemo(() => {
    const c: Record<TestStatus, number> = { "Not Started": 0, "On Going": 0, Passed: 0, Failed: 0 };
    for (const r of scoped) c[r.status]++;
    return c;
  }, [scoped]);

  // ---- form ----
  function open(id: string | null, preset?: Partial<FormValues>) {
    const r = id ? records.find((x) => x.id === id) : null;
    const initial: Partial<FormValues> = r
      ? { projectId: r.projectId, phaseId: r.phaseId, type: r.type, status: r.status, progressPercent: r.progressPercent, pic: r.pic, notes: r.notes, dates: r.startDate && r.endDate ? [dayjs(r.startDate), dayjs(r.endDate)] : null }
      : (() => {
          const pid = preset?.projectId ?? (projectId !== "all" ? projectId : undefined);
          const only = pid && phasesOf(pid).length === 1 ? phasesOf(pid)[0].id : undefined;
          const phid = preset?.phaseId ?? only;
          return { status: "Not Started" as TestStatus, progressPercent: 0, projectId: pid, phaseId: phid, type: nextFreeType(phid), ...preset };
        })();
    setEditing({ id, initial });
  }

  const draft = watched ?? {};
  const phaseOptions = draft.projectId ? phasesOf(draft.projectId) : [];
  const picOptions = draft.projectId ? [...pmoOf(draft.projectId), ...developersOf(draft.projectId)].map((m) => ({ value: m.name })) : [];
  // pratinjau aturan: tampil langsung saat isian berubah
  const preview = useMemo(() => {
    if (!editing || !draft.phaseId || !draft.type || !draft.status) return null;
    const cur = editing.id ? records.find((r) => r.id === editing.id) : undefined;
    const status = draft.status;
    if (cur) {
      const moved = cur.phaseId !== draft.phaseId || cur.type !== draft.type;
      const b = breaksDependents(records, testTypes, cur.phaseId, cur.type, moved ? "deleted" : status);
      if (b) return b;
    }
    return validateTest(records, testTypes, {
      id: editing.id ?? undefined,
      phaseId: draft.phaseId,
      type: draft.type,
      status,
      startDate: draft.dates?.[0]?.format("YYYY-MM-DD"),
      endDate: draft.dates?.[1]?.format("YYYY-MM-DD"),
    });
  }, [editing, draft.phaseId, draft.type, draft.status, draft.dates, records, testTypes]);

  /** jenis testing pertama (urutan master) yang belum ada di fase itu */
  const nextFreeType = (phaseId?: string, extra?: TestRecord) =>
    phaseId ? testTypes.find((t) => !records.some((r) => r.phaseId === phaseId && r.type === t.type) && extra?.type !== t.type)?.type : undefined;

  function submit(again = false) {
    form
      .validateFields()
      .then((v) => {
        const base = {
          projectId: v.projectId,
          phaseId: v.phaseId,
          type: v.type,
          status: v.status,
          progressPercent: normalizeProgress(v.status, v.progressPercent ?? 0),
          pic: v.pic.trim(),
          startDate: v.dates?.[0]?.format("YYYY-MM-DD"),
          endDate: v.dates?.[1]?.format("YYYY-MM-DD"),
          notes: v.notes?.trim() || undefined,
        };
        const res = editing?.id ? updateTest(editing.id, base) : addTest(base);
        if (!res.ok) {
          message.error(res.reason);
          return;
        }
        message.success(editing?.id ? "Data pengujian diperbarui." : `${base.type} ditambahkan.`);
        if (again && !editing?.id && res.ok) {
          // tetap di project & fase yang sama, lanjut jenis berikutnya
          form.setFieldsValue({ type: nextFreeType(base.phaseId, res.record), status: "Not Started", progressPercent: 0, pic: undefined, dates: null, notes: undefined });
          return;
        }
        setEditing(null);
      })
      .catch(() => undefined);
  }

  function remove(id: string) {
    const res = deleteTest(id);
    if (res.ok) message.success("Data pengujian dihapus.");
    else message.error(res.reason);
  }

  // ---- tampilan ----
  const cards: { key: TestStatus | "all"; label: string; n: number; color: string }[] = [
    { key: "all", label: "Semua", n: scoped.length, color: "#10313C" },
    { key: "Not Started", label: "Belum mulai", n: counts["Not Started"], color: STATUS_STYLE["Not Started"].color },
    { key: "On Going", label: "Berjalan", n: counts["On Going"], color: STATUS_STYLE["On Going"].color },
    { key: "Passed", label: "Passed", n: counts.Passed, color: STATUS_STYLE.Passed.color },
    { key: "Failed", label: "Failed", n: counts.Failed, color: STATUS_STYLE.Failed.color },
  ];

  const actions = (r: Row) => (
    <Space size={4}>
      <Tooltip title="Ubah">
        <Button size="small" icon={<EditOutlined />} aria-label="Ubah pengujian" onClick={() => open(r.id)} />
      </Tooltip>
      <Popconfirm title="Hapus data pengujian ini?" description={`${r.type} · ${r.projectName} · ${r.phaseName}`} onConfirm={() => remove(r.id)} okText="Hapus" cancelText="Batal" okButtonProps={{ danger: true }}>
        <Button size="small" danger icon={<DeleteOutlined />} aria-label="Hapus pengujian" />
      </Popconfirm>
    </Space>
  );

  // matriks: satu baris per fase, satu kolom per jenis testing (urutan master)
  const phaseRows = useMemo(
    () =>
      projects
        .filter((p) => projectId === "all" || p.id === projectId)
        .flatMap((p) => phasesOf(p.id).map((ph) => ({ projectId: p.id, projectName: p.name, phase: ph }))),
    [projectId, phasesOf],
  );

  return (
    <PageSkeleton path="/testing">
      <Space orientation="vertical" size={16} style={{ width: "100%" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
          {cards.map((c) => {
            const active = statusFilter === c.key;
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => setStatusFilter(c.key)}
                aria-pressed={active}
                style={{
                  textAlign: "left", cursor: "pointer", padding: "12px 16px", borderRadius: 10, background: "#fff",
                  borderStyle: "solid", borderWidth: active ? 2 : 1, borderColor: active ? c.color : "#E6E8EF",
                }}
              >
                <div style={{ fontSize: 12, color: "#6B7185" }}>{c.label}</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: c.color, lineHeight: 1.2 }}>{c.n}</div>
              </button>
            );
          })}
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", justifyContent: "space-between" }}>
          <Space wrap>
            <Segmented
              value={view}
              onChange={(v) => setView(v as "list" | "matrix")}
              options={[
                { label: "Daftar", value: "list" },
                { label: "Matriks per fase", value: "matrix" },
              ]}
            />
            <Select value={projectId} onChange={setProjectId} style={{ minWidth: 240 }} options={[{ value: "all", label: "Semua project" }, ...projects.map((p) => ({ value: p.id, label: p.name }))]} />
            <Select value={typeFilter} onChange={setTypeFilter} style={{ minWidth: 150 }} options={[{ value: "all", label: "Semua jenis" }, ...testTypes.map((t) => ({ value: t.type, label: t.type }))]} />
          </Space>
          <Button icon={<PlusOutlined />} type="primary" onClick={() => open(null)}>
            Tambah Pengujian
          </Button>
        </div>

        {view === "list" ? (
          <DataTable
            rowKey="id"
            scroll={{ x: "max-content" }}
            dataSource={shown}
            searchPlaceholder="Cari project, fase, jenis testing, PIC, catatan..."
            locale={{ emptyText: "Belum ada data pengujian untuk filter ini." }}
            columns={[
              {
                title: "Project / Fase",
                dataIndex: "projectName",
                searchValue: (r) => `${r.projectName} ${r.phaseName}`,
                render: (_, r) => (
                  <div>
                    <Link href={`/projects/${r.projectId}?tab=fase`} style={{ fontWeight: 500, color: "inherit" }}>
                      {r.projectName}
                    </Link>
                    <div>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {r.phaseName}
                      </Text>
                    </div>
                  </div>
                ),
              },
              {
                title: "Jenis",
                dataIndex: "type",
                width: 150,
                render: (v: string, r) => (
                  <Space size={4} wrap>
                    <Tag style={{ marginInlineEnd: 0 }}>{v}</Tag>
                    {r.blocked && (
                      <Tooltip title={`Aturan urutan: ${v} baru bisa dimulai setelah ${r.blocked} Passed di fase ini.`}>
                        <Tag color="gold" style={{ marginInlineEnd: 0 }}>
                          menunggu {r.blocked}
                        </Tag>
                      </Tooltip>
                    )}
                  </Space>
                ),
              },
              { title: "Status", dataIndex: "status", width: 120, filterable: true, render: (v: TestStatus) => <Tag color={getTestStatusColor(v)}>{v}</Tag> },
              { title: "Progress", dataIndex: "progressPercent", width: 150, searchable: false, render: (v: number, r) => <Progress percent={v} size="small" status={r.status === "Failed" ? "exception" : undefined} /> },
              { title: "Periode", dataIndex: "startDate", width: 200, searchable: false, render: (_: unknown, r) => <Text type={period(r) === "—" ? "secondary" : undefined} style={{ fontSize: 13 }}>{period(r)}</Text> },
              { title: "PIC", dataIndex: "pic", width: 150, filterable: true },
              {
                title: "Catatan",
                dataIndex: "notes",
                width: 220,
                render: (v?: string) =>
                  v ? (
                    <Tooltip title={v}>
                      <Text ellipsis style={{ maxWidth: 200, display: "inline-block" }}>
                        {v}
                      </Text>
                    </Tooltip>
                  ) : (
                    <Text type="secondary">—</Text>
                  ),
              },
              { title: "Aksi", key: "aksi", width: 100, fixed: "right", sortable: false, searchable: false, render: (_: unknown, r: Row) => actions(r) },
            ]}
          />
        ) : (
          <div style={{ overflowX: "auto", background: "#fff", borderStyle: "solid", borderWidth: 1, borderColor: "#E6E8EF", borderRadius: 8 }}>
            <table style={{ borderCollapse: "separate", borderSpacing: 0, width: "100%", minWidth: 900 }}>
              <thead>
                <tr>
                  <th style={th}>Project / Fase</th>
                  {testTypes.map((t) => (
                    <th key={t.type} style={th}>
                      <div>{t.type}</div>
                      <div style={{ fontWeight: 400, fontSize: 11, color: "#6B7185" }}>
                        {gateOf(testTypes, t.type) ? `setelah ${gateOf(testTypes, t.type)}` : "tanpa syarat"}
                        {t.allowParallel ? " · paralel" : ""}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {phaseRows.map(({ projectId: pid, projectName: pn, phase }) => (
                  <tr key={phase.id}>
                    <td style={td}>
                      <Link href={`/projects/${pid}?tab=fase`} style={{ fontWeight: 500, color: "inherit" }}>
                        {pn}
                      </Link>
                      <div>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {phase.name}
                        </Text>
                      </div>
                    </td>
                    {testTypes.map((t) => {
                      const r = records.find((x) => x.phaseId === phase.id && x.type === t.type);
                      if (typeFilter !== "all" && typeFilter !== t.type) return <td key={t.type} style={{ ...td, background: "#FAFBFD" }} />;
                      if (!r) {
                        const gate = blockedBy(records, testTypes, phase.id, t.type);
                        return (
                          <td key={t.type} style={td}>
                            <Tooltip title={gate ? `Menunggu ${gate} Passed — tetap bisa dicatat sebagai Not Started.` : "Tambah pengujian"}>
                              <Button size="small" type="dashed" icon={<PlusOutlined />} onClick={() => open(null, { projectId: pid, phaseId: phase.id, type: t.type })}>
                                {gate ? `menunggu ${gate}` : "tambah"}
                              </Button>
                            </Tooltip>
                          </td>
                        );
                      }
                      const st = STATUS_STYLE[r.status];
                      return (
                        <td key={t.type} style={{ ...td, background: st.bg, cursor: "pointer" }} onClick={() => open(r.id)} title="Klik untuk ubah">
                          <div style={{ fontWeight: 600, color: st.color }}>{r.status}</div>
                          <Progress percent={r.progressPercent} size="small" showInfo={false} strokeColor={st.color} style={{ marginBottom: 0 }} />
                          <div style={{ fontSize: 12, color: "#6B7185" }}>
                            {r.progressPercent}% · {r.pic}
                          </div>
                          {(r.startDate || r.endDate) && <div style={{ fontSize: 11, color: "#8A90A2" }}>{period(r)}</div>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            {phaseRows.length === 0 && <div style={{ padding: 24, textAlign: "center", color: "#8A90A2" }}>Belum ada fase.</div>}
          </div>
        )}

        <Text type="secondary" style={{ fontSize: 12 }}>
          Urutan dan aturan paralel diatur di Master Data › Jenis Testing. Jenis yang wajib menunggu baru bisa dimulai setelah pengantarnya Passed; dua pengujian hanya boleh On Going bersamaan bila keduanya boleh paralel.
        </Text>
      </Space>

      <Modal
        title={editing?.id ? "Ubah Pengujian" : "Tambah Pengujian"}
        open={editing !== null}
        onCancel={() => setEditing(null)}
        destroyOnHidden
        centered
        width={640}
        styles={{ body: { maxHeight: "calc(100vh - 220px)", overflowY: "auto", paddingTop: 8, paddingRight: 6 } }}
        footer={
          <Space>
            <Button onClick={() => setEditing(null)}>Batal</Button>
            {!editing?.id && (
              <Button disabled={!!preview} onClick={() => submit(true)}>
                Simpan &amp; tambah lagi
              </Button>
            )}
            <Button type="primary" disabled={!!preview} onClick={() => submit(false)}>
              Simpan
            </Button>
          </Space>
        }
      >
        <Form form={form} name="testing" layout="vertical" initialValues={editing?.initial} preserve={false}>
          {preview && <Alert type="warning" showIcon title={preview} style={{ marginBottom: 12 }} />}
          <div style={grid2}>
            <Form.Item name="projectId" label="Project" rules={[{ required: true, message: "Wajib diisi" }]}>
              <Select
                disabled={!!editing?.id}
                placeholder="Pilih project"
                options={projects.map((p) => ({ label: p.name, value: p.id }))}
                onChange={(pid: string) => {
                  const ph = phasesOf(pid);
                  const only = ph.length === 1 ? ph[0].id : undefined;
                  form.setFieldsValue({ phaseId: only, pic: undefined, type: nextFreeType(only) });
                }}
              />
            </Form.Item>
            <Form.Item name="phaseId" label="Fase" rules={[{ required: true, message: "Wajib diisi" }]}>
              <Select
                disabled={!!editing?.id}
                options={phaseOptions.map((ph) => ({ label: ph.name, value: ph.id }))}
                placeholder={draft.projectId ? "Pilih fase" : "Pilih project dulu"}
                onChange={(phid: string) => {
                  if (!editing?.id) form.setFieldValue("type", nextFreeType(phid));
                }}
              />
            </Form.Item>
          </div>
          <div style={grid2}>
            <Form.Item name="type" label="Jenis Testing" rules={[{ required: true, message: "Wajib diisi" }]}>
              <Select
                disabled={!!editing?.id}
                placeholder={draft.phaseId ? "Pilih jenis" : "Pilih fase dulu"}
                options={testTypes.map((t) => {
                  const exists = !!draft.phaseId && records.some((r) => r.phaseId === draft.phaseId && r.type === t.type && r.id !== editing?.id);
                  const wait = draft.phaseId && !exists ? blockedBy(records, testTypes, draft.phaseId, t.type) : null;
                  return { label: exists ? `${t.type} · sudah ada` : wait ? `${t.type} · menunggu ${wait}` : t.type, value: t.type, disabled: exists };
                })}
              />
            </Form.Item>
            <Form.Item name="status" label="Status" rules={[{ required: true, message: "Wajib diisi" }]}>
              <Select
                options={TEST_STATUSES.map((s) => ({ label: s, value: s }))}
                onChange={(s: TestStatus) => form.setFieldValue("progressPercent", normalizeProgress(s, form.getFieldValue("progressPercent") ?? 0))}
              />
            </Form.Item>
          </div>
          <div style={grid2}>
            <Form.Item
              name="progressPercent"
              label="Progress (%)"
              extra={draft.status === "Not Started" ? "Belum mulai: 0%." : draft.status === "Passed" ? "Passed: otomatis 100%." : draft.status === "On Going" ? "Berjalan: 0–99%." : undefined}
              rules={[{ required: true, message: "Wajib diisi" }]}
            >
              <InputNumber min={0} max={100} precision={0} style={{ width: "100%" }} disabled={draft.status === "Not Started" || draft.status === "Passed"} />
            </Form.Item>
            <Form.Item name="pic" label="PIC" rules={[{ required: true, whitespace: true, message: "Wajib diisi" }]}>
              <AutoComplete options={picOptions} placeholder="Pilih dari tim / ketik nama" filterOption={(i, o) => (o?.value ?? "").toLowerCase().includes(i.toLowerCase())} />
            </Form.Item>
          </div>
          <Form.Item name="dates" label="Periode (opsional)">
            <DatePicker.RangePicker style={{ width: "100%" }} format="DD/MM/YYYY" placeholder={["Mulai", "Selesai"]} />
          </Form.Item>
          <Form.Item name="notes" label="Catatan (opsional)" style={{ marginBottom: 0 }}>
            <Input.TextArea rows={2} maxLength={300} showCount placeholder="Mis. kendala, hasil singkat, nomor tiket" />
          </Form.Item>
        </Form>
      </Modal>
    </PageSkeleton>
  );
}

const grid2: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" };
const th: React.CSSProperties = {
  background: "#F5F6FA", textAlign: "left", padding: "8px 12px", fontSize: 13, fontWeight: 600, whiteSpace: "nowrap",
  borderBottomStyle: "solid", borderBottomWidth: 1, borderBottomColor: "#E6E8EF", borderRightStyle: "solid", borderRightWidth: 1, borderRightColor: "#E6E8EF",
};
const td: React.CSSProperties = {
  padding: "8px 12px", verticalAlign: "top", fontSize: 13, minWidth: 130,
  borderBottomStyle: "solid", borderBottomWidth: 1, borderBottomColor: "#E6E8EF", borderRightStyle: "solid", borderRightWidth: 1, borderRightColor: "#E6E8EF",
};

// useSearchParams() wajib dibungkus Suspense di Next.js.
export default function TestingPage() {
  return (
    <Suspense fallback={null}>
      <TestingContent />
    </Suspense>
  );
}
