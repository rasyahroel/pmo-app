"use client";

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore, type ReactNode } from "react";
import type { AppUser } from "@/lib/mock-data";
import { adminUser } from "@/lib/access";
import { SESSION_HOURS, SESSION_REMEMBER_DAYS } from "@/lib/auth-config";

// "Pengguna aktif" + sesi login. Belum ada backend, jadi sesi disimpan di browser (localStorage):
//  - pmo.session     = { userId, mustChange, remember, expiresAt }  <- pengganti cookie sesi httpOnly
//  - pmo.acting-user = salinan AppUser yang sedang dipakai          <- pengganti GET /auth/me
// Setelah backend jadi, kedua kunci dihapus: sesi = cookie httpOnly, pengguna = GET /auth/me.
// `switchTo` (menu "Simulasi masuk sebagai") hanya alat uji dan dihapus bersama itu.
const KEY = "pmo.acting-user";
const SKEY = "pmo.session";
const EVENT = "pmo-acting-user";

export type Session = { userId: string; mustChange: boolean; remember: boolean; expiresAt: number };

const subscribe = (cb: () => void) => {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
};
const readUser = () => {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
};
// Sesi yang sudah lewat masa berlakunya dianggap tidak ada.
const readSession = () => {
  try {
    const raw = window.localStorage.getItem(SKEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Session;
    return s.expiresAt > Date.now() ? raw : null;
  } catch {
    return null;
  }
};
const put = (k: string, v: string | null) => {
  try {
    if (v === null) window.localStorage.removeItem(k);
    else window.localStorage.setItem(k, v);
  } catch {
    /* private mode: abaikan, sesi tetap jalan sampai halaman dimuat ulang */
  }
};
const emit = () => window.dispatchEvent(new Event(EVENT));
const noop = () => () => undefined;

type Ctx = {
  user: AppUser;
  session: Session | null;
  signIn: (u: AppUser, o: { mustChange: boolean; remember: boolean }) => void;
  signOut: () => void;
  clearMustChange: () => void;
  switchTo: (u: AppUser) => void;
  /** perbarui salinan bila akun yang sedang dipakai diubah di Manajemen User */
  sync: (all: AppUser[]) => void;
};
const ActingCtx = createContext<Ctx | null>(null);

export function ActingUserProvider({ children }: { children: ReactNode }) {
  const rawUser = useSyncExternalStore(subscribe, readUser, () => null);
  const rawSession = useSyncExternalStore(subscribe, readSession, () => null);
  const user = useMemo<AppUser>(() => {
    if (!rawUser) return adminUser;
    try {
      return JSON.parse(rawUser) as AppUser;
    } catch {
      return adminUser;
    }
  }, [rawUser]);
  const session = useMemo<Session | null>(() => {
    if (!rawSession) return null;
    try {
      return JSON.parse(rawSession) as Session;
    } catch {
      return null;
    }
  }, [rawSession]);

  const signIn = useCallback<Ctx["signIn"]>((u, o) => {
    const ms = o.remember ? SESSION_REMEMBER_DAYS * 24 * 3600_000 : SESSION_HOURS * 3600_000;
    const s: Session = { userId: u.id, mustChange: o.mustChange, remember: o.remember, expiresAt: Date.now() + ms };
    put(KEY, JSON.stringify(u));
    put(SKEY, JSON.stringify(s));
    emit();
  }, []);
  const signOut = useCallback(() => {
    put(KEY, null);
    put(SKEY, null);
    emit();
  }, []);
  const clearMustChange = useCallback(() => {
    if (!session) return;
    put(SKEY, JSON.stringify({ ...session, mustChange: false }));
    emit();
  }, [session]);
  const switchTo = useCallback(
    (u: AppUser) => {
      put(KEY, JSON.stringify(u));
      if (session) put(SKEY, JSON.stringify({ ...session, userId: u.id, mustChange: false }));
      emit();
    },
    [session],
  );
  const sync = useCallback(
    (all: AppUser[]) => {
      const fresh = all.find((u) => u.id === user.id);
      if (fresh && JSON.stringify(fresh) !== JSON.stringify(user)) {
        put(KEY, JSON.stringify(fresh));
        emit();
      }
    },
    [user],
  );
  const value = useMemo(() => ({ user, session, signIn, signOut, clearMustChange, switchTo, sync }), [user, session, signIn, signOut, clearMustChange, switchTo, sync]);
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
/** Sesi login. `session === null` = belum masuk. */
export const useSession = () => {
  const { session, signIn, signOut, clearMustChange } = useActing();
  return { session, signIn, signOut, clearMustChange };
};
/** false saat render server dan render pertama di browser; true setelah hidrasi (aman untuk mengecek sesi). */
export const useHydrated = (): boolean => useSyncExternalStore(noop, () => true, () => false);
