import Link from "next/link";
import { Footer, Nav } from "@/components/nav";
import { LiveQueue } from "@/components/queue";
import { SpinnerDemo } from "@/components/spinner-demo";

export default function Home() {
  return (
    <>
      <Nav />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4">
        {/* Hero */}
        <section className="py-16 sm:py-24">
          <p className="mb-4 font-mono text-xs uppercase tracking-[0.3em] text-accent">
            for people who watch spinners professionally
          </p>
          <h1 className="max-w-2xl text-4xl font-semibold tracking-tight sm:text-6xl">
            Get paid while the model thinks.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-zinc-400">
            Meanwhile replaces the {"\u201c"}Discombobulating…{"\u201d"} verb in your
            Claude Code and Codex spinners with one tasteful sponsor line.{" "}
            <span className="text-foreground">
              Half of every sponsored impression goes to you.
            </span>
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a
              href="https://github.com/shawnesquivel/meanwhile"
              className="rounded-md bg-accent px-5 py-2.5 text-sm font-semibold text-zinc-950 hover:brightness-110 transition-[filter]"
            >
              Install the extension
            </a>
            <Link
              href="/sponsor"
              className="rounded-md border border-panel-edge px-5 py-2.5 text-sm text-foreground hover:border-accent-dim transition-colors"
            >
              Sponsor a line →
            </Link>
          </div>
          <div className="mt-14">
            <SpinnerDemo />
          </div>
        </section>

        {/* How it works */}
        <section className="border-t border-panel-edge py-16">
          <h2 className="font-mono text-xs uppercase tracking-[0.3em] text-muted">
            how it works
          </h2>
          <div className="mt-8 grid gap-8 sm:grid-cols-3">
            <div>
              <p className="font-mono text-accent">01</p>
              <h3 className="mt-2 font-semibold">Install + sign in</h3>
              <p className="mt-2 text-sm text-zinc-400">
                One extension covers the Claude Code panel, the terminal CLI,
                and Codex. Before you sign in you see real sponsor lines as a
                preview — they earn nothing until you do.
              </p>
            </div>
            <div>
              <p className="font-mono text-accent">02</p>
              <h3 className="mt-2 font-semibold">Code like always</h3>
              <p className="mt-2 text-sm text-zinc-400">
                While the model works, the spinner shows a sponsor line instead
                of a made-up verb. No code, prompts, or completions are ever
                read. One click restores stock behavior byte-for-byte.
              </p>
            </div>
            <div>
              <p className="font-mono text-accent">03</p>
              <h3 className="mt-2 font-semibold">Split the revenue</h3>
              <p className="mt-2 text-sm text-zinc-400">
                Sponsors prepay fixed-price blocks — no auctions. 50% of every
                counted impression and click settles to the developer whose
                machine showed it.
              </p>
            </div>
          </div>
        </section>

        {/* Live queue */}
        <section className="border-t border-panel-edge py-16">
          <div className="mb-6 flex items-end justify-between">
            <div>
              <h2 className="font-mono text-xs uppercase tracking-[0.3em] text-muted">
                live queue
              </h2>
              <p className="mt-2 text-sm text-zinc-400">
                Fixed rates. Higher tier serves first, then first-come.
              </p>
            </div>
            <Link
              href="/sponsor"
              className="font-mono text-sm text-accent hover:underline underline-offset-4"
            >
              join the queue →
            </Link>
          </div>
          <LiveQueue />
        </section>

        {/* Principles */}
        <section className="border-t border-panel-edge py-16">
          <h2 className="font-mono text-xs uppercase tracking-[0.3em] text-muted">
            the deal
          </h2>
          <div className="mt-8 grid gap-x-12 gap-y-6 sm:grid-cols-2">
            {[
              [
                "Open source, end to end",
                "The extension, the patchers, and this backend are public. Audit what runs on your machine.",
              ],
              [
                "Reversible in one click",
                "Byte-exact backups of everything we touch. Restore puts every file back exactly as it was.",
              ],
              [
                "50/50, stated plainly",
                "Half of sponsor spend goes to the people showing the lines. The math is in the repo.",
              ],
              [
                "Sponsors, not trackers",
                "One line of text. No pixels, no fingerprinting, no reading your code or prompts. Ever.",
              ],
            ].map(([title, body]) => (
              <div key={title} className="flex gap-3">
                <span className="mt-1 text-accent">✱</span>
                <div>
                  <h3 className="font-semibold">{title}</h3>
                  <p className="mt-1 text-sm text-zinc-400">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
