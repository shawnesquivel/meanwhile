"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { signOut, useSession } from "@/lib/auth-client";
import { Footer, Nav } from "@/components/nav";

interface Overview {
  user: { email: string; name: string };
  lifetimeUsd: string;
  todayUsd: string;
  balanceUsd: string;
  minPayoutUsd: string;
  canRequestPayout: boolean;
  events: {
    id: string;
    event: string;
    surface: string;
    creditedUsd: string;
    at: string;
  }[];
}

interface Payout {
  id: string;
  amountUsd: string;
  status: string;
  method: string;
  requestedAt: string;
}

const SURFACE_LABEL: Record<string, string> = {
  cc_webview: "Claude Code panel",
  cc_cli: "Claude CLI",
  codex_cli: "Codex CLI",
  codex_webview: "Codex panel",
};

export default function DashboardPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [mounted, setMounted] = useState(false);
  const [data, setData] = useState<Overview | null>(null);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [method, setMethod] = useState("");
  const [requesting, setRequesting] = useState(false);
  const [payoutMsg, setPayoutMsg] = useState<string | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted || isPending) return;
    if (!session?.user) {
      router.replace("/signin?next=/dashboard");
      return;
    }
  }, [mounted, isPending, session?.user, router]);

  const load = useCallback(() => {
    fetch("/api/me/overview")
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .catch(() => setData(null));
    fetch("/api/me/payouts")
      .then((r) => (r.ok ? r.json() : { payouts: [] }))
      .then((j) => setPayouts(j.payouts ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (mounted && session?.user) load();
  }, [mounted, session?.user, load]);

  const requestPayout = async (e: React.FormEvent) => {
    e.preventDefault();
    setRequesting(true);
    setPayoutMsg(null);
    try {
      const res = await fetch("/api/me/payouts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ method }),
      });
      const j = await res.json();
      setPayoutMsg(
        res.ok
          ? `Requested $${j.amountUsd} — we'll settle it manually and mark it paid.`
          : j.error,
      );
      if (res.ok) {
        setMethod("");
        load();
      }
    } finally {
      setRequesting(false);
    }
  };

  if (!mounted || isPending || !session?.user) {
    return (
      <>
        <Nav />
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-20">
          <p className="font-mono text-sm text-muted">loading…</p>
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Nav />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-accent">
              earnings
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              {data?.user.name || session.user.name}
            </h1>
            <p className="mt-1 text-sm text-muted">{session.user.email}</p>
          </div>
          <button
            onClick={() => signOut().then(() => router.push("/"))}
            className="rounded-md border border-panel-edge px-3 py-1.5 text-sm text-muted hover:text-foreground transition-colors"
          >
            Sign out
          </button>
        </div>

        {/* Stat cards */}
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {[
            ["today", data?.todayUsd, "credited since midnight UTC"],
            ["lifetime", data?.lifetimeUsd, "all credited events"],
            ["available", data?.balanceUsd, "after payout requests"],
          ].map(([label, value, sub]) => (
            <div
              key={label as string}
              className="rounded-lg border border-panel-edge bg-panel p-5"
            >
              <p className="font-mono text-[11px] uppercase tracking-widest text-muted">
                {label}
              </p>
              <p className="mt-2 font-mono text-3xl text-accent">
                ${value ?? "0.00"}
              </p>
              <p className="mt-1 text-xs text-muted">{sub}</p>
            </div>
          ))}
        </div>

        {/* Payout */}
        <section className="mt-12 rounded-lg border border-panel-edge bg-panel p-6">
          <h2 className="font-mono text-xs uppercase tracking-widest text-muted">
            payouts
          </h2>
          {data?.canRequestPayout ? (
            <form onSubmit={requestPayout} className="mt-4 flex flex-wrap gap-3">
              <input
                required
                minLength={5}
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                placeholder="paypal: you@example.com"
                className="w-full max-w-sm rounded-md border border-panel-edge bg-background px-3 py-2 font-mono text-sm outline-none focus:border-accent-dim"
              />
              <button
                type="submit"
                disabled={requesting}
                className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-zinc-950 hover:brightness-110 disabled:opacity-50 transition-[filter]"
              >
                {requesting ? "…" : `Request $${data.balanceUsd}`}
              </button>
            </form>
          ) : (
            <p className="mt-3 text-sm text-zinc-400">
              Payouts unlock at{" "}
              <span className="font-mono text-foreground">
                ${data?.minPayoutUsd ?? "10.00"}
              </span>{" "}
              available. Keep the spinner spinning.
            </p>
          )}
          {payoutMsg && (
            <p className="mt-3 text-sm text-accent">{payoutMsg}</p>
          )}
          {payouts.length > 0 && (
            <table className="mt-5 w-full text-left text-sm">
              <thead className="font-mono text-[11px] uppercase tracking-widest text-muted">
                <tr>
                  <th className="py-1.5 font-medium">requested</th>
                  <th className="py-1.5 font-medium">method</th>
                  <th className="py-1.5 font-medium text-right">amount</th>
                  <th className="py-1.5 font-medium text-right">status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-panel-edge">
                {payouts.map((p) => (
                  <tr key={p.id}>
                    <td className="py-2 text-muted">
                      {new Date(p.requestedAt).toLocaleDateString()}
                    </td>
                    <td className="py-2 font-mono text-xs">{p.method}</td>
                    <td className="py-2 text-right font-mono">${p.amountUsd}</td>
                    <td className="py-2 text-right">
                      <span
                        className={`font-mono text-[11px] uppercase ${
                          p.status === "paid"
                            ? "text-accent"
                            : p.status === "rejected"
                              ? "text-red-400"
                              : "text-amber-400"
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* Recent events */}
        <section className="mt-12">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-mono text-xs uppercase tracking-widest text-muted">
              recent credited events
            </h2>
            <Link
              href="/leaderboard"
              className="font-mono text-sm text-accent hover:underline underline-offset-4"
            >
              leaderboard →
            </Link>
          </div>
          {!data || data.events.length === 0 ? (
            <p className="font-mono text-sm text-muted">
              nothing yet — open Claude Code or Codex and let the spinner run.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-panel-edge">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-panel-edge bg-panel font-mono text-[11px] uppercase tracking-widest text-muted">
                  <tr>
                    <th className="px-3 py-2 font-medium">when</th>
                    <th className="px-3 py-2 font-medium">surface</th>
                    <th className="px-3 py-2 font-medium">type</th>
                    <th className="px-3 py-2 font-medium text-right">credited</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-panel-edge">
                  {data.events.map((e) => (
                    <tr key={e.id}>
                      <td className="px-3 py-2 text-muted">
                        {new Date(e.at).toLocaleTimeString()}
                      </td>
                      <td className="px-3 py-2">
                        {SURFACE_LABEL[e.surface] ?? e.surface}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">
                        {e.event === "view_threshold_met" ? "impression" : e.event}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-accent">
                        +${e.creditedUsd}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
      <Footer />
    </>
  );
}
