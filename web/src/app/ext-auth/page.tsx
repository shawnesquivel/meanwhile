"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { useSession } from "@/lib/auth-client";
import { Footer, Nav } from "@/components/nav";

type BindState = "checking" | "binding" | "done" | "expired" | "missing";

/**
 * The browser half of the extension sign-in. The extension opened this URL
 * with its `state`; once a web session exists we bind it and the editor's
 * polling picks up tokens within a couple seconds.
 */
function ExtAuthInner() {
  const params = useSearchParams();
  const router = useRouter();
  const state = params.get("state") || "";
  const { data: session, isPending } = useSession();
  const [status, setStatus] = useState<BindState>("checking");
  const fired = useRef(false);

  useEffect(() => {
    if (!state) {
      setStatus("missing");
      return;
    }
    if (isPending) return;
    if (!session?.user) {
      router.replace(`/signin?next=${encodeURIComponent(`/ext-auth?state=${state}`)}`);
      return;
    }
    if (fired.current) return;
    fired.current = true;
    setStatus("binding");
    fetch("/api/v1/ext/auth/bind", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ state }),
    })
      .then((r) => setStatus(r.ok ? "done" : "expired"))
      .catch(() => setStatus("expired"));
  }, [state, session, isPending, router]);

  return (
    <div className="mx-auto w-full max-w-md text-center">
      <p className="font-mono text-5xl">
        <span className="text-accent">✱</span>
      </p>
      {status === "done" ? (
        <>
          <h1 className="mt-6 text-3xl font-semibold tracking-tight">
            You{"'"}re in.
          </h1>
          <p className="mt-3 text-zinc-400">
            Your editor is connected. Every sponsor line your spinner shows
            from here quietly earns you money — 50/50 split, no clicks
            required.
          </p>
          <p className="mt-6 inline-block rounded-full border border-accent-dim/60 bg-panel px-4 py-1.5 font-mono text-sm text-accent">
            ● signed in · you can close this tab
          </p>
          <p className="mt-6 font-mono text-xs text-muted">
            the spinner does the earning from here.
          </p>
        </>
      ) : status === "expired" ? (
        <>
          <h1 className="mt-6 text-3xl font-semibold tracking-tight">
            That link expired.
          </h1>
          <p className="mt-3 text-zinc-400">
            Sign-in links from the editor are valid for 10 minutes. Run{" "}
            <span className="font-mono text-foreground">Meanwhile: Sign in</span>{" "}
            again from the status bar.
          </p>
        </>
      ) : status === "missing" ? (
        <>
          <h1 className="mt-6 text-3xl font-semibold tracking-tight">
            Missing state.
          </h1>
          <p className="mt-3 text-zinc-400">
            This page is meant to be opened by the Meanwhile extension. Run{" "}
            <span className="font-mono text-foreground">Meanwhile: Sign in</span>{" "}
            from your editor.
          </p>
        </>
      ) : (
        <>
          <h1 className="mt-6 text-3xl font-semibold tracking-tight">
            Connecting your editor…
          </h1>
          <p className="mt-3 font-mono text-sm text-muted">
            <span className="mw-spinner" /> binding session
          </p>
        </>
      )}
    </div>
  );
}

export default function ExtAuthPage() {
  return (
    <>
      <Nav />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-24">
        <Suspense>
          <ExtAuthInner />
        </Suspense>
      </main>
      <Footer />
    </>
  );
}
