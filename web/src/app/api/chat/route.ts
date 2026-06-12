import type { NextRequest } from "next/server";
import { z } from "zod";
import { env } from "@/env";
import { jsonResponse } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * M4 experiment: OpenRouter pass-through with a plain-text stream back to
 * the chat page. Without OPENROUTER_API_KEY we stream a canned demo reply so
 * the page (and its sponsored waiting state) is fully demoable offline.
 */

const bodySchema = z.object({
  model: z.string().min(1).max(100),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant", "system"]),
        content: z.string().max(8000),
      }),
    )
    .min(1)
    .max(40),
});

const DEMO_REPLY =
  "This is the offline demo reply — no OPENROUTER_API_KEY is configured, " +
  "so Meanwhile streamed this text locally instead of calling a model. " +
  "The interesting part already happened: while you were waiting, the " +
  "thinking line was a sponsor slot. That's the whole experiment — every " +
  "model wait, on every surface, can pay the person waiting.";

function demoStream(): Response {
  const encoder = new TextEncoder();
  const words = DEMO_REPLY.split(" ");
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      // Simulate realistic model latency: a thinking pause, then tokens.
      await new Promise((r) => setTimeout(r, 2500));
      for (const w of words) {
        controller.enqueue(encoder.encode(w + " "));
        await new Promise((r) => setTimeout(r, 28));
      }
      controller.close();
    },
  });
  return new Response(stream, {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonResponse({ error: "invalid input" }, 400);

  if (!env.OPENROUTER_API_KEY) return demoStream();

  const upstream = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
      "content-type": "application/json",
      "HTTP-Referer": env.NEXT_PUBLIC_APP_URL,
      "X-Title": "Meanwhile Chat",
    },
    body: JSON.stringify({
      model: parsed.data.model,
      messages: parsed.data.messages,
      stream: true,
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => "");
    return jsonResponse(
      { error: `openrouter ${upstream.status}`, detail: detail.slice(0, 300) },
      502,
    );
  }

  // Re-encode OpenRouter's SSE into a plain text stream of content deltas.
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buf = "";
  const transform = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      buf += decoder.decode(chunk, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        const data = line.replace(/^data: ?/, "").trim();
        if (!data || data === "[DONE]" || !line.startsWith("data")) continue;
        try {
          const j = JSON.parse(data);
          const delta: string = j.choices?.[0]?.delta?.content ?? "";
          if (delta) controller.enqueue(encoder.encode(delta));
        } catch {
          /* keepalive comment or partial frame */
        }
      }
    },
  });

  return new Response(upstream.body.pipeThrough(transform), {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
