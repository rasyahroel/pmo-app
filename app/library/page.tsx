"use client";

import { useMemo, useState } from "react";
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Empty,
  Form,
  Input,
  InputNumber,
  Menu,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Tabs,
  Tag,
  Typography,
  type MenuProps,
} from "antd";
import {
  ApiOutlined,
  BookOutlined,
  DatabaseOutlined,
  ClockCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  HomeOutlined,
  LockOutlined,
  PlusOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  TeamOutlined,
  RightOutlined,
} from "@ant-design/icons";
import PageSkeleton from "@/components/layout/PageSkeleton";
import Markdown, { extractHeadings } from "@/components/library/Markdown";
import { appUsers } from "@/lib/mock-data";
import { currentUser, isAdministrator } from "@/lib/access";
import { useLibraryStore, type ArticleInput, type LibraryArticle } from "@/lib/library-store";
import { LIBRARY_SECTIONS, canViewSection, hasTechnicalAccess, type LibrarySectionKey } from "@/lib/library-permissions";

const { Text, Title } = Typography;

const SECTION_ICON: Record<LibrarySectionKey, React.ReactNode> = {
  flow: <BookOutlined />,
  access: <SafetyCertificateOutlined />,
  schema: <DatabaseOutlined />,
  api: <ApiOutlined />,
};

// Judul sudah tampil di kepala artikel; buang judul level-1 pertama di isi supaya tidak dobel.
const stripTitle = (body: string) => body.replace(/^#\s+.*\n+/, "");

type FormValues = ArticleInput;

// ---------------------------------------------------------------------------
// Beranda Pustaka: pintu masuk yang ramah untuk pembaca baru
// ---------------------------------------------------------------------------
const QUICK_START: { id: string; label: string; hint: string }[] = [
  { id: "seed-flow-010", label: "Saya baru, mulai dari mana?", hint: "Pengantar, istilah, dan alur besar" },
  { id: "seed-flow-030", label: "Saya PMO: membuat dan mengisi project", hint: "Form project, tim, fase, dokumen" },
  { id: "seed-flow-110", label: "Saya PIC: mengerjakan task", hint: "Papan, sub task, komentar" },
  { id: "seed-access-040", label: "Apa yang boleh saya lakukan di task?", hint: "Hak akses task dan komentar" },
  { id: "seed-flow-045", label: "Bagaimana alur project dari awal sampai live?", hint: "Status, tahapan, dan aturan" },
  { id: "seed-schema-010", label: "Saya developer: skema database", hint: "Khusus akses teknis" },
  { id: "seed-api-080", label: "Saya developer: endpoint apa yang harus ada?", hint: "Khusus akses teknis" },
];

function LibraryHome({
  articles,
  techOk,
  onOpen,
  onSearch,
}: {
  articles: LibraryArticle[];
  techOk: boolean;
  onOpen: (id: string) => void;
  onSearch: (q: string) => void;
}) {
  const byId = new Map(articles.map((a) => [a.id, a]));
  const quick = QUICK_START.filter((q) => byId.has(q.id));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card styles={{ body: { padding: "28px 28px 24px" } }} style={{ background: "linear-gradient(135deg, #F2FAFB 0%, #FFFFFF 70%)" }}>
        <Title level={2} style={{ margin: 0 }}>
          Daftar Pustaka
        </Title>
        <Text style={{ fontSize: 15, color: "#475467" }}>
          Panduan memakai aplikasi PMO: apa isi tiap menu, cara mengisinya, siapa boleh melakukan apa, dan rancangan teknisnya.
        </Text>
        <Input.Search
          size="large"
          allowClear
          placeholder="Cari, misalnya: cara menambah sub task"
          enterButton="Cari"
          onSearch={onSearch}
          style={{ marginTop: 16, maxWidth: 560 }}
        />
      </Card>

      <Card title="Mulai dari sini" styles={{ body: { padding: 12 } }}>
        <Row gutter={[12, 12]}>
          {quick.map((q) => (
            <Col key={q.id} xs={24} md={12}>
              <a
                onClick={() => onOpen(q.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                  padding: "12px 14px",
                  border: "1px solid #E5E9EF",
                  borderRadius: 12,
                  color: "inherit",
                  height: "100%",
                }}
              >
                <span>
                  <span style={{ display: "block", fontWeight: 600 }}>{q.label}</span>
                  <span style={{ fontSize: 13, color: "#667085" }}>{q.hint}</span>
                </span>
                <RightOutlined style={{ color: "#98A2B3" }} />
              </a>
            </Col>
          ))}
        </Row>
      </Card>

      <Row gutter={[12, 12]}>
        {LIBRARY_SECTIONS.map((s) => {
          const list = articles.filter((a) => a.section === s.key);
          const locked = s.restricted && !techOk;
          return (
            <Col key={s.key} xs={24} md={12}>
              <Card
                style={{ height: "100%", opacity: locked ? 0.7 : 1 }}
                styles={{ body: { padding: 18 } }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                  <span style={{ fontSize: 22, color: "#22A7B8" }}>{locked ? <LockOutlined /> : SECTION_ICON[s.key]}</span>
                  <Title level={4} style={{ margin: 0 }}>
                    {s.label}
                  </Title>
                  {!locked && <Tag style={{ marginInlineStart: "auto", marginInlineEnd: 0 }}>{list.length} artikel</Tag>}
                </div>
                <Text type="secondary">{locked ? "Khusus developer tertentu. Hubungi Administrator bila kamu memerlukan akses." : s.description}</Text>
                {!locked && (
                  <ul style={{ margin: "10px 0 0", paddingInlineStart: 18 }}>
                    {list.slice(0, 4).map((a) => (
                      <li key={a.id} style={{ margin: "3px 0" }}>
                        <a onClick={() => onOpen(a.id)}>{a.title}</a>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </Col>
          );
        })}
      </Row>

      {byId.has("seed-flow-200") && (
        <Card styles={{ body: { padding: "14px 18px" } }}>
          Ada pertanyaan yang belum terjawab? Lihat{" "}
          <a onClick={() => onOpen("seed-flow-200")}>Tanya Jawab Umum</a>.
        </Card>
      )}
    </div>
  );
}

export default function LibraryPage() {
  const { message } = App.useApp();
  const store = useLibraryStore();
  const { articles, techAccessIds, canManage, canManageAccessList } = store;
  const [form] = Form.useForm<FormValues>();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [editor, setEditor] = useState<{ article: LibraryArticle | null; initial: Partial<FormValues> } | null>(null);
  const [accessOpen, setAccessOpen] = useState(false);
  const [accessIds, setAccessIds] = useState<string[]>([]);
  const body = Form.useWatch("body", form) ?? "";

  const techOk = hasTechnicalAccess(currentUser, techAccessIds);
  const selected = articles.find((a) => a.id === selectedId); // null = Beranda Pustaka

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return articles.filter((a) => [a.title, a.summary, a.body, ...a.tags].join(" ").toLowerCase().includes(q));
  }, [articles, query]);

  const menuItems: MenuProps["items"] = [
    { key: "home", icon: <HomeOutlined />, label: "Beranda Pustaka" },
    ...LIBRARY_SECTIONS.map((s) => {
    if (!canViewSection(currentUser, s.key, techAccessIds)) {
      return { key: `locked-${s.key}`, icon: <LockOutlined />, label: `${s.label} (terkunci)`, disabled: true };
    }
    return {
      key: `section-${s.key}`,
      icon: SECTION_ICON[s.key],
      label: s.label,
      children: articles.filter((a) => a.section === s.key).map((a) => ({ key: a.id, label: a.title })),
    };
  }),
  ];

  const sectionArticles = selected ? articles.filter((a) => a.section === selected.section) : [];
  const idx = selected ? sectionArticles.findIndex((a) => a.id === selected.id) : -1;
  const prev = idx > 0 ? sectionArticles[idx - 1] : undefined;
  const next = idx >= 0 && idx < sectionArticles.length - 1 ? sectionArticles[idx + 1] : undefined;
  const sectionMeta = selected ? LIBRARY_SECTIONS.find((s) => s.key === selected.section) : undefined;
  const content = selected ? stripTitle(selected.body) : "";
  const toc = useMemo(() => extractHeadings(content).filter((h) => h.level === 2), [content]);
  const readMinutes = Math.max(1, Math.round(content.split(/\s+/).length / 200));

  function openEditor(article: LibraryArticle | null) {
    // Nilai awal diberikan lewat initialValues pada <Form> yang baru dibuat saat modal dibuka.
    const initial: Partial<FormValues> = article
      ? { section: article.section, title: article.title, summary: article.summary, body: article.body, order: article.order, tags: article.tags }
      : {
          section: (selected?.section ?? "flow") as LibrarySectionKey,
          title: "",
          summary: "",
          body: "",
          order: (sectionArticles[sectionArticles.length - 1]?.order ?? 0) + 10,
          tags: [],
        };
    setEditor({ article, initial });
  }

  function saveArticle() {
    form
      .validateFields()
      .then((v) => {
        const input: ArticleInput = { ...v, tags: (v.tags ?? []).map((t) => t.trim()).filter(Boolean) };
        const res = editor?.article ? store.updateArticle(editor.article.id, input) : store.addArticle(input);
        if (!res.ok) {
          message.warning(res.reason);
          return;
        }
        message.success(editor?.article ? "Artikel diperbarui." : "Artikel ditambahkan.");
        if (res.id) setSelectedId(res.id);
        setEditor(null);
      })
      .catch(() => undefined);
  }

  const sectionOptions = LIBRARY_SECTIONS.filter((s) => canViewSection(currentUser, s.key, techAccessIds)).map((s) => ({
    value: s.key,
    label: s.restricted ? `${s.label} (khusus developer)` : s.label,
  }));

  const accessCandidates = appUsers.filter((u) => u.active && !isAdministrator(u));

  return (
    <PageSkeleton path="/library">
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={7} xl={6}>
          <Card styles={{ body: { padding: 12 } }}>
            <Input
              allowClear
              prefix={<SearchOutlined />}
              placeholder="Cari di pustaka…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{ marginBottom: 8 }}
            />

            {results ? (
              results.length === 0 ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Tidak ada artikel yang cocok." />
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: "62vh", overflowY: "auto" }}>
                  {results.map((a) => (
                    <a
                      key={a.id}
                      onClick={() => {
                        setSelectedId(a.id);
                        setQuery("");
                      }}
                      style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #EEF1F4", color: "inherit" }}
                    >
                      <div style={{ fontWeight: 500 }}>{a.title}</div>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {LIBRARY_SECTIONS.find((s) => s.key === a.section)?.label}
                      </Text>
                    </a>
                  ))}
                </div>
              )
            ) : (
              <div style={{ maxHeight: "62vh", overflowY: "auto" }}>
                <Menu
                  mode="inline"
                  items={menuItems}
                  selectedKeys={selected ? [selected.id] : ["home"]}
                  defaultOpenKeys={LIBRARY_SECTIONS.map((s) => `section-${s.key}`)}
                  onClick={({ key }) => setSelectedId(key === "home" ? null : key)}
                  style={{ border: 0 }}
                />
              </div>
            )}

            {!techOk && (
              <Alert
                type="info"
                showIcon
                icon={<LockOutlined />}
                style={{ marginTop: 10 }}
                title="Skema Database dan API khusus developer tertentu."
                description="Hubungi Administrator bila kamu memerlukan akses."
              />
            )}

            {(canManage || canManageAccessList) && (
              <Space orientation="vertical" size={8} style={{ width: "100%", marginTop: 10 }}>
                {canManage && (
                  <Button block type="primary" icon={<PlusOutlined />} onClick={() => openEditor(null)}>
                    Tambah Artikel
                  </Button>
                )}
                {canManageAccessList && (
                  <Button
                    block
                    icon={<TeamOutlined />}
                    onClick={() => {
                      setAccessIds(techAccessIds);
                      setAccessOpen(true);
                    }}
                  >
                    Akses Teknis ({techAccessIds.length})
                  </Button>
                )}
              </Space>
            )}
          </Card>
        </Col>

        <Col xs={24} lg={17} xl={18}>
          {!selected ? (
            <LibraryHome
              articles={articles}
              techOk={techOk}
              onOpen={(id) => setSelectedId(id)}
              onSearch={(q) => setQuery(q)}
            />
          ) : (
            <Card styles={{ body: { padding: "24px 28px" } }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, marginBottom: 14, flexWrap: "wrap" }}>
                <a onClick={() => setSelectedId(null)}>Pustaka</a>
                <RightOutlined style={{ fontSize: 10, color: "#98A2B3" }} />
                <Text type="secondary">{sectionMeta?.label}</Text>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <Title level={2} style={{ margin: "0 0 6px" }}>
                    {selected.title}
                  </Title>
                  <Text style={{ fontSize: 15, color: "#475467" }}>{selected.summary}</Text>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginTop: 10 }}>
                    <Tag color={sectionMeta?.restricted ? "volcano" : "cyan"} icon={sectionMeta?.restricted ? <LockOutlined /> : undefined} style={{ marginInlineEnd: 0 }}>
                      {sectionMeta?.label}
                    </Tag>
                    <Text type="secondary" style={{ fontSize: 13 }}>
                      <ClockCircleOutlined /> ±{readMinutes} menit baca
                    </Text>
                    <Text type="secondary" style={{ fontSize: 13 }}>
                      Diperbarui {selected.updatedAt} oleh {selected.updatedBy}
                    </Text>
                  </div>
                </div>
                {canManage && (
                  <Space align="start">
                    <Button icon={<EditOutlined />} onClick={() => openEditor(selected)}>
                      Ubah
                    </Button>
                    <Popconfirm
                      title="Hapus artikel ini?"
                      description={sectionMeta?.restricted ? "Artikel teknis" : selected.title}
                      okText="Hapus"
                      cancelText="Batal"
                      okButtonProps={{ danger: true }}
                      onConfirm={() => {
                        const res = store.deleteArticle(selected.id);
                        if (res.ok) {
                          setSelectedId(null);
                          message.success("Artikel dihapus.");
                        } else message.warning(res.reason);
                      }}
                    >
                      <Button danger icon={<DeleteOutlined />} aria-label="Hapus artikel" />
                    </Popconfirm>
                  </Space>
                )}
              </div>

              {toc.length >= 3 && (
                <div style={{ margin: "20px 0 4px", padding: "12px 16px", background: "#F5FAFB", border: "1px solid #E1EEF1", borderRadius: 12, maxWidth: 820 }}>
                  <Text strong style={{ fontSize: 13 }}>
                    Di artikel ini
                  </Text>
                  <ol style={{ margin: "6px 0 0", paddingInlineStart: 20, columns: toc.length > 6 ? 2 : 1 }}>
                    {toc.map((h) => (
                      <li key={h.id} style={{ fontSize: 14, margin: "2px 0" }}>
                        <a href={`#${h.id}`}>{h.text}</a>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {/* lebar baca dibatasi supaya nyaman dibaca */}
              <div style={{ marginTop: 14, maxWidth: 820 }}>
                <Markdown source={content} />
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 32, paddingTop: 16, borderTop: "1px solid #EEF1F4", flexWrap: "wrap" }}>
                {prev ? (
                  <Button size="large" onClick={() => setSelectedId(prev.id)} style={{ height: "auto", padding: "8px 14px", textAlign: "left" }}>
                    <div style={{ fontSize: 12, color: "#98A2B3" }}>← Sebelumnya</div>
                    <div>{prev.title}</div>
                  </Button>
                ) : (
                  <span />
                )}
                {next ? (
                  <Button size="large" type="primary" ghost onClick={() => setSelectedId(next.id)} style={{ height: "auto", padding: "8px 14px", textAlign: "right" }}>
                    <div style={{ fontSize: 12, opacity: 0.7 }}>Selanjutnya →</div>
                    <div>{next.title}</div>
                  </Button>
                ) : (
                  <span />
                )}
              </div>
            </Card>
          )}
        </Col>
      </Row>

      <Modal
        title={editor?.article ? "Ubah Artikel" : "Tambah Artikel"}
        open={editor !== null}
        onCancel={() => setEditor(null)}
        onOk={saveArticle}
        okText="Simpan"
        cancelText="Batal"
        width={860}
        destroyOnHidden
        styles={{ body: { maxHeight: "72vh", overflowY: "auto" } }}
      >
        <Form form={form} layout="vertical" requiredMark="optional" initialValues={editor?.initial}>
          <Row gutter={12}>
            <Col xs={24} sm={14}>
              <Form.Item name="section" label="Bagian" rules={[{ required: true, message: "Wajib diisi" }]}>
                <Select options={sectionOptions} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={10}>
              <Form.Item name="order" label="Urutan" extra="Angka kecil tampil lebih dulu." rules={[{ required: true, message: "Wajib diisi" }]}>
                <InputNumber min={0} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="title" label="Judul" rules={[{ required: true, whitespace: true, message: "Wajib diisi" }]}>
            <Input maxLength={120} />
          </Form.Item>
          <Form.Item name="summary" label="Ringkasan" extra="Satu atau dua kalimat yang tampil di bawah judul.">
            <Input.TextArea rows={2} maxLength={300} showCount />
          </Form.Item>
          <Form.Item name="tags" label="Tag">
            <Select mode="tags" tokenSeparators={[","]} placeholder="Ketik tag lalu Enter" />
          </Form.Item>
          <Form.Item label="Isi (markdown)" required style={{ marginBottom: 0 }}>
            <Tabs
              size="small"
              items={[
                {
                  key: "write",
                  label: "Tulis",
                  forceRender: true,
                  children: (
                    <Form.Item name="body" noStyle rules={[{ required: true, whitespace: true, message: "Isi wajib diisi" }]}>
                      <Input.TextArea rows={16} style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 13 }} />
                    </Form.Item>
                  ),
                },
                {
                  key: "preview",
                  label: "Pratinjau",
                  children: (
                    <div style={{ minHeight: 280, padding: 12, border: "1px solid #E5E9EF", borderRadius: 8 }}>
                      {body.trim() ? <Markdown source={body} /> : <Text type="secondary">Belum ada isi.</Text>}
                    </div>
                  ),
                },
              ]}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              Format: <code># Judul</code>, <code>**tebal**</code>, <code>- daftar</code>, <code>1. langkah</code>, <code>&gt; catatan</code>, tabel dengan garis tegak, dan blok kode.
            </Text>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Akses Teknis Daftar Pustaka"
        open={accessOpen}
        onCancel={() => setAccessOpen(false)}
        onOk={() => {
          const res = store.setTechAccess(accessIds);
          if (res.ok) {
            message.success("Daftar akses teknis diperbarui.");
            setAccessOpen(false);
          } else message.warning(res.reason);
        }}
        okText="Simpan"
        cancelText="Batal"
        destroyOnHidden
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          title="Pengguna yang dipilih bisa membaca dan mengelola bagian Skema Database dan API. Administrator selalu punya akses."
        />
        <Select
          mode="multiple"
          style={{ width: "100%" }}
          placeholder="Pilih developer"
          value={accessIds}
          onChange={setAccessIds}
          optionFilterProp="label"
          options={accessCandidates.map((u) => ({ value: u.id, label: `${u.name} — ${u.roles.join(", ")}` }))}
        />
      </Modal>
    </PageSkeleton>
  );
}
