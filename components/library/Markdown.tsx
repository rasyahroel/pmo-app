"use client";

import { Fragment, useMemo, useState, type ReactNode } from "react";
import { Button, Tooltip, Typography } from "antd";
import { CheckOutlined, CopyOutlined } from "@ant-design/icons";

const { Text } = Typography;

// Renderer markdown sederhana (tanpa library tambahan, tanpa dangerouslySetInnerHTML — semua teks
// dirender lewat React sehingga aman dari injeksi HTML). Yang didukung:
//   # / ## / ### judul · paragraf · - / * daftar · 1. daftar bernomor · ``` blok kode ```
//   | tabel | · > kutipan/catatan · --- garis · **tebal** · *miring* · `kode` · [teks](url)
// Link hanya http(s) atau path internal (/...).

type Block =
  | { t: "h"; level: 1 | 2 | 3; text: string; id: string }
  | { t: "p"; text: string }
  | { t: "ul"; items: string[] }
  | { t: "ol"; items: string[] }
  | { t: "code"; lang: string; code: string }
  | { t: "table"; head: string[]; rows: string[][] }
  | { t: "quote"; text: string }
  | { t: "hr" };

export type Heading = { id: string; text: string; level: 1 | 2 | 3 };

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 60);

const splitRow = (line: string) =>
  line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());

function parse(src: string): Block[] {
  const lines = src.replace(/\r\n/g, "\n").split("\n");
  const out: Block[] = [];
  const used = new Map<string, number>();
  let i = 0;

  const uniqueId = (text: string) => {
    const base = slugify(text) || "bagian";
    const n = used.get(base) ?? 0;
    used.set(base, n + 1);
    return n === 0 ? base : `${base}-${n}`;
  };

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }

    const fence = line.match(/^```(\w*)\s*$/);
    if (fence) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) code.push(lines[i++]);
      i++; // tutup fence
      out.push({ t: "code", lang: fence[1], code: code.join("\n") });
      continue;
    }

    const h = line.match(/^(#{1,3})\s+(.+)$/);
    if (h) {
      const text = h[2].trim();
      out.push({ t: "h", level: h[1].length as 1 | 2 | 3, text, id: uniqueId(text) });
      i++;
      continue;
    }

    if (/^---+\s*$/.test(line)) {
      out.push({ t: "hr" });
      i++;
      continue;
    }

    if (line.trim().startsWith("|") && i + 1 < lines.length && /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(lines[i + 1])) {
      const head = splitRow(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) rows.push(splitRow(lines[i++]));
      out.push({ t: "table", head, rows });
      continue;
    }

    if (/^>\s?/.test(line)) {
      const q: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) q.push(lines[i++].replace(/^>\s?/, ""));
      out.push({ t: "quote", text: q.join(" ") });
      continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*[-*]\s+/, ""));
      out.push({ t: "ul", items });
      continue;
    }

    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*\d+[.)]\s+/, ""));
      out.push({ t: "ol", items });
      continue;
    }

    // paragraf: gabungkan baris berurutan sampai ketemu pemisah blok
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{1,3}\s|```|>\s?|\s*[-*]\s+|\s*\d+[.)]\s+|---+\s*$|\s*\|)/.test(lines[i])
    ) {
      para.push(lines[i++].trim());
    }
    if (para.length === 0) {
      para.push(lines[i++].trim());
    }
    out.push({ t: "p", text: para.join(" ") });
  }
  return out;
}

export function extractHeadings(src: string): Heading[] {
  return parse(src)
    .filter((b): b is Extract<Block, { t: "h" }> => b.t === "h")
    .map((b) => ({ id: b.id, text: b.text, level: b.level }));
}

const safeHref = (url: string) => (/^(https?:\/\/|\/)/i.test(url) ? url : undefined);

function inline(text: string, keyPrefix = "i"): ReactNode[] {
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\)|\*[^*\s][^*]*\*)/g;
  const parts = text.split(re).filter((p) => p !== "");
  return parts.map((p, idx) => {
    const key = `${keyPrefix}-${idx}`;
    if (p.startsWith("**") && p.endsWith("**")) return <strong key={key}>{p.slice(2, -2)}</strong>;
    if (p.startsWith("`") && p.endsWith("`")) return <Text code key={key}>{p.slice(1, -1)}</Text>;
    const link = p.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link) {
      const href = safeHref(link[2]);
      return href ? (
        <a key={key} href={href} target={href.startsWith("/") ? undefined : "_blank"} rel="noopener noreferrer">
          {link[1]}
        </a>
      ) : (
        <Fragment key={key}>{link[1]}</Fragment>
      );
    }
    if (p.startsWith("*") && p.endsWith("*") && p.length > 2) return <em key={key}>{p.slice(1, -1)}</em>;
    return <Fragment key={key}>{p}</Fragment>;
  });
}

function CodeBlock({ lang, code }: { lang: string; code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div style={{ position: "relative", margin: "12px 0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#1E2A32", color: "#9FB3BF", fontSize: 11, padding: "4px 10px", borderRadius: "8px 8px 0 0" }}>
        <span>{lang || "teks"}</span>
        <Tooltip title={copied ? "Tersalin" : "Salin"}>
          <Button
            size="small"
            type="text"
            icon={copied ? <CheckOutlined /> : <CopyOutlined />}
            aria-label="Salin kode"
            style={{ color: "#9FB3BF" }}
            onClick={() => {
              navigator.clipboard?.writeText(code).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              });
            }}
          />
        </Tooltip>
      </div>
      <pre style={{ margin: 0, padding: "12px 14px", background: "#14202A", color: "#E6EEF2", fontSize: 12.5, lineHeight: 1.55, overflowX: "auto", borderRadius: "0 0 8px 8px" }}>
        <code>{code}</code>
      </pre>
    </div>
  );
}

export default function Markdown({ source }: { source: string }) {
  const blocks = useMemo(() => parse(source), [source]);

  return (
    <div style={{ lineHeight: 1.8, fontSize: 15, color: "#1F2937", wordBreak: "break-word" }}>
      {blocks.map((b, idx) => {
        const key = `b${idx}`;
        switch (b.t) {
          case "h": {
            const size = b.level === 1 ? 24 : b.level === 2 ? 19 : 16;
            return (
              <div
                key={key}
                id={b.id}
                style={{
                  fontSize: size,
                  fontWeight: 600,
                  margin: b.level === 1 ? "4px 0 12px" : "26px 0 8px",
                  paddingBottom: b.level === 2 ? 6 : 0,
                  borderBottom: b.level === 2 ? "1px solid #E5E9EF" : undefined,
                  scrollMarginTop: 80,
                }}
              >
                {inline(b.text, key)}
              </div>
            );
          }
          case "p":
            return (
              <p key={key} style={{ margin: "8px 0" }}>
                {inline(b.text, key)}
              </p>
            );
          case "ul":
            return (
              <ul key={key} style={{ margin: "8px 0", paddingInlineStart: 22 }}>
                {b.items.map((it, j) => (
                  <li key={j} style={{ margin: "3px 0" }}>
                    {inline(it, `${key}-${j}`)}
                  </li>
                ))}
              </ul>
            );
          case "ol":
            return (
              <ol key={key} style={{ margin: "8px 0", paddingInlineStart: 24 }}>
                {b.items.map((it, j) => (
                  <li key={j} style={{ margin: "3px 0" }}>
                    {inline(it, `${key}-${j}`)}
                  </li>
                ))}
              </ol>
            );
          case "code":
            return <CodeBlock key={key} lang={b.lang} code={b.code} />;
          case "table":
            return (
              <div key={key} style={{ overflowX: "auto", margin: "12px 0" }}>
                <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 14 }}>
                  <thead>
                    <tr>
                      {b.head.map((h, j) => (
                        <th key={j} style={{ textAlign: "left", padding: "7px 10px", background: "#F3F7F9", border: "1px solid #E5E9EF", whiteSpace: "nowrap" }}>
                          {inline(h, `${key}h${j}`)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {b.rows.map((r, j) => (
                      <tr key={j}>
                        {r.map((c, k) => (
                          <td key={k} style={{ padding: "7px 10px", border: "1px solid #E5E9EF", verticalAlign: "top" }}>
                            {inline(c, `${key}r${j}c${k}`)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          case "quote":
            return (
              <div
                key={key}
                style={{ margin: "16px 0", padding: "12px 16px", borderLeft: "4px solid #22A7B8", background: "#EEF8FA", borderRadius: "0 10px 10px 0" }}
              >
                {inline(b.text, key)}
              </div>
            );
          case "hr":
            return <hr key={key} style={{ border: 0, borderTop: "1px solid #E5E9EF", margin: "18px 0" }} />;
        }
      })}
    </div>
  );
}
