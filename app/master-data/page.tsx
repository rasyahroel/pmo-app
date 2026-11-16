"use client";

import { Tabs } from "antd";
import PageSkeleton from "@/components/layout/PageSkeleton";
import SimpleListCrud from "@/components/master-data/SimpleListCrud";
import DocTypesCrud from "@/components/master-data/DocTypesCrud";
import TestTypesCrud from "@/components/master-data/TestTypesCrud";
import SubditCrud from "@/components/master-data/SubditCrud";
import EmployeesCrud from "@/components/master-data/EmployeesCrud";
import TaskStatusesCrud from "@/components/master-data/TaskStatusesCrud";
import TaskCategoriesCrud from "@/components/master-data/TaskCategoriesCrud";
import MeetingCategoriesCrud from "@/components/master-data/MeetingCategoriesCrud";
import MeetingStatusesCrud from "@/components/master-data/MeetingStatusesCrud";
import {
  masterDocumentTypes,
  masterTestTypes,
  masterApprovalLevels,
  masterProjectRoles,
  masterDirektorat,
  masterSubdit,
  masterVendors,
  masterProjectCategories,
  masterProjectPriorities,
  masterDependencySystems,
  employees,
} from "@/lib/mock-data";

export default function MasterDataPage() {
  return (
    <PageSkeleton path="/master-data">
      <Tabs
        items={[
          {
            key: "doc-types",
            label: "Jenis Dokumen",
            children: <DocTypesCrud initialItems={masterDocumentTypes} />,
          },
          {
            key: "test-types",
            label: "Jenis Testing",
            children: <TestTypesCrud initialItems={masterTestTypes} />,
          },
          {
            key: "approval-levels",
            label: "Level Approval",
            children: <SimpleListCrud initialItems={masterApprovalLevels} itemLabel="Level Approval" />,
          },
          {
            key: "direktorat",
            label: "Direktorat",
            children: <SimpleListCrud initialItems={masterDirektorat} itemLabel="Direktorat" />,
          },
          {
            key: "subdit",
            label: "Subdit",
            children: <SubditCrud initialItems={masterSubdit} directorateOptions={masterDirektorat} />,
          },
          {
            key: "project-roles",
            label: "Role Project",
            children: <SimpleListCrud initialItems={masterProjectRoles} itemLabel="Role Project" />,
          },
          {
            key: "employees",
            label: "Master Pegawai",
            children: <EmployeesCrud initialItems={employees} directorateOptions={masterDirektorat} roleOptions={masterProjectRoles} />,
          },
          {
            key: "task-categories",
            label: "Kategori Task",
            children: <TaskCategoriesCrud />,
          },
          {
            key: "task-statuses",
            label: "Status Task",
            children: <TaskStatusesCrud />,
          },
          {
            key: "meeting-categories",
            label: "Kategori Rapat",
            children: <MeetingCategoriesCrud />,
          },
          {
            key: "meeting-statuses",
            label: "Status Rapat",
            children: <MeetingStatusesCrud />,
          },
          {
            key: "vendors",
            label: "Master Vendor",
            children: <SimpleListCrud initialItems={masterVendors} itemLabel="Vendor" />,
          },
          {
            key: "project-categories",
            label: "Kategori Project",
            children: <SimpleListCrud initialItems={masterProjectCategories} itemLabel="Kategori Project" />,
          },
          {
            key: "project-priorities",
            label: "Priority Project",
            children: <SimpleListCrud initialItems={masterProjectPriorities} itemLabel="Priority Project" />,
          },
          {
            key: "dependency-systems",
            label: "Sistem Dependency",
            children: <SimpleListCrud initialItems={masterDependencySystems} itemLabel="Sistem Dependency" />,
          },
        ]}
      />
    </PageSkeleton>
  );
}
