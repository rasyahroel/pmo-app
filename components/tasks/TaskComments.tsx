"use client";

import { useState } from "react";
import { App, Avatar, Button, Empty, Input, Popconfirm, Typography } from "antd";
import { DeleteOutlined, EditOutlined, PaperClipOutlined, SendOutlined } from "@ant-design/icons";
import type { TaskAttachment } from "@/lib/mock-data";
import { useCurrentUser } from "@/lib/acting-user";
import { useCommentStore, useTaskComments } from "@/lib/comment-store";
import { useTaskStore } from "@/lib/task-store";
import { useTaskPermissions } from "@/lib/use-task-permissions";
import { initials } from "@/lib/task-ui";
import { agi } from "@/app/providers";
import AttachmentsField from "@/components/tasks/AttachmentsField";
import AttachmentsView from "@/components/tasks/AttachmentsView";

const { Text } = Typography;

const fmt = (iso: string) => new Date(iso).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });

// Komentar pada satu task / sub task. Lampiran bisa gambar, PDF/file, atau link.
export default function TaskComments({ taskId }: { taskId: string }) {
  const currentUser = useCurrentUser();
  const { message } = App.useApp();
  const { addComment, updateComment, deleteComment } = useCommentStore();
  const { tasks } = useTaskStore();
  const perms = useTaskPermissions();
  const task = tasks.find((t) => t.id === taskId);
  const canComment = !!task && perms.canComment(task);
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const comments = useTaskComments(taskId);
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [showAttach, setShowAttach] = useState(false);

  const canSend = text.trim().length > 0 || attachments.length > 0;

  function send() {
    if (!canSend) return;
    const res = addComment(taskId, text, attachments);
    if (!res.ok) {
      message.warning(res.reason);
      return;
    }
    setText("");
    setAttachments([]);
    setShowAttach(false);
    message.success("Komentar dikirim.");
  }

  return (
    <div>
      {comments.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Belum ada komentar." style={{ margin: "8px 0 16px" }} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 18 }}>
          {comments.map((c) => (
            <div key={c.id} style={{ display: "flex", gap: 10 }}>
              <Avatar size={32} style={{ background: agi[200], color: agi[800], flexShrink: 0 }}>
                {initials(c.author)}
              </Avatar>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <Text strong>{c.author}</Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {fmt(c.createdAt)}
                  </Text>
                  <span style={{ marginInlineStart: "auto", display: "inline-flex", gap: 2 }}>
                    {perms.isCommentOwner(c.author) && (
                      <Button
                        size="small"
                        type="text"
                        icon={<EditOutlined />}
                        aria-label="Ubah komentar"
                        onClick={() => setEditing({ id: c.id, text: c.text })}
                      />
                    )}
                    {task && perms.canDeleteComment(c.author, task) && (
                      <Popconfirm
                        title="Hapus komentar ini?"
                        description={c.author !== currentUser.name ? `Komentar milik ${c.author}` : undefined}
                        okText="Hapus"
                        cancelText="Batal"
                        okButtonProps={{ danger: true }}
                        onConfirm={() => {
                          const res = deleteComment(c.id);
                          if (res.ok) message.success("Komentar dihapus.");
                          else message.warning(res.reason);
                        }}
                      >
                        <Button size="small" type="text" danger icon={<DeleteOutlined />} aria-label="Hapus komentar" />
                      </Popconfirm>
                    )}
                  </span>
                </div>
                {editing?.id === c.id ? (
                  <div style={{ marginTop: 4 }}>
                    <Input.TextArea
                      value={editing.text}
                      autoSize={{ minRows: 2, maxRows: 8 }}
                      maxLength={2000}
                      onChange={(e) => setEditing({ id: c.id, text: e.target.value })}
                    />
                    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 6 }}>
                      <Button size="small" onClick={() => setEditing(null)}>
                        Batal
                      </Button>
                      <Button
                        size="small"
                        type="primary"
                        onClick={() => {
                          const res = updateComment(c.id, editing.text);
                          if (res.ok) {
                            setEditing(null);
                            message.success("Komentar diperbarui.");
                          } else message.warning(res.reason);
                        }}
                      >
                        Simpan
                      </Button>
                    </div>
                  </div>
                ) : (
                  c.text && <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", lineHeight: 1.55, marginTop: 2 }}>{c.text}</div>
                )}
                {c.attachments.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <AttachmentsView items={c.attachments} thumb={96} />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {!canComment ? (
        <Text type="secondary">Kamu tidak punya akses ke project ini, jadi tidak bisa berkomentar.</Text>
      ) : (
      <div style={{ display: "flex", gap: 10 }}>
        <Avatar size={32} style={{ background: agi[500], color: "#fff", flexShrink: 0 }}>
          {initials(currentUser.name)}
        </Avatar>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Input.TextArea
            value={text}
            autoSize={{ minRows: 2, maxRows: 8 }}
            maxLength={2000}
            placeholder="Tulis komentar… (Ctrl+Enter untuk kirim)"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                send();
              }
            }}
          />
          {showAttach && (
            <div style={{ marginTop: 8 }}>
              <AttachmentsField value={attachments} onChange={setAttachments} />
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
            <Button icon={<PaperClipOutlined />} onClick={() => setShowAttach((v) => !v)}>
              {attachments.length > 0 ? `Lampiran (${attachments.length})` : "Lampirkan gambar / PDF / link"}
            </Button>
            <Button type="primary" icon={<SendOutlined />} disabled={!canSend} onClick={send}>
              Kirim
            </Button>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
