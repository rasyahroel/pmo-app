"use client";

import { useMemo, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { App, Layout, Menu, Avatar, Dropdown, Tag, Typography, Breadcrumb } from "antd";
import { AnimatePresence, motion } from "framer-motion";
import {
  CheckOutlined,
  UserOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from "@ant-design/icons";
import { MENU_CONFIG, findMenuByPath } from "@/lib/menu-config";
import { MENU_ICONS } from "@/lib/menu-icons";
import { agi } from "@/app/providers";
import type { MenuProps } from "antd";
import NotificationBell from "@/components/notifications/NotificationBell";
import { useActingUserControls, useCurrentUser } from "@/lib/acting-user";
import { useMenuAccess } from "@/lib/use-menu-access";
import { useUserStore } from "@/lib/user-store";

const { Sider, Header, Content } = Layout;

// Halaman yang tampil tanpa sidebar/header (belum masuk / sesi habis).
const STANDALONE_PATHS = ["/login", "/401"];
const { Text } = Typography;

function toAntdMenuItems(canView: (menuKey: string) => boolean): MenuProps["items"] {
  // Menu yang rolenya tidak punya hak Lihat disembunyikan (matriks Role & Permission).
  return MENU_CONFIG.filter((node) => canView(node.key)).map((node) => {
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

  const access = useMenuAccess();
  const me = useCurrentUser();
  const { switchTo } = useActingUserControls();
  const { users } = useUserStore();
  const { message } = App.useApp();
  const menuItems = useMemo(() => toAntdMenuItems((k) => !!access.can(k)), [access]);
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
            <NotificationBell />
            <Dropdown
              trigger={["click"]}
              menu={{
                items: [
                  { key: "profile", label: "Profil", disabled: true },
                  { type: "divider" },
                  {
                    type: "group",
                    label: "Simulasi masuk sebagai (belum ada login)",
                    children: users
                      .filter((u) => u.active)
                      .map((u) => ({
                        key: `as:${u.id}`,
                        icon: u.id === me.id ? <CheckOutlined /> : undefined,
                        label: (
                          <span>
                            {u.name} <span style={{ color: "#8A90A2", fontSize: 12 }}>· {u.roles.join(", ")}</span>
                          </span>
                        ),
                      })),
                  },
                  { type: "divider" },
                  { key: "logout", label: "Keluar" },
                ],
                onClick: ({ key }) => {
                  if (key === "logout") router.push("/login");
                  if (key.startsWith("as:")) {
                    const u = users.find((x) => `as:${x.id}` === key);
                    if (u) {
                      switchTo(u);
                      message.success(`Sekarang sebagai ${u.name} (${u.roles.join(", ")}).`);
                    }
                  }
                },
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }} aria-label="Menu pengguna">
                <Avatar size="small" style={{ background: agi[500] }} icon={<UserOutlined />} />
                <Text style={{ fontSize: 13 }}>{me.name}</Text>
                <Tag color={agi[100]} style={{ marginInlineEnd: 0, color: agi[800], border: 0 }}>{me.roles[0]}</Tag>
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
