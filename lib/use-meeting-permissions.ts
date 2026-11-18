"use client";

import { useMemo } from "react";
import { useCurrentUser } from "@/lib/acting-user";
import { projects } from "@/lib/mock-data";
import { useProjectStructure } from "@/lib/project-structure";
import { canCreateMeeting, canManageMeeting } from "@/lib/meeting-permissions";
import { canManageProject } from "@/lib/task-permissions";
import type { MeetingRecord } from "@/lib/meeting-store";

/** Hak akses rapat untuk pengguna yang sedang login (untuk menyembunyikan/menonaktifkan aksi di UI). */
export function useMeetingPermissions() {
  const currentUser = useCurrentUser();
  const { pmoOf } = useProjectStructure();
  return useMemo(
    () => ({
      canCreateIn: (projectId: string) => canCreateMeeting(currentUser, projectId, pmoOf),
      canCreateAny: projects.some((p) => canManageProject(currentUser, p.id, pmoOf)),
      canManage: (m: MeetingRecord) => canManageMeeting(currentUser, m, pmoOf),
    }),
    [pmoOf, currentUser],
  );
}
