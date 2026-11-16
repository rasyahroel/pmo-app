"use client";

import { Image, Typography } from "antd";
import { FileOutlined, LinkOutlined } from "@ant-design/icons";
import type { TaskAttachment } from "@/lib/mock-data";

const { Text } = Typography;

function formatSize(bytes?: number) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function hostOf(url: string) {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

// Tampilan baca-saja untuk lampiran: gambar sebagai thumbnail (klik = pratinjau besar),
// file & link sebagai baris yang bisa dibuka.
export default function AttachmentsView({ items, thumb = 84 }: { items: TaskAttachment[]; thumb?: number }) {
  const images = items.filter((a) => a.kind === "image");
  const others = items.filter((a) => a.kind !== "image");
  if (items.length === 0) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {images.length > 0 && (
        <Image.PreviewGroup>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {images.map((a) => (
              <Image
                key={a.id}
                src={a.url}
                alt={a.name}
                width={thumb}
                height={thumb}
                style={{ objectFit: "cover", borderRadius: 10, border: "1px solid #E5E9EF" }}
              />
            ))}
          </div>
        </Image.PreviewGroup>
      )}
      {others.map((a) => (
        <a
          key={a.id}
          href={a.url}
          target="_blank"
          rel="noopener noreferrer"
          download={a.kind === "file" ? a.name : undefined}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "7px 10px",
            border: "1px solid #E5E9EF",
            borderRadius: 10,
            background: "#fff",
            color: "inherit",
          }}
        >
          <span
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              display: "grid",
              placeItems: "center",
              background: a.kind === "link" ? "#E6F7F9" : "#F1F3F6",
              color: a.kind === "link" ? "#1F879B" : "#6B7280",
              flexShrink: 0,
            }}
          >
            {a.kind === "link" ? <LinkOutlined /> : <FileOutlined />}
          </span>
          <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 500 }}>
            {a.name}
          </span>
          <Text type="secondary" style={{ fontSize: 12, flexShrink: 0 }}>
            {a.kind === "link" ? hostOf(a.url) : formatSize(a.size)}
          </Text>
        </a>
      ))}
    </div>
  );
}
