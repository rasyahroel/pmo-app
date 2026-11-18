"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import dayjs from "dayjs";
import type { AppUser } from "@/lib/mock-data";
import { useCurrentUser, useSession } from "@/lib/acting-user";
import { ADMIN_ROLE, useUserStore, type Result } from "@/lib/user-store";
import { useNotify } from "@/lib/notification-store";
import { INITIAL_PASSWORD, LOCK_MINUTES, MAX_FAILED_LOGIN, RESET_TOKEN_MINUTES } from "@/lib/auth-config";
import { checkPassword, isStrong } from "@/lib/password-policy";

// Autentikasi versi uji: kredensial disimpan di MEMORI (hilang saat halaman dimuat ulang) dan HANYA
// untuk peragaan alur. Backend Go menggantikan seluruh isi file ini: password di-hash (argon2id/bcrypt),
// sesi berupa cookie httpOnly, token reset dikirim lewat email, percobaan gagal dihitung di server.
// Aturan di sini (kebijakan password, kunci akun, token sekali pakai, ganti password wajib) harus diulang di server.

type Cred = { password: string; mustChange: boolean; changedAt?: string; failed: number; lockedUntil?: number };
type ResetToken = { token: string; userId: string; expiresAt: number; used: boolean };
export type LoginResult = { ok: true; user: AppUser; mustChange: boolean } | { ok: false; code: "invalid" | "locked" | "pending" | "inactive"; reason: string };
export type ResetStatus = "valid" | "expired" | "used" | "invalid";

export type RegisterInput = { name: string; username: string; email: string; directorate: string; subdirectorate: string; password: string };

type AuthStore = {
  login: (identifier: string, password: string, remember: boolean) => LoginResult;
  register: (input: RegisterInput) => Result<{ id: string }>;
  /** Selalu "berhasil" (tidak membocorkan apakah akun ada). `demoToken` hanya terisi di versi uji karena belum ada email. */
  requestReset: (identifier: string) => { demoToken?: string; expiresAt?: string };
  checkResetToken: (token: string) => ResetStatus;
  resetPassword: (token: string, next: string) => Result;
  /** `current` null = ganti password wajib saat login pertama (sudah terautentikasi, tidak perlu mengulang password lama). */
  changePassword: (userId: string, current: string | null, next: string) => Result;
  /** Administrator mengatur ulang password akun lain; hasilnya password sementara + wajib ganti saat login. */
  adminResetPassword: (userId: string) => Result<{ tempPassword: string }>;
  passwordChangedAt: (userId: string) => string | undefined;
};

const Ctx = createContext<AuthStore | null>(null);
const norm = (s: string) => s.trim().toLowerCase();
const fail = (reason: string) => ({ ok: false as const, reason });
const fresh = (): Cred => ({ password: INITIAL_PASSWORD, mustChange: true, failed: 0 });
const randomToken = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID().replace(/-/g, "") : Math.random().toString(36).slice(2) + Date.now().toString(36));

export function AuthProvider({ children }: { children: ReactNode }) {
  const me = useCurrentUser();
  const { signIn, clearMustChange } = useSession();
  const { users, registerUser } = useUserStore();
  const notify = useNotify();
  const [creds, setCreds] = useState<Record<string, Cred>>({});
  const credsRef = useRef(creds);
  const tokensRef = useRef<ResetToken[]>([]);

  const patch = useCallback((userId: string, p: Partial<Cred>) => {
    const next = { ...credsRef.current, [userId]: { ...(credsRef.current[userId] ?? fresh()), ...p } };
    credsRef.current = next;
    setCreds(next);
  }, []);
  const get = useCallback((userId: string): Cred => credsRef.current[userId] ?? fresh(), []);

  const value = useMemo<AuthStore>(() => {
    const find = (identifier: string) => users.find((u) => norm(u.username) === norm(identifier) || norm(u.email) === norm(identifier));
    const policy = (pw: string, u: { username?: string; email?: string }): string | null => (isStrong(pw, u) ? null : "Password belum memenuhi kebijakan: " + checkPassword(pw, u).filter((c) => !c.ok).map((c) => c.label.toLowerCase()).join("; ") + ".");

    return {
      login(identifier, password, remember) {
        const user = find(identifier);
        const wrong: LoginResult = { ok: false, code: "invalid", reason: "Username/email atau password salah." };
        if (!user) return wrong;
        const c = get(user.id);
        const now = Date.now();
        if (c.lockedUntil && c.lockedUntil > now) {
          const mins = Math.max(1, Math.ceil((c.lockedUntil - now) / 60000));
          return { ok: false, code: "locked", reason: `Akun dikunci sementara karena terlalu banyak percobaan gagal. Coba lagi sekitar ${mins} menit lagi.` };
        }
        if (c.password !== password) {
          const failed = c.failed + 1;
          patch(user.id, failed >= MAX_FAILED_LOGIN ? { failed: 0, lockedUntil: now + LOCK_MINUTES * 60000 } : { failed });
          return wrong;
        }
        patch(user.id, { failed: 0, lockedUntil: undefined });
        // Status akun baru diberitahukan SETELAH password benar, agar orang asing tidak bisa menebak akun mana yang ada.
        if (user.pending) return { ok: false, code: "pending", reason: "Pendaftaran akun kamu menunggu persetujuan Administrator." };
        if (!user.active) return { ok: false, code: "inactive", reason: "Akun nonaktif. Hubungi Administrator." };
        signIn(user, { mustChange: c.mustChange, remember });
        return { ok: true, user, mustChange: c.mustChange };
      },

      register(input) {
        const bad = policy(input.password, input);
        if (bad) return fail(bad);
        const r = registerUser({ name: input.name, username: input.username, email: input.email, directorate: input.directorate, subdirectorate: input.subdirectorate });
        if (!r.ok) return r;
        patch(r.id, { password: input.password, mustChange: false, changedAt: dayjs().format("YYYY-MM-DDTHH:mm:ss") });
        const admins = users.filter((u) => u.active && u.roles.includes(ADMIN_ROLE)).map((u) => u.id);
        notify({ to: { userIds: admins }, type: "user_registered", title: `Pendaftaran akun baru: ${input.name}`, body: `${input.directorate} · ${input.subdirectorate}. Tinjau, atur role, lalu aktifkan.`, link: "/user-management/users", from: { id: r.id, name: input.name } });
        return r;
      },

      requestReset(identifier) {
        const user = find(identifier);
        if (!user || !user.active || user.pending) return {};
        // token lama untuk akun ini dibatalkan; hanya token terbaru yang berlaku
        tokensRef.current = tokensRef.current.map((t) => (t.userId === user.id ? { ...t, used: true } : t));
        const expiresAt = Date.now() + RESET_TOKEN_MINUTES * 60000;
        const token = randomToken();
        tokensRef.current = [...tokensRef.current, { token, userId: user.id, expiresAt, used: false }];
        return { demoToken: token, expiresAt: dayjs(expiresAt).format("HH:mm") };
      },
      checkResetToken(token) {
        const t = tokensRef.current.find((x) => x.token === token);
        if (!t) return "invalid";
        if (t.used) return "used";
        return t.expiresAt < Date.now() ? "expired" : "valid";
      },
      resetPassword(token, next) {
        const t = tokensRef.current.find((x) => x.token === token);
        if (!t || t.used || t.expiresAt < Date.now()) return fail("Tautan reset tidak valid atau sudah kedaluwarsa. Minta tautan baru.");
        const user = users.find((u) => u.id === t.userId);
        if (!user) return fail("Akun tidak ditemukan.");
        const bad = policy(next, user);
        if (bad) return fail(bad);
        if (next === get(user.id).password) return fail("Password baru tidak boleh sama dengan password lama.");
        tokensRef.current = tokensRef.current.map((x) => (x.token === token ? { ...x, used: true } : x));
        patch(user.id, { password: next, mustChange: false, failed: 0, lockedUntil: undefined, changedAt: dayjs().format("YYYY-MM-DDTHH:mm:ss") });
        return { ok: true };
      },

      changePassword(userId, current, next) {
        const user = users.find((u) => u.id === userId);
        if (!user) return fail("Akun tidak ditemukan.");
        const c = get(userId);
        if (current !== null && current !== c.password) return fail("Password saat ini salah.");
        if (next === c.password) return fail("Password baru tidak boleh sama dengan password lama.");
        const bad = policy(next, user);
        if (bad) return fail(bad);
        patch(userId, { password: next, mustChange: false, changedAt: dayjs().format("YYYY-MM-DDTHH:mm:ss") });
        if (userId === me.id) clearMustChange();
        return { ok: true };
      },
      adminResetPassword(userId) {
        const user = users.find((u) => u.id === userId);
        if (!user) return fail("Akun tidak ditemukan.");
        const tempPassword = `Tmp#${Math.random().toString(36).slice(2, 8)}${Math.floor(10 + Math.random() * 90)}A`;
        patch(userId, { password: tempPassword, mustChange: true, failed: 0, lockedUntil: undefined });
        return { ok: true, tempPassword };
      },
      passwordChangedAt: (userId) => creds[userId]?.changedAt,
    };
  }, [users, registerUser, notify, me.id, signIn, clearMustChange, patch, get, creds]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthStore {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth harus dipakai di dalam <AuthProvider>");
  return v;
}
