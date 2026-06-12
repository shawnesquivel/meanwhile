"use client";

import { useEffect, useState } from "react";
import { Footer, Nav } from "@/components/nav";

interface Board {
  earners: {
    rank: number;
    handle: string;
    earnedUsd: string;
    impressions: number;
    clicks: number;
  }[];
  sponsors: {
    rank: number;
    brand: string | null;
    text: string;
    tier: string;
    impressionsServed: number;
  }[];
  windowDays: number;
}

export default function LeaderboardPage() {
  const [board, setBoard] = useState<Board | null>(null);

  useEffect(() => {
    fetch("/api/v1/leaderboard")
      .then((r) => r.json())
      .then(setBoard)
      .catch(() => setBoard(null));
  }, []);

  return (
    <>
      <Nav />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-12">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-accent">
          leaderboard
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Professional spinner-watchers, ranked.
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          Last {board?.windowDays ?? 30} days. Earners are anonymized — your
          rank is between you and your spinner.
        </p>

        <div className="mt-10 grid gap-10 lg:grid-cols-2">
          <section>
            <h2 className="mb-4 font-mono text-xs uppercase tracking-widest text-muted">
              top earners
            </h2>
            {!board || board.earners.length === 0 ? (
              <p className="font-mono text-sm text-muted">
                no credited earnings yet — be the first.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-panel-edge">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-panel-edge bg-panel font-mono text-[11px] uppercase tracking-widest text-muted">
                    <tr>
                      <th className="px-3 py-2 font-medium">#</th>
                      <th className="px-3 py-2 font-medium">dev</th>
                      <th className="px-3 py-2 font-medium text-right">imps</th>
                      <th className="px-3 py-2 font-medium text-right">clicks</th>
                      <th className="px-3 py-2 font-medium text-right">earned</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-panel-edge">
                    {board.earners.map((e) => (
                      <tr key={e.handle}>
                        <td className="px-3 py-2 font-mono text-muted">{e.rank}</td>
                        <td className="px-3 py-2 font-mono">{e.handle}</td>
                        <td className="px-3 py-2 text-right font-mono text-muted">
                          {e.impressions.toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-muted">
                          {e.clicks.toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-accent">
                          ${e.earnedUsd}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section>
            <h2 className="mb-4 font-mono text-xs uppercase tracking-widest text-muted">
              top sponsors
            </h2>
            {!board || board.sponsors.length === 0 ? (
              <p className="font-mono text-sm text-muted">no sponsors yet.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-panel-edge">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-panel-edge bg-panel font-mono text-[11px] uppercase tracking-widest text-muted">
                    <tr>
                      <th className="px-3 py-2 font-medium">#</th>
                      <th className="px-3 py-2 font-medium">line</th>
                      <th className="px-3 py-2 font-medium text-right">served</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-panel-edge">
                    {board.sponsors.map((s) => (
                      <tr key={`${s.rank}-${s.text}`}>
                        <td className="px-3 py-2 font-mono text-muted">{s.rank}</td>
                        <td className="px-3 py-2">
                          {s.text}
                          {s.brand ? (
                            <span className="ml-2 font-mono text-xs text-muted">
                              {s.brand}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-muted">
                          {s.impressionsServed.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
