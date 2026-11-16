"use client";

import PageSkeleton from "@/components/layout/PageSkeleton";
import AuditLogView from "@/components/audit/AuditLogView";

// Riwayat Perubahan: hanya lihat. Isinya dibuat otomatis oleh sistem dari setiap aktivitas dan
// disaring sesuai project dan task yang dimiliki pengguna. Komponen yang sama dipakai di tab
// Riwayat pada detail project.
export default function AuditTrailPage() {
  return (
    <PageSkeleton path="/audit-trail">
      <AuditLogView />
    </PageSkeleton>
  );
}
