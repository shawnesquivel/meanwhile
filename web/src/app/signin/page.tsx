"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { signIn, signUp, useSession } from "@/lib/auth-client";
import { Footer, Nav } from "@/components/nav";

function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/dashboard";
  const { data: session } = useSession();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (session?.user) router.replace(next);
  }, [session?.user, next, router]);

  if (session?.user) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res =
        mode === "signin"
          ? await signIn.email({ email, password })
          : await signUp.email({ email, password, name: name || email.split("@")[0] });
      if (res.error) {
        setError(res.error.message ?? "Something went wrong");
      } else {
        router.replace(next);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-sm">
      <h1 className="text-2xl font-semibold tracking-tight">
        {mode === "signin" ? "Sign in" : "Create your account"}
      </h1>
      <p className="mt-2 text-sm text-zinc-400">
        {mode === "signin"
          ? "Your earnings and campaigns live here."
          : "Takes ten seconds. Email + password."}
      </p>

      <form onSubmit={submit} className="mt-8 space-y-4">
        {mode === "signup" && (
          <input
            type="text"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border border-panel-edge bg-panel px-3 py-2 text-sm outline-none focus:border-accent-dim"
          />
        )}
        <input
          type="email"
          required
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-md border border-panel-edge bg-panel px-3 py-2 text-sm outline-none focus:border-accent-dim"
        />
        <input
          type="password"
          required
          minLength={8}
          placeholder="Password (8+ characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-md border border-panel-edge bg-panel px-3 py-2 text-sm outline-none focus:border-accent-dim"
        />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-md bg-accent px-4 py-2 text-sm font-semibold text-zinc-950 hover:brightness-110 disabled:opacity-50 transition-[filter]"
        >
          {busy ? "…" : mode === "signin" ? "Sign in" : "Create account"}
        </button>
      </form>

      <button
        onClick={() => {
          setMode(mode === "signin" ? "signup" : "signin");
          setError(null);
        }}
        className="mt-4 text-sm text-muted hover:text-foreground transition-colors"
      >
        {mode === "signin"
          ? "New here? Create an account →"
          : "Already have an account? Sign in →"}
      </button>

      <p className="mt-8 text-xs text-muted">
        Connecting your editor?{" "}
        <Link href="/" className="text-accent hover:underline">
          Run Meanwhile: Sign in from the status bar
        </Link>{" "}
        and the extension will bring you to the right place.
      </p>
    </div>
  );
}

export default function SignInPage() {
  return (
    <>
      <Nav />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-20">
        <Suspense>
          <SignInForm />
        </Suspense>
      </main>
      <Footer />
    </>
  );
}
