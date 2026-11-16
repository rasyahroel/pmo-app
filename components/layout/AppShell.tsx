"use client";

import { useMemo, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Layout, Menu, Badge, Avatar, Dropdown, Typography, Breadcrumb } from "antd";
import { AnimatePresence, motion } from "framer-motion";
import {
  BellOutlined,
  UserOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from "@ant-design/icons";
import { MENU_CONFIG, findMenuByPath } from "@/lib/menu-config";
import { MENU_ICONS } from "@/lib/menu-icons";
import { agi } from "@/app/providers";
import type { MenuProps } from "antd";

const { Sider, Header, Content } = Layout;

// Halaman yang tampil tanpa sidebar/header (belum masuk / sesi habis).
const STANDALONE_PATHS = ["/login", "/401"];
const { Text } = Typography;

function toAntdMenuItems(): MenuProps["items"] {
  return MENU_CONFIG.map((node) => {
    if (node.children) {
      return {
        key: node.path,
        icon: MENU_ICONS[node.key],
        label: node.label,
        children: node.children.map((child) => ({
          key: child.path,
          label: child.label,
        })),
      };
    }
    return { key: node.path, icon: MENU_ICONS[node.key], label: node.label };
  });
}

export default function AppShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const menuItems = useMemo(() => toAntdMenuItems(), []);
  if (STANDALONE_PATHS.includes(pathname)) return <>{children}</>;
  const current = findMenuByPath(pathname);
  const openKey = MENU_CONFIG.find((n) =>
    n.children?.some((c) => c.path === pathname)
  )?.path;

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider collapsible collapsed={collapsed} trigger={null} width={252} theme="dark">
        <div
          style={{
            height: 64,
            display: "flex",
            alignItems: "center",
            gap: 10,
            justifyContent: collapsed ? "center" : "flex-start",
            padding: collapsed ? 0 : "0 18px",
            borderBottom: `1px solid ${agi[800]}55`,
          }}
        >
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 9,
              background: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              overflow: "hidden",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/favicon.ico" alt="Logo" width={22} height={22} />
          </div>
          {!collapsed && (
            <div style={{ lineHeight: 1.15 }}>
              <div style={{ color: "#fff", fontWeight: 700, fontSize: 14.5 }}>
                Project Management
              </div>
              <div style={{ color: agi[300], fontSize: 11, letterSpacing: 0.3 }}>
                PMO Internal
              </div>
            </div>
          )}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[pathname]}
          defaultOpenKeys={openKey ? [openKey] : []}
          items={menuItems}
          onClick={({ key }) => router.push(key)}
          style={{ borderInlineEnd: "none", paddingTop: 10 }}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 20px",
            borderBottom: `2px solid ${agi[100]}`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {collapsed ? (
              <MenuUnfoldOutlined onClick={() => setCollapsed(false)} style={{ color: agi[600] }} />
            ) : (
              <MenuFoldOutlined onClick={() => setCollapsed(true)} style={{ color: agi[600] }} />
            )}
            <Breadcrumb items={[{ title: "PMO" }, { title: current?.label ?? "" }]} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <Badge count={3} size="small" color={agi[500]}>
              <BellOutlined style={{ fontSize: 18, color: agi[600] }} />
            </Badge>
            <Dropdown
              menu={{
                items: [
                  { key: "profile", label: "Profil" },
                  { key: "logout", label: "Keluar" },
                ],
                onClick: ({ key }) => {
                  if (key === "logout") router.push("/login");
                },
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <Avatar size="small" style={{ background: agi[500] }} icon={<UserOutlined />} />
                <Text style={{ fontSize: 13 }}>Rani Kusuma</Text>
              </div>
            </Dropdown>
          </div>
        </Header>
        <Content style={{ padding: 24 }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </Content>
      </Layout>
    </Layout>
  );
}
