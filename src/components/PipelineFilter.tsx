"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

export function PipelineFilter({
  pipelines,
  current,
}: {
  pipelines: { id: string; name: string }[];
  current: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  if (pipelines.length === 0) return null;

  return (
    <select
      value={current ?? ""}
      onChange={(e) => {
        const p = new URLSearchParams(params);
        if (e.target.value) p.set("pipeline", e.target.value);
        else p.delete("pipeline");
        router.push(`${pathname}?${p.toString()}`);
      }}
      className="rounded-lg border border-hairline bg-surface px-3 py-2 text-[13px] text-bright focus:border-gold/40 focus:outline-none"
    >
      <option value="">All pipelines</option>
      {pipelines.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </select>
  );
}
