// Pengaturan autentikasi versi uji (belum ada backend). Semua angka di sini harus sama dengan yang
// dipakai backend Go; lihat Daftar Pustaka → "Login, Register, Lupa Password, dan Profil".

/**
 * true = halaman selain halaman auth hanya bisa dibuka setelah login, dan popup wajib ganti password aktif.
 * false = aplikasi terbuka tanpa login (pengguna bawaan Admin IT); halaman login/profil tetap ada tetapi tidak mengunci apa pun.
 * Dimatikan selama pengembangan frontend; nyalakan saat backend sudah ada.
 */
export const ENFORCE_LOGIN = false;
/** false = pendaftaran mandiri disembunyikan (tautan "Daftar" hilang, /register dialihkan ke /login). Akun dibuat Administrator di Manajemen User. */
export const ALLOW_SELF_REGISTER = false;
/** Versi uji: tampilkan akun uji di halaman login dan tautan reset (karena belum ada email). Matikan di produksi. */
export const DEMO_MODE = true;
/** Password awal akun yang dibuat administrator (versi uji). Di backend: acak per akun, sekali pakai. */
export const INITIAL_PASSWORD = "Welcome@123";

export const MAX_FAILED_LOGIN = 5;
export const LOCK_MINUTES = 5;
export const RESET_TOKEN_MINUTES = 30;
export const RESEND_COOLDOWN_SECONDS = 60;
export const SESSION_HOURS = 8;
export const SESSION_REMEMBER_DAYS = 30;

/** Halaman yang tampil tanpa sidebar/header dan boleh dibuka tanpa login. */
export const AUTH_PATHS = ["/login", "/register", "/forgot-password", "/reset-password", "/401"];
