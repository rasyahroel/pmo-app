"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import dayjs from "dayjs";
import "dayjs/locale/id";
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  DatePicker,
  Empty,
  Form,
  Input,
  Modal,
  Popconfirm,
  Result,
  Row,
  Select,
  Space,
  Tag,
  Typography,
  Upload,
} from "antd";
import {
  ArrowLeftOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  EnvironmentOutlined,
  FileDoneOutlined,
  PlusOutlined,
  RocketOutlined,
  UploadOutlined,
  VideoCameraOutlined,
} from "@ant-design/icons";
import { projects } from "@/lib/mock-data";
import { useMeetingMeta } from "@/lib/master-store";
import { useProjectStructure } from "@/lib/project-structure";
import { useMeetingStore, type ActionItem } from "@/lib/meeting-store";
import { useMeetingPermissions } from "@/lib/use-meeting-permissions";
import { useTaskPermissions } from "@/lib/use-task-permissions";
import { MOM_TEMPLATE_CSV, parseActionItemsCsv } from "@/lib/meeting-csv";
import { projectColor } from "@/lib/task-ui";
import MeetingFormModal from "@/components/meetings/MeetingFormModal";
import ParticipantsPicker from "@/components/meetings/ParticipantsPicker";
import AttachmentsField from "@/components/tasks/AttachmentsField";
import AttachmentsView from "@/components/tasks/AttachmentsView";

const { Text, Title } = Typography;

const newId = () => `ai-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

function Label({ children }: { children: string }) {
  return <div style={{ fontSize: 12, color: "#8C93A3", marginBottom: 4 }}>{children}</div>;
}

type ItemForm = { title: string; pics: string[]; dueDate?: dayjs.Dayjs; note?: string };

export default function MeetingDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { message } = App.useApp();
  const store = useMeetingStore();
  const meta = useMeetingMeta();
  const perms = useMeetingPermissions();
  const taskPerms = useTaskPermissions();
  const structure = useProjectStructure();

  const m = store.meetings.find((x) => x.id === params.id);
  const [edit, setEdit] = useState(false);
  const [itemModal, setItemModal] = useState<{ item: ActionItem | null } | null>(null);
  const [convert, setConvert] = useState<{ itemId: string | "all" } | null>(null);
  const [phaseId, setPhaseId] = useState<string | undefined>();
  const [summaryDraft, setSummaryDraft] = useState<{ summary: string; decisions: string } | null>(null);
  const [itemForm] = Form.useForm<ItemForm>();

  const phases = useMemo(() => (m ? structure.phasesOf(m.projectId) : []), [m, structure]);

  if (!m) {
    return (
      <Result
        status="404"
        title="Rapat tidak ditemukan"
        subTitle="Rapat ini mungkin sudah dihapus, atau kamu tidak punya akses. Data contoh juga hilang saat halaman dimuat ulang."
        extra={<Link href="/meetings"><Button type="primary">Kembali ke Rapat</Button></Link>}
      />
    );
  }

  const canManage = perms.canManage(m);
  const st = meta.statusStyle(m.statusId);
  const kind = meta.statusKind(m.statusId);
  const project = projects.find((p) => p.id === m.projectId);
  const unconverted = m.actionItems.filter((i) => !i.taskId);
  const canCreateTasks = taskPerms.canCreateIn(m.projectId);
  const memberNames = Array.from(new Set([...m.participants.map((p) => p.name), ...structure.memberNamesOf(m.projectId)]));
  const draft = summaryDraft ?? { summary: m.summary ?? "", decisions: m.decisions ?? "" };
  const dirty = (draft.summary !== (m.summary ?? "")) || (draft.decisions !== (m.decisions ?? ""));

  const run = (res: ReturnType<typeof store.updateMeeting>, ok?: string) => {
    if (!res.ok) {
      message.warning(res.reason);
      return false;
    }
    if (ok) message.success(ok);
    return true;
  };

  function saveSummary() {
    if (run(store.updateMeeting(m!.id, { summary: draft.summary.trim() || undefined, decisions: draft.decisions.trim() || undefined }), "Hasil rapat disimpan.")) {
      setSummaryDraft(null);
    }
  }

  function openItem(item: ActionItem | null) {
    itemForm.resetFields();
    if (item) itemForm.setFieldsValue({ title: item.title, pics: item.pics, dueDate: item.dueDate ? dayjs(item.dueDate) : undefined, note: item.note });
    setItemModal({ item });
  }

  function saveItem() {
    itemForm.validateFields().then((v) => {
      const next: ActionItem = {
        id: itemModal?.item?.id ?? newId(),
        title: v.title.trim(),
        pics: v.pics ?? [],
        dueDate: v.dueDate?.format("YYYY-MM-DD"),
        note: v.note?.trim() || undefined,
        taskId: itemModal?.item?.taskId,
      };
      const list = itemModal?.item ? m!.actionItems.map((i) => (i.id === next.id ? next : i)) : [...m!.actionItems, next];
      if (run(store.setActionItems(m!.id, list), itemModal?.item ? "Tindak lanjut diperbarui." : "Tindak lanjut ditambahkan.")) setItemModal(null);
    }).catch(() => undefined);
  }

  function doConvert() {
    if (!convert || !phaseId) return;
    const res = convert.itemId === "all" ? store.convertAllActionItems(m!.id, phaseId) : store.convertActionItem(m!.id, convert.itemId, phaseId);
    if (res.ok) {
      message.success(`${res.count} tindak lanjut dijadikan task di Task Board.`);
      setConvert(null);
    } else message.warning(res.reason);
  }

  async function importCsv(file: File) {
    if (file.size > 1024 * 1024) {
      message.warning("File CSV terlalu besar (maks 1 MB).");
      return;
    }
    const { rows, skipped } = parseActionItemsCsv(await file.text());
    if (rows.length === 0) {
      message.warning("Tidak ada baris yang bisa dibaca. Pakai format template.");
      return;
    }
    const items: ActionItem[] = rows.map((r) => ({ id: newId(), title: r.title, pics: r.pics, dueDate: r.dueDate, note: r.note }));
    if (run(store.setActionItems(m!.id, [...m!.actionItems, ...items]))) {
      message.success(`${items.length} tindak lanjut diimpor${skipped ? `, ${skipped} baris dilewati` : ""}.`);
    }
  }

  function downloadTemplate() {
    const blob = new Blob([MOM_TEMPLATE_CSV], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "template-tindak-lanjut-mom.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <Link href="/meetings" style={{ display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
        <ArrowLeftOutlined /> Kembali ke Rapat
      </Link>

      <Card styles={{ body: { padding: "18px 22px" } }} style={{ borderTop: `4px solid ${st.main}`, marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 260 }}>
            <Space size={8} wrap style={{ marginBottom: 6 }}>
              <span style={{ width: 9, height: 9, borderRadius: "50%", background: projectColor(m.projectId), display: "inline-block" }} />
              <Link href={`/projects/${m.projectId}`} style={{ color: "#6B7280" }}>{project?.name}</Link>
              <Tag style={{ marginInlineEnd: 0, color: st.text, background: st.soft, borderColor: st.border }}>{meta.statusName(m.statusId)}</Tag>
              <Tag style={{ marginInlineEnd: 0 }}>{meta.categoryName(m.categoryId)}</Tag>
            </Space>
            <Title level={3} style={{ margin: 0, wordBreak: "break-word" }}>{m.title}</Title>
            <Text type="secondary">
              {dayjs(m.startsAt).locale("id").format("dddd, D MMMM YYYY")} · {dayjs(m.startsAt).format("HH:mm")}–{dayjs(m.endsAt).format("HH:mm")}
            </Text>
          </div>
          {canManage && (
            <Space align="start" wrap>
              <Select
                value={m.statusId}
                style={{ minWidth: 150 }}
                onChange={(v) => run(store.updateMeeting(m.id, { statusId: v }), "Status diperbarui.")}
                options={meta.statuses.map((s) => ({ value: s.id, label: s.name }))}
                aria-label="Ubah status rapat"
              />
              <Button icon={<EditOutlined />} onClick={() => setEdit(true)}>Ubah</Button>
              <Popconfirm
                title="Hapus rapat ini?"
                description={m.title}
                okText="Hapus"
                cancelText="Batal"
                okButtonProps={{ danger: true }}
                onConfirm={() => {
                  const res = store.deleteMeeting(m.id);
                  if (res.ok) {
                    message.success("Rapat dihapus.");
                    router.push("/meetings");
                  } else message.warning(res.reason);
                }}
              >
                <Button danger icon={<DeleteOutlined />} aria-label="Hapus rapat" />
              </Popconfirm>
            </Space>
          )}
        </div>
      </Card>

      {!canManage && (
        <Alert type="info" showIcon style={{ marginBottom: 12 }} title="Kamu bisa melihat rapat ini. Hanya PMO project atau pembuat rapat yang bisa mengubah peserta dan hasil rapat." />
      )}

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={9}>
          <Space orientation="vertical" size={16} style={{ width: "100%" }}>
            <Card title="Informasi" size="small">
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <Label>Pelaksanaan</Label>
                  {m.isOnline ? (
                    <div>
                      <Space size={6}><VideoCameraOutlined style={{ color: "#2F80ED" }} /><Text strong>Online</Text></Space>
                      <div style={{ marginTop: 6 }}>
                        {m.meetingUrl ? (
                          <Button type="primary" icon={<VideoCameraOutlined />} href={m.meetingUrl} target="_blank" rel="noopener noreferrer">
                            Buka link rapat
                          </Button>
                        ) : <Text type="secondary">Link belum diisi</Text>}
                        {m.meetingUrl && <div style={{ marginTop: 4, wordBreak: "break-all" }}><Text type="secondary" style={{ fontSize: 12 }}>{m.meetingUrl}</Text></div>}
                      </div>
                    </div>
                  ) : (
                    <Space size={6} align="start"><EnvironmentOutlined style={{ color: "#F97316", marginTop: 4 }} /><div><Text strong>Tatap muka (offline)</Text><div>{m.location}</div></div></Space>
                  )}
                </div>
                <div>
                  <Label>Deskripsi / agenda</Label>
                  {m.description ? <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", lineHeight: 1.6 }}>{m.description}</div> : <Text type="secondary">Belum ada deskripsi.</Text>}
                </div>
              </div>
            </Card>

            <Card title={`Peserta (${m.participants.length})`} size="small">
              <ParticipantsPicker
                value={m.participants}
                projectId={m.projectId}
                readOnly={!canManage}
                onChange={(list) => run(store.setParticipants(m.id, list))}
              />
            </Card>
          </Space>
        </Col>

        <Col xs={24} xl={15}>
          <Space orientation="vertical" size={16} style={{ width: "100%" }}>
            <Card title="Hasil rapat" size="small">
              {kind === "done" && !m.summary && m.attachments.length === 0 && m.actionItems.length === 0 && (
                <Alert type="warning" showIcon style={{ marginBottom: 12 }} title="Rapat ini sudah selesai tetapi belum ada hasilnya. Isi ringkasan, unggah file MOM, atau catat tindak lanjut." />
              )}
              <Space orientation="vertical" size={14} style={{ width: "100%" }}>
                <div>
                  <Label>Ringkasan hasil</Label>
                  {canManage ? (
                    <Input.TextArea value={draft.summary} autoSize={{ minRows: 3, maxRows: 12 }} maxLength={4000} showCount placeholder="Apa yang dibahas dan hasilnya…" onChange={(e) => setSummaryDraft({ ...draft, summary: e.target.value })} />
                  ) : m.summary ? <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{m.summary}</div> : <Text type="secondary">Belum ada ringkasan.</Text>}
                </div>
                <div>
                  <Label>Keputusan</Label>
                  {canManage ? (
                    <Input.TextArea value={draft.decisions} autoSize={{ minRows: 2, maxRows: 8 }} maxLength={2000} placeholder="Keputusan yang diambil (opsional)…" onChange={(e) => setSummaryDraft({ ...draft, decisions: e.target.value })} />
                  ) : m.decisions ? <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{m.decisions}</div> : <Text type="secondary">Belum ada keputusan tercatat.</Text>}
                </div>
                {canManage && dirty && (
                  <Space>
                    <Button type="primary" onClick={saveSummary}>Simpan hasil</Button>
                    <Button onClick={() => setSummaryDraft(null)}>Batalkan</Button>
                  </Space>
                )}
              </Space>
            </Card>

            <Card title={`File hasil rapat / MOM (${m.attachments.length})`} size="small">
              <Text type="secondary" style={{ display: "block", marginBottom: 10, fontSize: 13 }}>
                Bisa berupa Excel, PDF, gambar, dokumen apa pun, atau link ke dokumen bersama. Maks 10 MB per file.
              </Text>
              {canManage ? (
                <AttachmentsField value={m.attachments} onChange={(list) => run(store.updateMeeting(m.id, { attachments: list }))} />
              ) : m.attachments.length > 0 ? (
                <AttachmentsView items={m.attachments} />
              ) : (
                <Text type="secondary">Belum ada file.</Text>
              )}
            </Card>

            <Card
              title={`Tindak lanjut (${m.actionItems.length})`}
              size="small"
              extra={
                canManage && (
                  <Space wrap size={6}>
                    <Button size="small" icon={<DownloadOutlined />} onClick={downloadTemplate}>Template CSV</Button>
                    <Upload accept=".csv,text/csv" showUploadList={false} beforeUpload={(f) => { importCsv(f); return false; }}>
                      <Button size="small" icon={<UploadOutlined />}>Impor CSV</Button>
                    </Upload>
                    <Button size="small" icon={<PlusOutlined />} onClick={() => openItem(null)}>Tambah</Button>
                  </Space>
                )
              }
            >
              {m.actionItems.length === 0 ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Belum ada tindak lanjut. Catat satu per satu, atau impor dari template CSV." />
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {m.actionItems.map((i) => (
                    <div key={i.id} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 10, alignItems: "center", padding: "10px 12px", border: "1px solid #E5E9EF", borderRadius: 10, background: i.taskId ? "#F4FBF6" : "#fff" }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 500, wordBreak: "break-word" }}>{i.title}</div>
                        <div style={{ fontSize: 12, color: "#667085", marginTop: 2 }}>
                          PIC: {i.pics.length ? i.pics.join(", ") : <i>belum ditentukan</i>} · Target: {i.dueDate ? dayjs(i.dueDate).format("DD MMM YYYY") : "—"}
                        </div>
                        {i.note && <div style={{ fontSize: 12, color: "#667085" }}>{i.note}</div>}
                      </div>
                      <Space size={4} wrap style={{ justifyContent: "flex-end" }}>
                        {i.taskId ? (
                          <Link href={`/tasks/${i.taskId}`}><Tag color="green" icon={<FileDoneOutlined />} style={{ cursor: "pointer", marginInlineEnd: 0 }}>Sudah jadi task</Tag></Link>
                        ) : (
                          canManage && canCreateTasks && (
                            <Button size="small" icon={<RocketOutlined />} onClick={() => { setPhaseId(phases[phases.length - 1]?.id); setConvert({ itemId: i.id }); }}>
                              Jadikan task
                            </Button>
                          )
                        )}
                        {canManage && !i.taskId && <Button size="small" icon={<EditOutlined />} aria-label="Ubah tindak lanjut" onClick={() => openItem(i)} />}
                        {canManage && !i.taskId && (
                          <Popconfirm title="Hapus tindak lanjut ini?" okText="Hapus" cancelText="Batal" okButtonProps={{ danger: true }} onConfirm={() => run(store.setActionItems(m.id, m.actionItems.filter((x) => x.id !== i.id)))}>
                            <Button size="small" danger icon={<DeleteOutlined />} aria-label="Hapus tindak lanjut" />
                          </Popconfirm>
                        )}
                      </Space>
                    </div>
                  ))}
                </div>
              )}
              {canManage && unconverted.length > 1 && canCreateTasks && (
                <div style={{ marginTop: 12 }}>
                  <Button type="primary" icon={<RocketOutlined />} onClick={() => { setPhaseId(phases[phases.length - 1]?.id); setConvert({ itemId: "all" }); }}>
                    Jadikan semua ({unconverted.length}) sebagai task
                  </Button>
                </div>
              )}
              {canManage && unconverted.length > 0 && !canCreateTasks && (
                <Alert style={{ marginTop: 12 }} type="info" showIcon title="Hanya PMO project yang bisa menjadikan tindak lanjut sebagai task di Task Board." />
              )}
              <Text type="secondary" style={{ display: "block", marginTop: 10, fontSize: 12 }}>
                Tindak lanjut yang dijadikan task masuk Task Board dengan kategori To-Do Meeting dan menyebut rapat asalnya di deskripsi.
              </Text>
            </Card>
          </Space>
        </Col>
      </Row>

      <MeetingFormModal open={edit} meeting={m} onClose={() => setEdit(false)} />

      <Modal title={itemModal?.item ? "Ubah Tindak Lanjut" : "Tambah Tindak Lanjut"} open={itemModal !== null} onCancel={() => setItemModal(null)} onOk={saveItem} okText="Simpan" cancelText="Batal" destroyOnHidden>
        <Form form={itemForm} layout="vertical" requiredMark="optional">
          <Form.Item name="title" label="Tindak lanjut" rules={[{ required: true, whitespace: true, message: "Wajib diisi" }]}>
            <Input maxLength={200} autoFocus placeholder="mis. Selesaikan rekonsiliasi batch 2" />
          </Form.Item>
          <Form.Item name="pics" label="PIC" extra="Pilih dari peserta atau anggota tim project, atau ketik nama lain lalu Enter.">
            <Select mode="tags" tokenSeparators={[","]} options={memberNames.map((n) => ({ value: n, label: n }))} placeholder="Siapa yang mengerjakan?" />
          </Form.Item>
          <Form.Item name="dueDate" label="Target selesai">
            <DatePicker style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="note" label="Catatan">
            <Input.TextArea rows={2} maxLength={500} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={convert?.itemId === "all" ? `Jadikan ${unconverted.length} tindak lanjut sebagai task` : "Jadikan tindak lanjut sebagai task"}
        open={convert !== null}
        onCancel={() => setConvert(null)}
        onOk={doConvert}
        okText="Buat task"
        cancelText="Batal"
        okButtonProps={{ disabled: !phaseId }}
        destroyOnHidden
      >
        <Alert type="info" showIcon style={{ marginBottom: 12 }} title="Task dibuat di project rapat ini dengan kategori To-Do Meeting. PIC dan target mengikuti tindak lanjut; bila kosong, PIC diisi kamu dan target 7 hari setelah rapat." />
        <Label>Fase untuk task</Label>
        {phases.length === 0 ? (
          <Alert type="warning" showIcon title="Project ini belum punya fase. Tambahkan fase di detail project dulu." />
        ) : (
          <Select style={{ width: "100%" }} value={phaseId} onChange={setPhaseId} options={phases.map((p) => ({ value: p.id, label: p.name }))} />
        )}
      </Modal>
    </div>
  );
}
