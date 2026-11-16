"use client";

import { Typography, Empty, Card } from "antd";
import type { ReactNode } from "react";
import { findMenuByPath } from "@/lib/menu-config";
import { agi } from "@/app/providers";

const { Title, Paragraph } = Typography;

export default function PageSkeleton({
  path,
  children,
  emptyHint,
}: {
  path: string;
  children?: ReactNode;
  emptyHint?: string;
}) {
  const menu = findMenuByPath(path);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 4 }}>
        <div
          style={{
            width: 4,
            height: 22,
            marginTop: 6,
            borderRadius: 2,
            background: `linear-gradient(180deg, ${agi[300]}, ${agi[500]})`,
            flexShrink: 0,
          }}
        />
        <Title level={3} style={{ margin: 0 }}>
          {menu?.label}
        </Title>
      </div>
      <Paragraph type="secondary" style={{ marginBottom: 24, marginLeft: 14, maxWidth: 640 }}>
        {menu?.description}
      </Paragraph>

      {children ?? (
        <Card>
          <Empty
            description={
              emptyHint ??
              "Halaman ini masih kosong — akan diisi pada iterasi berikutnya."
            }
          />
        </Card>
      )}
    </div>
  );
}
