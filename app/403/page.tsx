import ErrorState from "@/components/common/ErrorState";

// Tujuan redirect kalau sudah login tapi bukan pembuat/anggota tim/administrator project tsb.
export default function ForbiddenPage() {
  return <ErrorState code={403} />;
}
