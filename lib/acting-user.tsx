"use client";

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore, type ReactNode } from "react";
import type { AppUser } from "@/lib/mock-data";
import { adminUser } from "@/lib/access";

// "Pengguna aktif" — siapa yang sedang memakai aplikasi. Belum ada login, jadi ini SIMULASI: menu
// pengguna di header punya "Simulasi masuk sebagai ..." agar PMO bisa melihat tampilan tiap role
// (menu, dashboard, hak akses, notifikasi). Pilihan disimpan di browser (localStorage) supaya tidak
// kembali ke awal tiap halaman dimuat ulang. Setelah login jadi, provider ini diganti dengan
// pengguna dari sesi (GET /me) dan `switchTo` dihapus.
const KEY = "pmo.acting-user";
const EVENT = "pmo-acting-user";

const subscribe = (cb: () => void) => {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
};
const read = () => {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
};
const write = (u: AppUser) => {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(u));
  } catch {
    /* private mode: abaikan, simulasi tetap jalan sampai halaman dimuat ulang */
  }
  window.dispatchEvent(new Event(EVENT));
};

type Ctx = {
  user: AppUser;
  switchTo: (u: AppUser) => void;
  /** perbarui salinan bila akun yang sedang dipakai diubah di Manajemen User */
  sync: (all: AppUser[]) => void;
};
const ActingCtx = createContext<Ctx | null>(null);

export function ActingUserProvider({ children }: { children: ReactNode }) {
  const raw = useSyncExternalStore(subscribe, read, () => null);
  const user = useMemo<AppUser>(() => {
    if (!raw) return adminUser;
    try {
      return JSON.parse(raw) as AppUser;
    } catch {
      return adminUser;
    }
  }, [raw]);
  const switchTo = useCallback((u: AppUser) => write(u), []);
  const sync = useCallback(
    (all: AppUser[]) => {
      const fresh = all.find((u) => u.id === user.id);
      if (fresh && JSON.stringify(fresh) !== JSON.stringify(user)) write(fresh);
    },
    [user],
  );
  const value = useMemo(() => ({ user, switchTo, sync }), [user, switchTo, sync]);
  return <ActingCtx.Provider value={value}>{children}</ActingCtx.Provider>;
}

function useActing(): Ctx {
  const v = useContext(ActingCtx);
  if (!v) throw new Error("useCurrentUser harus dipakai di dalam <ActingUserProvider>");
  return v;
}

/** Pengguna yang sedang memakai aplikasi (akun, role, direktorat). */
export const useCurrentUser = (): AppUser => useActing().user;
export const useActingUserControls = () => {
  const { switchTo, sync } = useActing();
  return { switchTo, sync };
};
