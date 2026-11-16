"use client";

import { useEffect } from "react";
import ErrorState from "@/components/common/ErrorState";

// Menangkap error runtime di dalam halaman (di dalam layout/AppShell).
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <ErrorState
      code={500}
      reference={error.digest}
      actions={[
        { label: "Coba lagi", onClick: reset, primary: true },
        { label: "Ke Dashboard", href: "/dashboard" },
      ]}
    />
  );
}
