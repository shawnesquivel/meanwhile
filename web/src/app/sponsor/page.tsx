"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { Footer, Nav } from "@/components/nav";
import { LiveQueue } from "@/components/queue";

const TIERS = [
  {
    id: "standard",
    name: "Standard",
    usd: 5,
    blurb: "Joins the rotation behind Boost lines.",
  },
  {
    id: "boost",
    name: "Boost",
    usd: 15,
    blurb: "Serves ahead of every Standard line.",
  },
] as const;

interface MyCampaign {
  id: string;
  brand: string | null;
  text: string;
  status: string;
  tier: string;
  pricePerThousandUsd: string;
  impressionsPurchased: number;
  impressionsServed: number;
}

function SponsorForm() {
  const { data: session, isPending } = useSession();
  const params = useSearchParams();
  const paid = params.get("paid") === "1";
  // Avoid SSR/client hydration mismatch: useSession resolves client-side only.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [text, setText] = useState("");
  const [clickUrl, setClickUrl] = useState("https://");
  const [brand, setBrand] = useState("");
  const [tier, setTier] = useState<(typeof TIERS)[number]["id"]>("standard");
  const [blocks, setBlocks] = useState(1);
  const [leaderboard, setLeaderboard] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devActivated, setDevActivated] = useState(false);
  const [mine, setMine] = useState<MyCampaign[] | null>(null);

  const tierDef = TIERS.find((t) => t.id === tier) ?? TIERS[0];
  const total = tierDef.usd * blocks;

  const loadMine = useCallback(() => {
    if (!session?.user) return;
    fetch("/api/sponsor/campaigns")
      .then((r) => (r.ok ? r.json() : { campaigns: [] }))
      .then((j) => setMine(j.campaigns ?? []))
      .catch(() => setMine([]));
  }, [session?.user]);

  useEffect(loadMine, [loadMine]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setDevActivated(false);
    try {
      const res = await fetch("/api/sponsor/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          text,
          clickUrl,
          brand: brand || undefined,
          tier,
          blocks,
          showOnLeaderboard: leaderboard,
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        setError(j.error ?? "Something went wrong");
        return;
      }
      if (j.checkoutUrl) {
        window.location.href = j.checkoutUrl;
        return;
      }
      // Dev mode: activated instantly.
      setDevActivated(true);
      setText("");
      setBrand("");
      loadMine();
    } finally {
      setBusy(false);
    }
  };

  if (!mounted || isPending) {
    return <p className="font-mono text-sm text-muted">loading…</p>;
  }

  if (!session?.user) {
    return (
      <div className="rounded-lg border border-panel-edge bg-panel p-6">
        <h2 className="font-semibold">Sign in to sponsor</h2>
        <p className="mt-2 text-sm text-zinc-400">
          Campaigns are tied to your account so you can track delivery and
          re-up in one click.
        </p>
        <Link
          href="/signin?next=/sponsor"
          className="mt-4 inline-block rounded-md bg-accent px-4 py-2 text-sm font-semibold text-zinc-950 hover:brightness-110 transition-[filter]"
        >
          Sign in →
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_320px]">
      <form onSubmit={submit} className="space-y-5">
        {paid && (
          <p className="rounded-md border border-accent-dim/60 bg-panel px-4 py-3 text-sm text-accent">
            Payment received — your line goes live as soon as Stripe confirms
            (usually seconds).
          </p>
        )}
        {devActivated && (
          <p className="rounded-md border border-accent-dim/60 bg-panel px-4 py-3 text-sm text-accent">
            Dev mode: campaign activated instantly (no Stripe key configured).
          </p>
        )}

        <div>
          <label className="mb-1.5 block font-mono text-xs uppercase tracking-widest text-muted">
            sponsor line · 3–60 chars
          </label>
          <input
            required
            minLength={3}
            maxLength={60}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Try Linear — issue tracking built for speed"
            className="w-full rounded-md border border-panel-edge bg-panel px-3 py-2.5 font-mono text-sm outline-none focus:border-accent-dim"
          />
          <p className="mt-1 text-right font-mono text-xs text-muted">
            {text.length} / 60
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block font-mono text-xs uppercase tracking-widest text-muted">
              destination url (https)
            </label>
            <input
              required
              type="url"
              pattern="https://.*"
              value={clickUrl}
              onChange={(e) => setClickUrl(e.target.value)}
              className="w-full rounded-md border border-panel-edge bg-panel px-3 py-2.5 font-mono text-sm outline-none focus:border-accent-dim"
            />
          </div>
          <div>
            <label className="mb-1.5 block font-mono text-xs uppercase tracking-widest text-muted">
              brand name (optional)
            </label>
            <input
              value={brand}
              maxLength={40}
              onChange={(e) => setBrand(e.target.value)}
              placeholder="Linear"
              className="w-full rounded-md border border-panel-edge bg-panel px-3 py-2.5 font-mono text-sm outline-none focus:border-accent-dim"
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block font-mono text-xs uppercase tracking-widest text-muted">
            tier
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            {TIERS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTier(t.id)}
                className={`rounded-lg border p-4 text-left transition-colors ${
                  tier === t.id
                    ? "border-accent-dim bg-panel"
                    : "border-panel-edge bg-panel/40 hover:border-zinc-600"
                }`}
              >
                <div className="flex items-baseline justify-between">
                  <span className="font-semibold">{t.name}</span>
                  <span className="font-mono text-sm text-accent">
                    ${t.usd}/1k
                  </span>
                </div>
                <p className="mt-1 text-xs text-zinc-400">{t.blurb}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="w-32">
            <label className="mb-1.5 block font-mono text-xs uppercase tracking-widest text-muted">
              blocks
            </label>
            <input
              type="number"
              min={1}
              max={100}
              value={blocks}
              onChange={(e) => setBlocks(Math.max(1, Math.min(100, Number(e.target.value) || 1)))}
              className="w-full rounded-md border border-panel-edge bg-panel px-3 py-2.5 font-mono text-sm outline-none focus:border-accent-dim"
            />
          </div>
          <label className="mt-5 flex cursor-pointer items-center gap-2 text-sm text-zinc-400">
            <input
              type="checkbox"
              checked={leaderboard}
              onChange={(e) => setLeaderboard(e.target.checked)}
              className="accent-[var(--accent)]"
            />
            show on the public queue
          </label>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={busy || text.length < 3}
          className="rounded-md bg-accent px-6 py-2.5 text-sm font-semibold text-zinc-950 hover:brightness-110 disabled:opacity-50 transition-[filter]"
        >
          {busy ? "…" : `Checkout — $${total.toFixed(2)}`}
        </button>
      </form>

      {/* Order summary */}
      <aside className="h-fit rounded-lg border border-panel-edge bg-panel p-5">
        <h3 className="font-mono text-xs uppercase tracking-widest text-muted">
          order
        </h3>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-zinc-400">tier</dt>
            <dd className="font-mono">{tierDef.name}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-zinc-400">blocks</dt>
            <dd className="font-mono">{blocks}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-zinc-400">counted impressions</dt>
            <dd className="font-mono">{(blocks * 1000).toLocaleString()}</dd>
          </div>
          <div className="flex justify-between border-t border-panel-edge pt-2">
            <dt className="text-zinc-400">total</dt>
            <dd className="font-mono text-accent">${total.toFixed(2)}</dd>
          </div>
        </dl>
        <p className="mt-4 text-xs leading-relaxed text-muted">
          An impression counts only after your line has been visibly on screen
          for 3 seconds. Clicks consume 50 impressions of budget. 50% of spend
          settles to the developers who showed your line.
        </p>
      </aside>

      {/* My campaigns */}
      <section className="lg:col-span-2">
        <h3 className="mb-4 font-mono text-xs uppercase tracking-widest text-muted">
          your campaigns
        </h3>
        {mine === null ? (
          <p className="font-mono text-sm text-muted">loading…</p>
        ) : mine.length === 0 ? (
          <p className="font-mono text-sm text-muted">
            none yet — your first line is the queue{"'"}s gain.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-panel-edge">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-panel-edge bg-panel font-mono text-[11px] uppercase tracking-widest text-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">line</th>
                  <th className="px-3 py-2 font-medium">tier</th>
                  <th className="px-3 py-2 font-medium text-right">delivered</th>
                  <th className="px-3 py-2 font-medium text-right">status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-panel-edge">
                {mine.map((c) => (
                  <tr key={c.id}>
                    <td className="px-3 py-2">{c.text}</td>
                    <td className="px-3 py-2 font-mono text-xs">{c.tier}</td>
                    <td className="px-3 py-2 text-right font-mono text-muted">
                      {c.impressionsServed.toLocaleString()} /{" "}
                      {c.impressionsPurchased.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <span
                        className={`font-mono text-[11px] uppercase tracking-wider ${
                          c.status === "active"
                            ? "text-accent"
                            : c.status === "exhausted"
                              ? "text-zinc-500"
                              : "text-amber-400"
                        }`}
                      >
                        {c.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export default function SponsorPage() {
  return (
    <>
      <Nav />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-16">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-accent">
          sponsors
        </p>
        <h1 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
          Put one line in front of the most-watched spinner in software.
        </h1>
        <p className="mt-4 max-w-xl text-zinc-400">
          Fixed prices, no auction. A block is 1,000 counted impressions —
          your line, visibly on screen, in the editor of someone actively
          coding with AI.
        </p>

        <div className="mt-12">
          <Suspense>
            <SponsorForm />
          </Suspense>
        </div>

        <section className="mt-16 border-t border-panel-edge pt-10">
          <h2 className="mb-6 font-mono text-xs uppercase tracking-widest text-muted">
            current queue
          </h2>
          <LiveQueue />
        </section>
      </main>
      <Footer />
    </>
  );
}
