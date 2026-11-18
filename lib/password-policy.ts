// Kebijakan password. Aturan yang sama wajib diulang di backend (validasi server, bukan hanya form).
export const MIN_LENGTH = 10;
const COMMON = ["password", "welcome", "qwerty", "12345678", "admin123", "letmein"];

export type PwCheck = { id: string; label: string; ok: boolean };

export function checkPassword(pw: string, ctx: { username?: string; email?: string } = {}): PwCheck[] {
  const low = pw.toLowerCase();
  const hints = [ctx.username, ctx.email?.split("@")[0]].filter((x): x is string => !!x && x.length >= 3).map((x) => x.toLowerCase());
  return [
    { id: "len", label: `Minimal ${MIN_LENGTH} karakter`, ok: pw.length >= MIN_LENGTH },
    { id: "upper", label: "Ada huruf besar", ok: /[A-Z]/.test(pw) },
    { id: "lower", label: "Ada huruf kecil", ok: /[a-z]/.test(pw) },
    { id: "digit", label: "Ada angka", ok: /\d/.test(pw) },
    { id: "symbol", label: "Ada simbol (mis. @ # ! _)", ok: /[^A-Za-z0-9]/.test(pw) },
    { id: "plain", label: "Tidak memuat username/email dan kata umum", ok: pw.length > 0 && !hints.some((h) => low.includes(h)) && !COMMON.some((c) => low.includes(c)) },
  ];
}

export const isStrong = (pw: string, ctx?: { username?: string; email?: string }) => checkPassword(pw, ctx).every((c) => c.ok);

/** 0-4 untuk meteran kekuatan. */
export function strengthScore(pw: string, ctx?: { username?: string; email?: string }): number {
  if (!pw) return 0;
  const ok = checkPassword(pw, ctx).filter((c) => c.ok).length;
  return ok <= 2 ? 1 : ok <= 4 ? 2 : ok === 5 ? 3 : 4;
}
