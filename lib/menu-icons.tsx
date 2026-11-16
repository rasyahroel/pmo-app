"use client";

import type { ReactNode } from "react";
import {
  DashboardOutlined,
  ProjectOutlined,
  TeamOutlined,
  CalendarOutlined,
  FieldTimeOutlined,
  ExperimentOutlined,
  BarChartOutlined,
  HistoryOutlined,
  BookOutlined,
  DatabaseOutlined,
  UserSwitchOutlined,
} from "@ant-design/icons";

export const MENU_ICONS: Record<string, ReactNode> = {
  dashboard: <DashboardOutlined />,
  projects: <ProjectOutlined />,
  tasks: <TeamOutlined />,
  meetings: <CalendarOutlined />,
  timeline: <FieldTimeOutlined />,
  testing: <ExperimentOutlined />,
  reports: <BarChartOutlined />,
  "audit-trail": <HistoryOutlined />,
  library: <BookOutlined />,
  "master-data": <DatabaseOutlined />,
  "user-management": <UserSwitchOutlined />,
};
