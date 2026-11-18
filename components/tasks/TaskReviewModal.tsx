"use client";

import { useState } from "react";
import { App, Button, DatePicker, Form, Input, Modal, Select } from "antd";
import dayjs from "dayjs";
import { masterReviewStatuses, type ReviewStatus, type Task } from "@/lib/mock-data";
import { useCurrentUser } from "@/lib/acting-user";
import { useTaskStore } from "@/lib/task-store";

type FormValues = {
  reviewedBy?: string;
  reviewedAt?: dayjs.Dayjs;
  reviewStatus: ReviewStatus;
};

function ReviewBody({ task, onClose }: { task: Task; onClose: () => void }) {
  const { message } = App.useApp();
  const { setReview } = useTaskStore();
  const currentUser = useCurrentUser();
  const [form] = Form.useForm<FormValues>();

  // Review pertama: isi otomatis reviewer = pengguna yang sedang login & tanggal = hari ini.
  const [initialValues] = useState<FormValues>(() => {
    const reviewed = task.reviewStatus && task.reviewStatus !== "Belum Direview";
    return {
      reviewedBy: task.reviewedBy ?? (reviewed ? undefined : currentUser.name),
      reviewedAt: task.reviewedAt ? dayjs(task.reviewedAt) : reviewed ? undefined : dayjs(),
      reviewStatus: task.reviewStatus ?? "Belum Direview",
    };
  });

  function submit() {
    form
      .validateFields()
      .then((v) => {
        const res = setReview(task.id, {
          reviewedBy: v.reviewedBy?.trim() || undefined,
          reviewedAt: v.reviewedAt ? v.reviewedAt.format("YYYY-MM-DD") : undefined,
          reviewStatus: v.reviewStatus,
        });
        if (!res.ok) {
          message.warning(res.reason);
          return;
        }
        message.success("Review task diperbarui.");
        onClose();
      })
      .catch(() => undefined);
  }

  return (
    <Form form={form} layout="vertical" initialValues={initialValues}>
      <Form.Item name="reviewStatus" label="Status Review" rules={[{ required: true, message: "Wajib diisi" }]}>
        <Select options={masterReviewStatuses.map((s) => ({ label: s, value: s }))} />
      </Form.Item>
      <Form.Item name="reviewedBy" label="Direview Oleh">
        <Input placeholder="Nama reviewer" />
      </Form.Item>
      <Form.Item name="reviewedAt" label="Tanggal Review">
        <DatePicker style={{ width: "100%" }} />
      </Form.Item>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <Button onClick={onClose}>Batal</Button>
        <Button type="primary" onClick={submit}>
          Simpan
        </Button>
      </div>
    </Form>
  );
}

export default function TaskReviewModal({ task, onClose }: { task: Task | null; onClose: () => void }) {
  return (
    <Modal title={task ? `Review Task — ${task.title}` : "Review Task"} open={task !== null} onCancel={onClose} footer={null} destroyOnHidden>
      {task && <ReviewBody key={task.id} task={task} onClose={onClose} />}
    </Modal>
  );
}
