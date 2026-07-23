import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { RefreshButton } from "@/components/RefreshButton";

export const metadata: Metadata = {
  title: "Zeus Commercial Capital",
  description: "Pipeline, revenue, AI call performance, and partner commissions",
};

const NAV = [
  { href: "/", label: "Overview" },
  { href: "/ai-calls", label: "AI Calls" },
  { href: "/affiliates", label: "Affiliates" },
  { href: "/deals", label: "Deals" },
];

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-page font-sans text-ink antialiased">
        <div className="mx-auto max-w-[1400px] px-6 py-6">
          <header className="mb-7 flex flex-wrap items-center justify-between gap-4 border-b border-ink/10 pb-5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-gold to-goldDim shadow-sm">
                <span className="font-display text-lg font-bold text-white">
                  Z
                </span>
              </div>
              <div>
                <div className="font-display text-[19px] leading-tight text-ink">
                  Zeus Commercial Capital
                </div>
                <div className="text-[11px] uppercase tracking-[0.16em] text-ink/50">
                 
                </div>
              </div>
            </div>
            <div className="flex items-center gap-5">
              <nav className="flex gap-1">
                {NAV.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="rounded-lg px-3.5 py-2 text-[13px] font-medium text-ink/65 transition-colors hover:bg-ink/[0.06] hover:text-ink"
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
              <RefreshButton />
            </div>
          </header>
          {children}
          <footer className="mt-10 border-t border-ink/10 pt-5 text-[11px] text-ink/45">
            Zeus Commercial Capital — internal dashboard. Figures update on refresh.
          </footer>
        </div>
      </body>
    </html>
  );
}
