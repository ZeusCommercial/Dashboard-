"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function RefreshButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [spinning, setSpinning] = useState(false);

  return (
    <button
      onClick={() => {
        setSpinning(true);
        start(() => {
          router.refresh();
          setTimeout(() => setSpinning(false), 600);
        });
      }}
      disabled={pending}
      className="inline-flex items-center gap-2 rounded-lg border border-hairline bg-surface px-3.5 py-2 text-[13px] font-medium text-bright transition-colors hover:border-gold/40 hover:text-gold disabled:opacity-60"
    >
      <span className={`inline-block ${spinning ? "animate-spin" : ""}`}>↻</span>
      Refresh
    </button>
  );
}
