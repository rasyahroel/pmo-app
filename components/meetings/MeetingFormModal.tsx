"use client";

import { useState } from "react";
import { App, Alert, Button, Col, DatePicker, Form, Input, Modal, Radio, Row, Select, Space } from "antd";
import { EnvironmentOutlined, VideoCameraOutlined } from "@ant-design/icons";
import dayjs, { type Dayjs } from "dayjs";
import { projects } from "@/lib/mock-data";
import { useMeetingMeta } from "@/lib/master-store";
import { useMeetingStore, type MeetingRecord, type Participant } from "@/lib/meeting-store";
import { useMeetingPermissions } from "@/lib/use-meeting-permissions";
import { projectColor } from "@/lib/task-ui";
import ParticipantsPicker from "@/components/meetings/ParticipantsPicker";

type FormValues = {
  title: string;
  projectId: string;
  categoryId: string;
  statusId: string;
  range: [Dayjs, Dayjs];
  isOnline: boolean;
  meetingUrl?: string;
  location?: string;
  description?: string;
  participants: Participant[];
};

const isHttpUrl = (v: string) => {
  try {
    const u = new URL(v);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
};

function Body({ meeting, defaults, onClose, onSaved }: { meeting: MeetingRecord | null; defaults?: { projectId?: string; date?: string }; onClose: () => void; onSaved?: (id: string) => void }) {
  const { message } = App.useApp();
  const store = useMeetingStore();
  const meta = useMeetingMeta();
  const perms = useMeetingPermissions();
  const [form] = Form.useForm<FormValues>();

  const [initial] = useState<Partial<FormValues>>(() => {
    if (meeting) {
      return {
        title: meeting.title,
        projectId: meeting.projectId,
        categoryId: meeting.categoryId,
        statusId: meeting.statusId,
        range: [dayjs(meeting.startsAt), dayjs(meeting.endsAt)],
        isOnline: meeting.isOnline,
        meetingUrl: meeting.meetingUrl,
        location: meeting.location,
        description: meeting.description,
        participants: meeting.participants,
      };
    }
    // tanggal bawaan dari klik di kalender; kalau tidak ada, besok jam 10.00
    const start = (defaults?.date ? dayjs(defaults.date) : dayjs().add(1, "day")).hour(10).minute(0).second(0);
    const pid = defaults?.projectId && perms.canCreateIn(defaults.projectId) ? defaults.projectId : undefined;
    return {
      projectId: pid,
      categoryId: meta.categories[0]?.id,
      statusId: meta.firstStatusOfKind("planned"),
      range: [start, start.add(1, "hour")],
      isOnline: false,
      participants: [],
    };
  });

  const isOnline = Form.useWatch("isOnline", form) ?? initial.isOnline;
  const projectId = Form.useWatch("projectId", form) ?? initial.projectId;

  function submit() {
    form
      .validateFields()
      .then((v) => {
        const payload = {
          title: v.title.trim(),
          projectId: v.projectId,
          categoryId: v.categoryId,
          statusId: v.statusId,
          startsAt: v.range[0].format("YYYY-MM-DDTHH:mm:ss"),
          endsAt: v.range[1].format("YYYY-MM-DDTHH:mm:ss"),
          isOnline: v.isOnline,
          // hanya simpan field yang sesuai mode, supaya data lama tidak tersisa
          meetingUrl: v.isOnline ? v.meetingUrl?.trim() : undefined,
          location: v.isOnline ? undefined : v.location?.trim(),
          description: v.description?.trim() || undefined,
          participants: v.participants ?? [],
        };
        const res = meeting ? store.updateMeeting(meeting.id, payload) : store.addMeeting(payload);
        if (!res.ok) {
          message.warning(res.reason);
          return;
        }
        message.success(meeting ? "Rapat diperbarui." : "Rapat dijadwalkan.");
        if (res.id) onSaved?.(res.id);
        onClose();
      })
      .catch(() => undefined);
  }

  const projectOptions = projects
    .filter((p) => (meeting ? perms.canCreateIn(p.id) || p.id === meeting.projectId : perms.canCreateIn(p.id)))
    .map((p) => ({
      value: p.id,
      text: p.name,
      label: (
        <Space size={8}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: projectColor(p.id), display: "inline-block" }} />
          {p.name}
        </Space>
      ),
    }));

  return (
    <Form form={form} layout="vertical" initialValues={initial} requiredMark="optional">
      <Form.Item name="title" label="Judul Rapat" rules={[{ required: true, whitespace: true, message: "Wajib diisi" }]}>
        <Input autoFocus maxLength={160} placeholder="mis. Review FSD Fase 2" />
      </Form.Item>

      <Row gutter={12}>
        <Col xs={24} sm={12}>
          <Form.Item name="projectId" label="Project" rules={[{ required: true, message: "Wajib diisi" }]}>
            <Select
              showSearch
              placeholder="Pilih project"
              optionFilterProp="text"
              options={projectOptions}
              disabled={!!meeting && !perms.canCreateIn(meeting.projectId)}
              onChange={() => undefined}
            />
          </Form.Item>
        </Col>
        <Col xs={12} sm={6}>
          <Form.Item name="categoryId" label="Kategori" rules={[{ required: true, message: "Wajib diisi" }]}>
            <Select options={meta.categories.map((c) => ({ value: c.id, label: c.name }))} />
          </Form.Item>
        </Col>
        <Col xs={12} sm={6}>
          <Form.Item name="statusId" label="Status" rules={[{ required: true, message: "Wajib diisi" }]}>
            <Select options={meta.statuses.map((s) => ({ value: s.id, label: s.name }))} />
          </Form.Item>
        </Col>
      </Row>

      <Form.Item
        name="range"
        label="Waktu (mulai sampai selesai)"
        rules={[
          { required: true, message: "Wajib diisi" },
          { validator: (_, v: [Dayjs, Dayjs]) => (v && v[1].isAfter(v[0]) ? Promise.resolve() : Promise.reject(new Error("Waktu selesai harus setelah waktu mulai"))) },
        ]}
      >
        <DatePicker.RangePicker showTime={{ format: "HH:mm", minuteStep: 5 }} format="DD MMM YYYY HH:mm" style={{ width: "100%" }} />
      </Form.Item>

      <Form.Item name="isOnline" label="Pelaksanaan" rules={[{ required: true }]}>
        <Radio.Group optionType="button" buttonStyle="solid">
          <Radio.Button value={false}>
            <EnvironmentOutlined /> Tatap muka (offline)
          </Radio.Button>
          <Radio.Button value={true}>
            <VideoCameraOutlined /> Online
          </Radio.Button>
        </Radio.Group>
      </Form.Item>

      {isOnline ? (
        <Form.Item
          name="meetingUrl"
          label="Link rapat online"
          rules={[
            { required: true, whitespace: true, message: "Link wajib diisi untuk rapat online" },
            { validator: (_, v: string) => (!v || isHttpUrl(v.trim()) ? Promise.resolve() : Promise.reject(new Error("Link harus diawali http:// atau https://"))) },
          ]}
        >
          <Input placeholder="https://meet.google.com/… atau link Zoom / Teams" />
        </Form.Item>
      ) : (
        <Form.Item name="location" label="Lokasi" rules={[{ required: true, whitespace: true, message: "Lokasi wajib diisi untuk rapat tatap muka" }]}>
          <Input maxLength={160} placeholder="mis. Ruang Rapat Lt. 5, Gedung Utama" />
        </Form.Item>
      )}

      <Form.Item name="description" label="Deskripsi / agenda">
        <Input.TextArea autoSize={{ minRows: 3, maxRows: 8 }} maxLength={2000} showCount placeholder="Tujuan rapat, agenda yang dibahas, bahan yang perlu dibaca…" />
      </Form.Item>

      <Form.Item name="participants" label="Peserta" extra="Bisa ditambah kapan saja, juga setelah rapat dibuat.">
        <ParticipantsPicker projectId={projectId} />
      </Form.Item>

      {meeting && (
        <Alert type="info" showIcon style={{ marginBottom: 12 }} title="Hasil rapat (MOM, file, tindak lanjut) diisi di halaman detail rapat." />
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <Button onClick={onClose}>Batal</Button>
        <Button type="primary" onClick={submit}>
          Simpan
        </Button>
      </div>
    </Form>
  );
}

export default function MeetingFormModal({
  open,
  meeting,
  defaults,
  onClose,
  onSaved,
}: {
  open: boolean;
  meeting: MeetingRecord | null;
  defaults?: { projectId?: string; date?: string };
  onClose: () => void;
  onSaved?: (id: string) => void;
}) {
  return (
    <Modal title={meeting ? "Ubah Rapat" : "Jadwalkan Rapat"} open={open} onCancel={onClose} footer={null} destroyOnHidden width={760} styles={{ body: { maxHeight: "74vh", overflowY: "auto", paddingInlineEnd: 6 } }}>
      <Body key={meeting?.id ?? "new"} meeting={meeting} defaults={defaults} onClose={onClose} onSaved={onSaved} />
    </Modal>
  );
}
