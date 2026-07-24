"use client";
import { useRouter, useSearchParams } from "next/navigation";

const OPTIONS = [
  { value: "7", label: "Last week" },
  { value: "30", label: "Last month" },
  { value: "180", label: "Last 6 months" },
  { value: "", label: "All time" },
];

export default function RangeFilter() {
  const router = useRouter();
  const params = useSearchParams();
  const current = params.get("range") ?? "";

  return (
    <select
      value={current}
      onChange={(e) => {
        const p = new URLSearchParams(params.toString());
        if (e.target.value) p.set("range", e.target.value);
        else p.delete("range");
        router.push(`?${p.toString()}`);
      }}
      className="rounded-lg border border-hairline bg-surface px-3 py-1.5 text-[13px] text-bright outline-none focus:border-gold/50"
    >
      {OPTIONS.map((o) => (
        <option key={o.value} value={o.value} className="bg-surface text-bright">
          {o.label}
        </option>
      ))}
    </select>
  );
}
