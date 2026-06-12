"use client";

import { useEffect, useState } from "react";

const STOCK_VERBS = [
  "Discombobulating",
  "Percolating",
  "Conjuring",
  "Flibbertigibbeting",
  "Baking",
];

const SPONSOR_LINES = [
  { text: "Linear — issue tracking built for speed", brand: "Linear" },
  { text: "Neon — serverless Postgres for builders", brand: "Neon" },
  { text: "Resend — email for developers", brand: "Resend" },
  { text: "PostHog — product analytics, self-host or cloud", brand: "PostHog" },
];

function useRotation(n: number, ms: number): number {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((v) => (v + 1) % n), ms);
    return () => clearInterval(t);
  }, [n, ms]);
  return i;
}

/** Side-by-side stock vs sponsored spinner, the product in one glance. */
export function SpinnerDemo() {
  const stockIdx = useRotation(STOCK_VERBS.length, 2600);
  const sponsorIdx = useRotation(SPONSOR_LINES.length, 2600);
  const [earned, setEarned] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setEarned((v) => v + 1), 1400);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="rounded-lg border border-panel-edge bg-panel p-4">
        <p className="mb-3 font-mono text-[11px] uppercase tracking-widest text-muted">
          stock claude code
        </p>
        <p className="font-mono text-sm">
          <span className="mw-spinner" />{" "}
          <span className="text-zinc-400">{STOCK_VERBS[stockIdx]}</span>
          <span className="mw-cursor text-zinc-400">…</span>
          <span className="float-right text-xs text-muted">Grep · 3.9s</span>
        </p>
        <p className="mt-3 text-right font-mono text-xs text-muted">earns $0.00</p>
      </div>
      <div className="rounded-lg border border-accent-dim/60 bg-panel p-4 shadow-[0_0_24px_-12px_var(--accent)]">
        <p className="mb-3 font-mono text-[11px] uppercase tracking-widest text-accent">
          with meanwhile
        </p>
        <p className="font-mono text-sm">
          <span className="mw-spinner" />{" "}
          <span className="cursor-pointer text-foreground underline-offset-4 hover:underline">
            {SPONSOR_LINES[sponsorIdx].text}
          </span>
          <span className="mw-cursor">…</span>
          <span className="float-right text-xs text-muted">Grep · 3.9s</span>
        </p>
        <p className="mt-3 text-right font-mono text-xs text-accent">
          earns ${(0.01 * earned).toFixed(2)} <span className="text-muted">and counting</span>
        </p>
      </div>
    </div>
  );
}
