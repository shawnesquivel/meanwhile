"use client";

import { useEffect, useState } from "react";

interface QueueRow {
  rank: number;
  brand: string | null;
  text: string;
  tier: string;
  pricePerThousandUsd: string;
  impressionsServed: number;
  impressionsPurchased: number;
  demo: boolean;
}

/** Live sponsor queue — what's serving right now, in serve order. */
export function LiveQueue() {
  const [rows, setRows] = useState<QueueRow[] | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("/api/v1/queue")
        .then((r) => r.json())
        .then((j) => alive && setRows(j.queue ?? []))
        .catch(() => alive && setRows([]));
    load();
    const t = setInterval(load, 30_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  if (rows === null) {
    return <p className="font-mono text-sm text-muted">loading queue…</p>;
  }
  if (rows.length === 0) {
    return (
      <p className="font-mono text-sm text-muted">
        queue is empty — first sponsor serves instantly.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-panel-edge">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-panel-edge bg-panel font-mono text-[11px] uppercase tracking-widest text-muted">
          <tr>
            <th className="px-3 py-2 font-medium">#</th>
            <th className="px-3 py-2 font-medium">sponsor line</th>
            <th className="px-3 py-2 font-medium text-right">rate / 1k</th>
            <th className="px-3 py-2 font-medium text-right">delivered</th>
            <th className="px-3 py-2 font-medium text-right">status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-panel-edge">
          {rows.map((r) => (
            <tr key={r.rank} className="hover:bg-panel/60">
              <td className="px-3 py-2 font-mono text-muted">{r.rank}</td>
              <td className="px-3 py-2">
                <span className="text-foreground">{r.text}</span>
                {r.brand ? (
                  <span className="ml-2 font-mono text-xs text-muted">{r.brand}</span>
                ) : null}
              </td>
              <td className="px-3 py-2 text-right font-mono">
                ${r.pricePerThousandUsd}
              </td>
              <td className="px-3 py-2 text-right font-mono text-muted">
                {r.impressionsServed.toLocaleString()}
                {r.impressionsPurchased > 0
                  ? ` / ${r.impressionsPurchased.toLocaleString()}`
                  : ""}
              </td>
              <td className="px-3 py-2 text-right">
                {r.demo ? (
                  <span className="font-mono text-[11px] uppercase tracking-wider text-muted">
                    preview
                  </span>
                ) : (
                  <span className="font-mono text-[11px] uppercase tracking-wider text-accent">
                    live
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
