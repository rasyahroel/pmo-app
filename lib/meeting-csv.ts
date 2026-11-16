// Format tindak lanjut hasil rapat (MOM) untuk diimpor menjadi task.
//
// Kolom (pemisah titik koma, cocok dengan Excel berbahasa Indonesia; koma juga diterima):
//   Judul Tindak Lanjut ; PIC (pisahkan dengan koma) ; Jatuh Tempo (YYYY-MM-DD) ; Catatan
export const MOM_TEMPLATE_HEADER = ["Judul Tindak Lanjut", "PIC (pisahkan dengan koma)", "Jatuh Tempo (YYYY-MM-DD)", "Catatan"];

export const MOM_TEMPLATE_CSV =
  "\uFEFF" +
  [
    MOM_TEMPLATE_HEADER.join(";"),
    '"Selesaikan rekonsiliasi batch 2";"Budi Prakoso, Andi Saputra";2026-09-30;"Prioritas tinggi"',
    '"Jadwalkan ulang rencana cutover";"Rani Kusuma";2026-09-28;',
  ].join("\r\n");

export type ParsedActionRow = { title: string; pics: string[]; dueDate?: string; note?: string };

function parseLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delimiter) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

// Tanggal harus benar-benar ada di kalender (2026-02-30 dan 2026-13-45 ditolak).
function isRealDate(v: string | undefined): v is string {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [y, m, d] = v.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** Baca CSV tindak lanjut. Baris tanpa judul dilewati; tanggal yang tidak valid menjadi kosong. */
export function parseActionItemsCsv(text: string): { rows: ParsedActionRow[]; skipped: number } {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return { rows: [], skipped: 0 };
  const delimiter = lines[0].split(";").length >= lines[0].split(",").length ? ";" : ",";
  const first = parseLine(lines[0], delimiter);
  const hasHeader = /judul/i.test(first[0] ?? "");
  const body = hasHeader ? lines.slice(1) : lines;
  const rows: ParsedActionRow[] = [];
  let skipped = 0;
  for (const line of body) {
    const [title, pics, due, note] = parseLine(line, delimiter);
    if (!title) {
      skipped++;
      continue;
    }
    rows.push({
      title: title.slice(0, 200),
      pics: (pics ?? "").split(/[,;]/).map((p) => p.trim()).filter(Boolean),
      dueDate: isRealDate(due) ? due : undefined,
      note: note ? note.slice(0, 500) : undefined,
    });
  }
  return { rows, skipped };
}
