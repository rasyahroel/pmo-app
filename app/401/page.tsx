import ErrorState from "@/components/common/ErrorState";

// Tujuan redirect kalau sesi habis / belum login (nanti dipanggil dari middleware/interceptor).
export default function UnauthorizedPage() {
  return <ErrorState code={401} fullscreen />;
}
