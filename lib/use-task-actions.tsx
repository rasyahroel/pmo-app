"use client";

import { Alert, App } from "antd";
import { ExclamationCircleFilled } from "@ant-design/icons";
import type { Task, TaskStatus } from "@/lib/mock-data";
import { useStatusMeta } from "@/lib/master-store";
import { useTaskStore, type ActionResult, type TaskPatch } from "@/lib/task-store";

// Aksi ubah status / ubah task yang menangani "sub task belum selesai" dengan satu cara di semua
// layar: store menolak dulu, lalu hook ini menampilkan peringatan + konfirmasi. Kalau dikonfirmasi,
// aksi diulang dengan `completeSubtasks: true` (semua sub task ikut selesai, tercatat di Riwayat).
export function useTaskActions() {
  const { moveTask, updateTask } = useTaskStore();
  const { message, modal } = App.useApp();
  const { nameOf } = useStatusMeta();

  function confirmComplete(parent: Task, open: Task[], run: () => ActionResult, onOk: (completed: number) => void) {
    modal.confirm({
      title: "Masih ada sub task yang belum selesai",
      icon: <ExclamationCircleFilled style={{ color: "#F6B100" }} />,
      width: 500,
      okText: "Ya, selesaikan semua",
      cancelText: "Batal",
      content: (
        <div>
          <Alert
            type="warning"
            showIcon
            style={{ margin: "8px 0 12px" }}
            title={`${open.length} sub task dari "${parent.title}" belum selesai.`}
            description="Kalau dilanjutkan, semuanya otomatis ditandai selesai (progress 100%). Perubahan ini tercatat di Riwayat Perubahan."
          />
          <ul style={{ margin: 0, paddingInlineStart: 20 }}>
            {open.slice(0, 6).map((k) => (
              <li key={k.id}>
                {k.title} <span style={{ color: "#8C93A3" }}>· {nameOf(k.status)}</span>
              </li>
            ))}
            {open.length > 6 && <li style={{ color: "#8C93A3" }}>+{open.length - 6} lainnya</li>}
          </ul>
        </div>
      ),
      onOk: () => {
        const res = run();
        if (res.ok) onOk(res.completedSubtasks ?? open.length);
        else message.warning(res.reason);
      },
    });
  }

  /** Pindah/ganti status task. Menampilkan pesan hasil sendiri. */
  function move(task: Task, status: TaskStatus, beforeId: string | null = null, onDone?: () => void) {
    const ok = (completed = 0) => {
      message.success(
        `"${task.title}" dipindah ke ${nameOf(status)}${completed ? ` — ${completed} sub task ikut selesai` : ""}.`,
      );
      onDone?.();
    };
    const res = moveTask(task.id, status, beforeId);
    if (res.ok) return ok();
    if (res.openSubtasks) {
      confirmComplete(task, res.openSubtasks, () => moveTask(task.id, status, beforeId, { completeSubtasks: true }), ok);
    } else message.warning(res.reason);
  }

  /** Ubah field task (mis. dari form). `onDone` dipanggil setelah berhasil — langsung atau setelah konfirmasi. */
  function update(task: Task, patch: TaskPatch, onDone: () => void) {
    const res = updateTask(task.id, patch);
    if (res.ok) return onDone();
    if (res.openSubtasks) {
      confirmComplete(task, res.openSubtasks, () => updateTask(task.id, patch, { completeSubtasks: true }), () => onDone());
    } else message.warning(res.reason);
  }

  return { move, update };
}
