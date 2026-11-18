"use client";

import { AntdRegistry } from "@ant-design/nextjs-registry";
import { ConfigProvider, App as AntdApp } from "antd";
import NextTopLoader from "nextjs-toploader";
import type { ReactNode } from "react";
import AppSplash from "@/components/layout/AppSplash";
import { ActingUserProvider } from "@/lib/acting-user";
import { AuditProvider } from "@/lib/audit-store";
import { CommentProvider } from "@/lib/comment-store";
import { LibraryProvider } from "@/lib/library-store";
import { MasterStoreProvider } from "@/lib/master-store";
import { MeetingProvider } from "@/lib/meeting-store";
import { NotificationProvider } from "@/lib/notification-store";
import { ProjectStructureProvider } from "@/lib/project-structure";
import { TaskStoreProvider } from "@/lib/task-store";
import { TestStoreProvider } from "@/lib/test-store";
import { UserStoreProvider } from "@/lib/user-store";

// AGI brand palette (Bank Artha Graha Internasional) — sky-blue/teal family,
// taken from the org's own Tailwind tokens (agi-50 .. agi-950). Deliberately
// not a generic indigo-admin palette: primary and dark-surface both come
// from the same hue family so the whole shell reads as one brand, not a
// template with an accent color dropped in.
export const agi = {
  50: "#effcfc",
  100: "#d5f6f8",
  200: "#b1ecf0",
  300: "#7bdde5",
  400: "#35c1d0",
  500: "#22a7b8",
  600: "#1f879b",
  700: "#206d7e",
  800: "#225968",
  900: "#214b58",
  950: "#10313c",
};

const theme = {
  token: {
    colorPrimary: agi[400],
    colorLink: agi[500],
    colorInfo: agi[500],
    colorSuccess: "#17C653",
    colorWarning: "#F6B100",
    colorError: "#F8285A",
    borderRadius: 10,
    fontFamily:
      "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    colorBgLayout: "#F3FAFB",
  },
  components: {
    Layout: {
      siderBg: agi[950],
      headerBg: "#FFFFFF",
    },
    Menu: {
      darkItemBg: agi[950],
      darkItemSelectedBg: agi[600],
      darkSubMenuItemBg: "#0C2830",
      darkItemHoverBg: "#16404C",
    },
    Card: {
      boxShadowTertiary: "0 1px 2px rgba(16,49,60,0.06), 0 6px 16px rgba(16,49,60,0.05)",
    },
  },
};

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <AntdRegistry>
      <ConfigProvider theme={theme}>
        <AntdApp>
          <AppSplash />
          <NextTopLoader color={agi[400]} showSpinner={false} height={3} />
          {/* Urutan penting: provider yang dipakai provider lain harus berada di luarnya.
              Acting -> Audit -> User & ProjectStructure -> Notification -> Master -> Task -> Comment & Meeting -> Library */}
          <ActingUserProvider>
            <AuditProvider>
              <UserStoreProvider>
                <ProjectStructureProvider>
                  <NotificationProvider>
                  <MasterStoreProvider>
                    <TaskStoreProvider>
                      <CommentProvider>
                        <MeetingProvider>
                          <TestStoreProvider>
                            <LibraryProvider>{children}</LibraryProvider>
                          </TestStoreProvider>
                        </MeetingProvider>
                      </CommentProvider>
                    </TaskStoreProvider>
                  </MasterStoreProvider>
                  </NotificationProvider>
                </ProjectStructureProvider>
              </UserStoreProvider>
            </AuditProvider>
          </ActingUserProvider>
        </AntdApp>
      </ConfigProvider>
    </AntdRegistry>
  );
}
