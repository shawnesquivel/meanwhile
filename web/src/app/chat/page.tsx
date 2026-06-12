"use client";

import { useEffect, useRef, useState } from "react";
import { Footer, Nav } from "@/components/nav";

/**
 * M4 experiment — "every model, one box, the wait pays."
 * Uses the same demo sponsor inventory as signed-out editors: sponsors are
 * fetched from the public portfolio API and shown ONLY while a model is
 * thinking. Clicks open the sponsor's URL; impressions here route to the
 * demo sink (nobody is credited — this page is a concept demo).
 */

const MODELS = [
  "openai/gpt-5.2",
  "anthropic/claude-sonnet-4.5",
  "google/gemini-3-flash",
  "meta-llama/llama-4-maverick",
  "deepseek/deepseek-v4",
  "mistralai/mistral-large-2512",
];

interface Msg {
  role: "user" | "assistant";
  content: string;
}

interface Sponsor {
  sponsorId: string;
  campaignId: string;
  text: string;
  brand?: string;
  clickUrl: string;
  sessionToken: string;
}

function useSponsors(): Sponsor[] {
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  useEffect(() => {
    fetch(`/api/v1/portfolio?surface=cc_webview&client_id=web_chat_demo`)
      .then((r) => r.json())
      .then((j) => setSponsors(j.sponsors ?? []))
      .catch(() => {});
  }, []);
  return sponsors;
}

/** The product moment: the waiting line IS the ad slot. */
function ThinkingLine({ sponsors }: { sponsors: Sponsor[] }) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (sponsors.length < 2) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % sponsors.length), 3500);
    return () => clearInterval(t);
  }, [sponsors.length]);

  const s = sponsors[idx];
  if (!s) {
    return (
      <p className="font-mono text-sm text-muted">
        <span className="mw-spinner" /> Thinking
        <span className="mw-cursor">…</span>
      </p>
    );
  }
  return (
    <p className="font-mono text-sm">
      <span className="mw-spinner" />{" "}
      <a
        href={s.clickUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-foreground underline-offset-4 hover:underline"
        onClick={() => {
          fetch("/api/v1/metrics", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              event: "click",
              sponsorId: s.sponsorId,
              campaignId: s.campaignId,
              surface: "cc_webview",
              clientId: "web_chat_demo",
              sessionToken: s.sessionToken,
              nonce: `chat_${crypto.randomUUID()}`,
              ts: new Date().toISOString(),
            }),
          }).catch(() => {});
        }}
      >
        {s.text}
      </a>
      <span className="mw-cursor">…</span>
      <span className="ml-3 font-mono text-[10px] uppercase tracking-widest text-muted">
        sponsored · meanwhile
      </span>
    </p>
  );
}

export default function ChatPage() {
  const sponsors = useSponsors();
  const [model, setModel] = useState(MODELS[0]);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinking]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || thinking) return;
    setInput("");
    const history: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(history);
    setThinking(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ model, messages: history }),
      });
      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => ({ error: "request failed" }));
        setMessages([
          ...history,
          { role: "assistant", content: `[error] ${j.error ?? res.status}` },
        ]);
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      let first = true;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        if (first) {
          // First token ends the "thinking" (sponsored) state.
          setThinking(false);
          first = false;
        }
        setMessages([...history, { role: "assistant", content: acc }]);
      }
    } finally {
      setThinking(false);
    }
  };

  return (
    <>
      <Nav />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-10">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-accent">
              experiment
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">
              Every model. One box. The wait pays.
            </h1>
          </div>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="rounded-md border border-panel-edge bg-panel px-3 py-2 font-mono text-xs outline-none focus:border-accent-dim"
          >
            {MODELS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1 space-y-4 rounded-lg border border-panel-edge bg-panel/40 p-4">
          {messages.length === 0 && !thinking && (
            <p className="py-10 text-center font-mono text-sm text-muted">
              Ask anything. Watch the thinking line — that{"'"}s the product.
            </p>
          )}
          {messages.map((m, i) => (
            <div key={i}>
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted">
                {m.role === "user" ? "you" : model.split("/")[1] ?? "model"}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">
                {m.content}
              </p>
            </div>
          ))}
          {thinking && (
            <div className="rounded-md border border-accent-dim/40 bg-background px-3 py-2.5">
              <ThinkingLine sponsors={sponsors} />
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <form onSubmit={send} className="mt-4 flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Message the model…"
            className="flex-1 rounded-md border border-panel-edge bg-panel px-3 py-2.5 text-sm outline-none focus:border-accent-dim"
          />
          <button
            type="submit"
            disabled={thinking || !input.trim()}
            className="rounded-md bg-accent px-5 py-2.5 text-sm font-semibold text-zinc-950 hover:brightness-110 disabled:opacity-50 transition-[filter]"
          >
            Send
          </button>
        </form>
        <p className="mt-3 text-center font-mono text-[11px] text-muted">
          concept demo — impressions here route to the demo sink and credit
          nobody. powered by openrouter when a key is configured.
        </p>
      </main>
      <Footer />
    </>
  );
}
