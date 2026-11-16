"use client";

import { useState } from "react";
import { App, Button, Image, Input, Upload } from "antd";
import { DeleteOutlined, FileOutlined, LinkOutlined, UploadOutlined } from "@ant-design/icons";
import { MAX_ATTACHMENT_BYTES, formatBytes, normalizeUrl } from "@/lib/task-ui";
import type { TaskAttachment as Attachment } from "@/lib/mock-data";

// Lampiran task/subtask: link, gambar, atau file. Dipakai sebagai field Form.Item (value/onChange).
// Sementara file disimpan sebagai blob URL; dengan backend: upload ke POST /files lalu simpan URL/id-nya.
export default function AttachmentsField({
  value = [],
  onChange,
  compact,
}: {
  value?: Attachment[];
  onChange?: (v: Attachment[]) => void;
  compact?: boolean;
}) {
  const { message } = App.useApp();
  const [link, setLink] = useState("");

  const emit = (next: Attachment[]) => onChange?.(next);

  function addLink() {
    if (!link.trim()) return;
    const url = normalizeUrl(link);
    if (!url) {
      message.warning("Link tidak valid. Gunakan alamat http:// atau https://");
      return;
    }
    emit([...value, { id: `a-${Date.now().toString(36)}${value.length}`, kind: "link", name: url.replace(/^https?:\/\//, ""), url }]);
    setLink("");
  }

  function addFile(file: File) {
    if (file.size > MAX_ATTACHMENT_BYTES) {
      message.warning(`"${file.name}" melebihi ${formatBytes(MAX_ATTACHMENT_BYTES)}.`);
      return Upload.LIST_IGNORE;
    }
    const kind = file.type.startsWith("image/") ? "image" : "file";
    emit([
      ...value,
      {
        id: `a-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
        kind,
        name: file.name,
        url: URL.createObjectURL(file),
        size: file.size,
      },
    ]);
    return false; // jangan upload otomatis
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Input
          value={link}
          onChange={(e) => setLink(e.target.value)}
          onPressEnter={(e) => {
            e.preventDefault();
            addLink();
          }}
          prefix={<LinkOutlined />}
          placeholder="Tempel link lalu Enter"
          style={{ flex: 1, minWidth: compact ? 160 : 220 }}
          aria-label="Tambah link"
        />
        <Button onClick={addLink}>Tambah link</Button>
        <Upload multiple showUploadList={false} beforeUpload={addFile}>
          <Button icon={<UploadOutlined />}>Unggah file / gambar</Button>
        </Upload>
      </div>

      {value.length > 0 && (
        <ul style={{ listStyle: "none", margin: "10px 0 0", padding: 0, display: "grid", gap: 6 }}>
          {value.map((a) => (
            <li
              key={a.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "6px 8px",
                borderRadius: 8,
                background: "#F7FAFB",
                borderStyle: "solid",
                borderWidth: 1,
                borderColor: "#E4EDF0",
              }}
            >
              {a.kind === "image" ? (
                <Image src={a.url} alt={a.name} width={36} height={36} style={{ objectFit: "cover", borderRadius: 6 }} />
              ) : (
                <span style={{ width: 36, height: 36, display: "grid", placeItems: "center", color: "#22A7B8", fontSize: 18 }}>
                  {a.kind === "link" ? <LinkOutlined /> : <FileOutlined />}
                </span>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                {a.kind === "link" ? (
                  <a href={a.url} target="_blank" rel="noopener noreferrer" style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {a.name}
                  </a>
                ) : (
                  <a href={a.url} download={a.name} style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {a.name}
                  </a>
                )}
                {a.size ? <span style={{ fontSize: 11, color: "#99A1B7" }}>{formatBytes(a.size)}</span> : null}
              </div>
              <Button
                type="text"
                size="small"
                danger
                icon={<DeleteOutlined />}
                aria-label={`Hapus lampiran ${a.name}`}
                onClick={() => emit(value.filter((x) => x.id !== a.id))}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
