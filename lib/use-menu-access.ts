"use client";

import { useMemo } from "react";
import { menuKeyOfPath } from "@/lib/menu-config";
import { useCurrentUser } from "@/lib/acting-user";
import { permissionsOf, useUserStore, type PermKey } from "@/lib/user-store";

/** Hak menu pengguna aktif dari matriks Role & Permission (gabungan semua rolenya). */
export function useMenuAccess() {
  const user = useCurrentUser();
  const { roles } = useUserStore();
  return useMemo(() => {
    const perms = permissionsOf(user, roles);
    const can = (menuKey: string | undefined, k: PermKey = "view") => (menuKey && perms[menuKey] ? perms[menuKey][k] : true);
    return {
      can,
      canViewPath: (path: string) => can(menuKeyOfPath(path), "view"),
      canDoInPath: (path: string, k: PermKey) => can(menuKeyOfPath(path), k),
    };
  }, [user, roles]);
}
