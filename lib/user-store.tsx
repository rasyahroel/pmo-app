"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { appUsers as seedUsers, roles as seedRoles, type AppUser, type Role } from "@/lib/mock-data";
import { useAuditStore } from "@/lib/audit-store";
import { useActingUserControls, useCurrentUser } from "@/lib/acting-user";

// Store Manajemen User: akun + role & matriks permission. Satu sumber untuk halaman Pengguna, halaman
// Role & Permission, Daftar Pustaka (daftar akses teknis), dan hitungan pemakaian di Master Data.
//
// Titik sambung ke backend Go: GET/POST/PATCH/DELETE /users, /roles, PUT /roles/{id}/permissions.
// Aturan pengaman di bawah (admin terakhir, role bawaan, nama unik) HARUS diulang di server.

export type PermKey = "view" | "create" | "edit" | "delete";
export const PERM_KEYS: PermKey[] = ["view", "create", "edit", "delete"];
export const PERM_LABEL: Record<PermKey, string> = { view: "Lihat", create: "Tambah", edit: "Ubah", delete: "Hapus" };
export const ADMIN_ROLE = "Administrator";
export const SELF_REGISTER_ROLE = "User / Viewer";

export type UserInput = Omit<AppUser, "id">;
export type Result<T = object> = ({ ok: true } & T) | { ok: false; reason: string };

type UserStore = {
  users: AppUser[];
  roles: Role[]; // memberCount dihitung dari users
  addUser: (input: UserInput) => Result<{ id: string }>;
  /** Pendaftaran mandiri: akun dibuat nonaktif + menunggu persetujuan, role bawaan User / Viewer. */
  registerUser: (input: Pick<UserInput, "name" | "username" | "email" | "directorate" | "subdirectorate">) => Result<{ id: string }>;
  updateUser: (id: string, input: UserInput) => Result;
  deleteUser: (id: string) => Result;
  setUserActive: (id: string, active: boolean) => Result;
  addRole: (input: { name: string; description: string; copyFromId?: string }) => Result<{ id: string }>;
  updateRole: (id: string, input: { name: string; description: string }) => Result;
  deleteRole: (id: string) => Result;
  /** Ubah centang matriks. `keys` = kolom yang diubah, `menuKeys` = baris yang diubah. */
  setPermissions: (roleId: string, menuKeys: string[], keys: PermKey[], value: boolean) => Result;
};

const Ctx = createContext<UserStore | null>(null);
const lower = (s: string) => s.trim().toLowerCase();
const fail = (reason: string) => ({ ok: false as const, reason });

export function UserStoreProvider({ children }: { children: ReactNode }) {
  const { addLog } = useAuditStore();
  const currentUser = useCurrentUser();
  const { sync } = useActingUserControls();
  const [users, setUsersState] = useState<AppUser[]>(seedUsers);
  const [roles, setRolesState] = useState<Role[]>(seedRoles);
  const usersRef = useRef(users);
  const rolesRef = useRef(roles);
  const setUsers = useCallback(
    (n: AppUser[]) => {
      usersRef.current = n;
      setUsersState(n);
      sync(n); // bila akun yang sedang dipakai diubah, salinannya ikut diperbarui
    },
    [sync],
  );
  const setRoles = useCallback((n: Role[]) => {
    rolesRef.current = n;
    setRolesState(n);
  }, []);

  const value = useMemo<UserStore>(() => {
    const logUser = (u: Pick<AppUser, "name">, field: string, o: string, n: string) =>
      addLog({ projectName: "Manajemen User", entity: `User · ${u.name}`, field, oldValue: o, newValue: n });
    const logRole = (name: string, field: string, o: string, n: string) =>
      addLog({ projectName: "Manajemen User", entity: `Role · ${name}`, field, oldValue: o, newValue: n });

    const activeAdmins = (list: AppUser[]) => list.filter((u) => u.active && u.roles.includes(ADMIN_ROLE));
    // Menjaga minimal satu Administrator aktif supaya tidak ada yang terkunci dari Manajemen User.
    const wouldLoseLastAdmin = (target: AppUser, next: AppUser | null) => {
      const stillAdmin = !!next && next.active && next.roles.includes(ADMIN_ROLE);
      if (stillAdmin) return false;
      const wasAdmin = target.active && target.roles.includes(ADMIN_ROLE);
      return wasAdmin && activeAdmins(usersRef.current).length <= 1;
    };
    const dupUser = (input: UserInput, exceptId?: string): string | null => {
      const others = usersRef.current.filter((u) => u.id !== exceptId);
      if (others.some((u) => lower(u.username) === lower(input.username))) return "Username sudah dipakai akun lain.";
      if (others.some((u) => lower(u.email) === lower(input.email))) return "Email sudah dipakai akun lain.";
      return null;
    };

    return {
      users,
      roles: roles.map((r) => ({ ...r, memberCount: users.filter((u) => u.roles.includes(r.name)).length })),

      addUser(input) {
        const d = dupUser(input);
        if (d) return fail(d);
        const id = `u-${Date.now()}`;
        setUsers([...usersRef.current, { id, ...input }]);
        logUser(input, "Akun", "—", `Dibuat · ${input.roles.join(", ")}`);
        return { ok: true, id };
      },
      registerUser(input) {
        const full: UserInput = { ...input, roles: [SELF_REGISTER_ROLE], active: false, pending: true };
        const d = dupUser(full);
        if (d) return fail(d);
        const id = `u-${Date.now()}`;
        setUsers([...usersRef.current, { id, ...full }]);
        addLog({ projectName: "Manajemen User", entity: `User · ${input.name}`, field: "Akun", oldValue: "—", newValue: "Mendaftar sendiri · menunggu persetujuan", by: "Pendaftaran mandiri" });
        return { ok: true, id };
      },
      updateUser(id, input) {
        const cur = usersRef.current.find((u) => u.id === id);
        if (!cur) return fail("Pengguna tidak ditemukan.");
        const d = dupUser(input, id);
        if (d) return fail(d);
        if (id === currentUser.id && !input.active) return fail("Akun yang sedang dipakai tidak bisa dinonaktifkan.");
        if (wouldLoseLastAdmin(cur, { ...cur, ...input })) return fail("Harus ada minimal satu Administrator aktif.");
        setUsers(usersRef.current.map((u) => (u.id === id ? { id, ...input } : u)));
        if (cur.name !== input.name) logUser(input, "Nama", cur.name, input.name);
        if (cur.username !== input.username) logUser(input, "Username", cur.username, input.username);
        if (cur.email !== input.email) logUser(input, "Email", cur.email, input.email);
        if (cur.directorate !== input.directorate) logUser(input, "Direktorat", cur.directorate, input.directorate);
        if (cur.subdirectorate !== input.subdirectorate) logUser(input, "Subdit", cur.subdirectorate, input.subdirectorate);
        if (cur.roles.join(", ") !== input.roles.join(", ")) logUser(input, "Role", cur.roles.join(", "), input.roles.join(", "));
        if (cur.active !== input.active) logUser(input, "Status", cur.active ? "Aktif" : "Nonaktif", input.active ? "Aktif" : "Nonaktif");
        return { ok: true };
      },
      setUserActive(id, active) {
        const cur = usersRef.current.find((u) => u.id === id);
        if (!cur) return fail("Pengguna tidak ditemukan.");
        if (cur.active === active) return { ok: true };
        if (id === currentUser.id && !active) return fail("Akun yang sedang dipakai tidak bisa dinonaktifkan.");
        if (wouldLoseLastAdmin(cur, { ...cur, active })) return fail("Harus ada minimal satu Administrator aktif.");
        setUsers(usersRef.current.map((u) => (u.id === id ? { ...u, active, pending: active ? false : u.pending } : u)));
        logUser(cur, "Status", cur.active ? "Aktif" : "Nonaktif", active ? "Aktif" : "Nonaktif");
        return { ok: true };
      },
      deleteUser(id) {
        const cur = usersRef.current.find((u) => u.id === id);
        if (!cur) return fail("Pengguna tidak ditemukan.");
        if (id === currentUser.id) return fail("Akun yang sedang dipakai tidak bisa dihapus.");
        if (wouldLoseLastAdmin(cur, null)) return fail("Harus ada minimal satu Administrator aktif.");
        setUsers(usersRef.current.filter((u) => u.id !== id));
        logUser(cur, "Akun", "Aktif", "Dihapus");
        return { ok: true };
      },

      addRole({ name, description, copyFromId }) {
        const n = name.trim();
        if (rolesRef.current.some((r) => lower(r.name) === lower(n))) return fail("Nama role sudah ada.");
        const src = rolesRef.current.find((r) => r.id === copyFromId);
        const base = (src ?? rolesRef.current[0]).permissions;
        const role: Role = {
          id: `role-${Date.now()}`,
          name: n,
          description: description.trim(),
          memberCount: 0,
          permissions: base.map((p) => (src ? { ...p } : { ...p, view: false, create: false, edit: false, delete: false })),
        };
        setRoles([...rolesRef.current, role]);
        logRole(n, "Role", "—", src ? `Dibuat (salinan dari ${src.name})` : "Dibuat");
        return { ok: true, id: role.id };
      },
      updateRole(id, { name, description }) {
        const cur = rolesRef.current.find((r) => r.id === id);
        if (!cur) return fail("Role tidak ditemukan.");
        const n = name.trim();
        if (cur.name === ADMIN_ROLE && n !== ADMIN_ROLE) return fail("Nama role Administrator tidak bisa diubah.");
        if (rolesRef.current.some((r) => r.id !== id && lower(r.name) === lower(n))) return fail("Nama role sudah ada.");
        setRoles(rolesRef.current.map((r) => (r.id === id ? { ...r, name: n, description: description.trim() } : r)));
        if (cur.name !== n) {
          // user menyimpan nama role, jadi ikut diganti
          setUsers(usersRef.current.map((u) => (u.roles.includes(cur.name) ? { ...u, roles: u.roles.map((x) => (x === cur.name ? n : x)) } : u)));
          logRole(n, "Nama", cur.name, n);
        }
        if (cur.description !== description.trim()) logRole(n, "Deskripsi", cur.description, description.trim());
        return { ok: true };
      },
      deleteRole(id) {
        const cur = rolesRef.current.find((r) => r.id === id);
        if (!cur) return fail("Role tidak ditemukan.");
        if (cur.name === ADMIN_ROLE) return fail("Role Administrator tidak bisa dihapus.");
        const used = usersRef.current.filter((u) => u.roles.includes(cur.name)).length;
        if (used > 0) return fail(`Masih dipakai ${used} pengguna. Pindahkan role mereka dulu.`);
        setRoles(rolesRef.current.filter((r) => r.id !== id));
        logRole(cur.name, "Role", "Aktif", "Dihapus");
        return { ok: true };
      },
      setPermissions(roleId, menuKeys, keys, val) {
        const cur = rolesRef.current.find((r) => r.id === roleId);
        if (!cur) return fail("Role tidak ditemukan.");
        if (cur.name === ADMIN_ROLE) return fail("Hak akses Administrator selalu penuh dan tidak bisa diubah.");
        const changes: [string, PermKey, boolean, boolean][] = [];
        const next = cur.permissions.map((p) => {
          if (!menuKeys.includes(p.menuKey)) return p;
          const q = { ...p };
          for (const k of keys) q[k] = val;
          // Tambah/Ubah/Hapus tanpa Lihat tidak ada artinya; mencabut Lihat mencabut semuanya.
          if (val && k_any(keys)) q.view = true;
          if (!val && keys.includes("view")) {
            q.create = false;
            q.edit = false;
            q.delete = false;
          }
          for (const k of PERM_KEYS) if (q[k] !== p[k]) changes.push([p.menuLabel, k, p[k], q[k]]);
          return q;
        });
        setRoles(rolesRef.current.map((r) => (r.id === roleId ? { ...r, permissions: next } : r)));
        for (const [menu, k, o, n] of changes) logRole(cur.name, `${menu}: ${PERM_LABEL[k]}`, o ? "Ya" : "Tidak", n ? "Ya" : "Tidak");
        return { ok: true };
      },
    };
  }, [addLog, setUsers, setRoles, users, roles, currentUser]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

const k_any = (keys: PermKey[]) => keys.some((k) => k !== "view");

export function useUserStore(): UserStore {
  const v = useContext(Ctx);
  if (!v) throw new Error("useUserStore harus dipakai di dalam <UserStoreProvider>");
  return v;
}

// --- Fungsi murni -----------------------------------------------------------------------------

/** Hak gabungan seorang pengguna: gabungan (OR) dari semua rolenya. */
export function permissionsOf(user: Pick<AppUser, "roles">, roles: Role[]): Record<string, Record<PermKey, boolean>> {
  const out: Record<string, Record<PermKey, boolean>> = {};
  for (const r of roles.filter((x) => user.roles.includes(x.name))) {
    for (const p of r.permissions) {
      const cur = (out[p.menuKey] ??= { view: false, create: false, edit: false, delete: false });
      for (const k of PERM_KEYS) cur[k] = cur[k] || p[k];
    }
  }
  return out;
}
