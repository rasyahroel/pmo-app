"use client";

import type { ReactNode } from "react";

// Sengaja tanpa antd/router: komponen ini dipakai juga di global-error.tsx
// (yang menggantikan root layout, jadi ConfigProvider & router belum tentu ada).
// Warna = palet AGI, ditulis langsung.
const AGI = { 50: "#effcfc", 100: "#d5f6f8", 300: "#7bdde5", 400: "#35c1d0", 500: "#22a7b8", 600: "#1f879b", 900: "#214b58", 950: "#10313c" };

export type ErrorAction = {
  label: string;
  href?: string;
  onClick?: () => void;
  primary?: boolean;
};

type Preset = { title: string; description: string; actions: ErrorAction[] };

export const ERROR_PRESETS: Record<number, Preset> = {
  400: {
    title: "Permintaan tidak valid",
    description: "Ada data yang dikirim dengan format yang tidak sesuai, jadi permintaan ini tidak bisa diproses. Coba periksa isian lalu ulangi.",
    actions: [{ label: "Kembali", onClick: () => history.back(), primary: true }, { label: "Ke Dashboard", href: "/dashboard" }],
  },
  401: {
    title: "Sesi kamu sudah berakhir",
    description: "Kamu perlu masuk dulu untuk membuka halaman ini. Kalau sebelumnya sudah masuk, sesinya mungkin habis — silakan masuk lagi.",
    actions: [{ label: "Masuk", href: "/login", primary: true }],
  },
  403: {
    title: "Kamu tidak punya akses ke sini",
    description: "Project hanya bisa dibuka oleh pembuatnya, anggota tim (PMO/Developer), atau administrator. Kalau kamu merasa seharusnya punya akses, minta administrator menambahkan kamu ke tim project.",
    actions: [{ label: "Ke Daftar Project", href: "/projects", primary: true }, { label: "Ke Dashboard", href: "/dashboard" }],
  },
  404: {
    title: "Halaman tidak ditemukan",
    description: "Alamat yang kamu buka tidak ada atau sudah dipindahkan. Bisa juga datanya sudah dihapus.",
    actions: [{ label: "Ke Dashboard", href: "/dashboard", primary: true }, { label: "Kembali", onClick: () => history.back() }],
  },
  500: {
    title: "Terjadi kesalahan di aplikasi",
    description: "Ada yang tidak berjalan semestinya di sisi kami. Bukan salahmu — coba muat ulang, dan kalau masih terjadi, laporkan ke tim PMO dengan menyertakan kode referensi di bawah.",
    actions: [{ label: "Coba lagi", onClick: () => location.reload(), primary: true }, { label: "Ke Dashboard", href: "/dashboard" }],
  },
  503: {
    title: "Layanan sedang tidak tersedia",
    description: "Server sedang sibuk atau dalam pemeliharaan. Tunggu beberapa saat lalu coba lagi.",
    actions: [{ label: "Coba lagi", onClick: () => location.reload(), primary: true }],
  },
};

const CSS = `
.es-wrap{display:flex;align-items:center;justify-content:center;width:100%;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}
.es-card{position:relative;overflow:hidden;width:100%;max-width:640px;text-align:center;background:#fff;border-radius:20px;padding:56px 40px 44px;box-shadow:0 1px 2px rgba(16,49,60,.06),0 12px 32px rgba(16,49,60,.08)}
.es-blob{position:absolute;border-radius:50%;pointer-events:none}
.es-code{position:relative;font-size:120px;line-height:1;font-weight:800;letter-spacing:-4px;margin:0;background:linear-gradient(135deg,${AGI[300]},${AGI[600]} 70%,${AGI[900]});-webkit-background-clip:text;background-clip:text;color:transparent}
.es-title{position:relative;margin:12px 0 10px;font-size:24px;line-height:1.3;font-weight:700;color:${AGI[950]}}
.es-desc{position:relative;margin:0 auto;max-width:460px;font-size:14.5px;line-height:1.65;color:#5b6f76}
.es-ref{position:relative;display:inline-block;margin-top:20px;padding:6px 12px;border-radius:8px;background:${AGI[50]};border:1px solid ${AGI[100]};font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;color:${AGI[900]}}
.es-actions{position:relative;display:flex;flex-wrap:wrap;gap:10px;justify-content:center;margin-top:28px}
.es-btn{display:inline-flex;align-items:center;justify-content:center;height:40px;padding:0 20px;border-radius:10px;font-size:14px;font-weight:600;font-family:inherit;text-decoration:none;cursor:pointer;border:1px solid ${AGI[100]};background:#fff;color:${AGI[900]};transition:transform .12s ease,box-shadow .18s ease,background-color .18s ease}
.es-btn:hover{background:${AGI[50]};box-shadow:0 2px 8px rgba(16,49,60,.10)}
.es-btn:active{transform:scale(.97)}
.es-btn.es-primary{border-color:${AGI[400]};background:${AGI[400]};color:#fff}
.es-btn.es-primary:hover{background:${AGI[500]};border-color:${AGI[500]}}
@media (max-width:576px){.es-card{padding:40px 20px 32px}.es-code{font-size:84px;letter-spacing:-3px}.es-title{font-size:20px}}
`;

export default function ErrorState({
  code,
  title,
  description,
  actions,
  reference,
  fullscreen = false,
  children,
}: {
  code: number;
  title?: string;
  description?: string;
  actions?: ErrorAction[];
  reference?: string; // mis. error.digest — buat dilaporkan ke tim
  fullscreen?: boolean; // true = tengah layar penuh (login/global-error); false = di dalam area konten
  children?: ReactNode;
}) {
  const preset = ERROR_PRESETS[code] ?? ERROR_PRESETS[500];
  const list = actions ?? preset.actions;

  return (
    <div className="es-wrap" style={{ minHeight: fullscreen ? "100vh" : "calc(100vh - 160px)", padding: fullscreen ? 24 : 0, background: fullscreen ? "#F3FAFB" : undefined }}>
      <style>{CSS}</style>
      <div className="es-card" role="alert">
        <span className="es-blob" style={{ width: 260, height: 260, top: -110, right: -90, background: `radial-gradient(circle, ${AGI[100]}, transparent 70%)` }} />
        <span className="es-blob" style={{ width: 220, height: 220, bottom: -100, left: -80, background: `radial-gradient(circle, ${AGI[50]}, transparent 70%)` }} />
        <h1 className="es-code">{code}</h1>
        <h2 className="es-title">{title ?? preset.title}</h2>
        <p className="es-desc">{description ?? preset.description}</p>
        {reference && <div className="es-ref">Kode referensi: {reference}</div>}
        {children}
        <div className="es-actions">
          {list.map((a) =>
            a.href ? (
              <a key={a.label} href={a.href} className={`es-btn${a.primary ? " es-primary" : ""}`}>{a.label}</a>
            ) : (
              <button key={a.label} type="button" onClick={a.onClick} className={`es-btn${a.primary ? " es-primary" : ""}`}>{a.label}</button>
            )
          )}
        </div>
      </div>
    </div>
  );
}
