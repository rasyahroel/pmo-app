"use client";

import { useMemo } from "react";
import type { Task } from "@/lib/mock-data";
import { currentUser } from "@/lib/access";
import { useProjectStructure } from "@/lib/project-structure";
import { useTaskStore } from "@/lib/task-store";
import {
  canCommentOnTask,
  canCreateAnywhere,
  canCreateTask,
  canDeleteComment,
  canManageProject,
  canReviewTask,
  canUpdateTask,
  isCommentOwner,
  isTaskPic,
} from "@/lib/task-permissions";

// Hak akses pengguna yang sedang login, terikat ke data task & PMO terkini — dipakai komponen
// untuk menyembunyikan/menonaktifkan aksi. Penegakan sebenarnya ada di store (dan nanti backend).
export function useTaskPermissions() {
  const { tasks } = useTaskStore();
  const { pmoOf } = useProjectStructure();
  return useMemo(
    () => ({
      user: currentUser,
      /** ubah / pindah status / hapus task atau sub task */
      canUpdate: (t: Task) => canUpdateTask(currentUser, t, tasks, pmoOf),
      canReview: (t: Task) => canReviewTask(currentUser, t, pmoOf),
      canManage: (projectId: string) => canManageProject(currentUser, projectId, pmoOf),
      /** buat task induk di project ini */
      canCreateIn: (projectId: string) => canCreateTask(currentUser, projectId, undefined, tasks, pmoOf),
      canCreateSub: (parent: Task) => canCreateTask(currentUser, parent.projectId, parent, tasks, pmoOf),
      canCreateAny: canCreateAnywhere(currentUser, pmoOf),
      canComment: (t: Task) => canCommentOnTask(currentUser, t, tasks, pmoOf),
      isCommentOwner: (author: string) => isCommentOwner(currentUser, author),
      canDeleteComment: (author: string, t: Task) => canDeleteComment(currentUser, author, t, pmoOf),
      isPic: (t: Task) => isTaskPic(currentUser, t, tasks),
    }),
    [tasks, pmoOf],
  );
}
