"use client";

import ErrorState from "@/components/common/ErrorState";

// Error paling parah (root layout ikut rusak). Menggantikan seluruh <html>,
// jadi harus bawa <html>/<body> sendiri dan gak boleh bergantung ke antd/provider.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="id">
      <body style={{ margin: 0 }}>
        <ErrorState
          fullscreen
          code={500}
          reference={error.digest}
          actions={[{ label: "Coba lagi", onClick: reset, primary: true }]}
        />
      </body>
    </html>
  );
}
