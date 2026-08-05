"use client";
import { useRouter, useSearchParams } from "next/navigation";

const OPTIONS = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

export default function GranularityToggle({
  paramKey = "gran",
  defaultValue = "monthly",
}: {
  paramKey?: string;
  defaultValue?: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const current = params.get(paramKey) ?? defaultValue;

  return (
    <div className="inline-flex rounded-lg border border-hairline bg-ink p-0.5">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          onClick={() => {
            const p = new URLSearchParams(params.toString());
            p.set(paramKey, o.value);
            router.push(`?${p.toString()}`);
          }}
          className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
            current === o.value
              ? "bg-gold text-ink"
              : "text-muted hover:text-bright"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
