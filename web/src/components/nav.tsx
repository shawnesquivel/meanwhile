import Link from "next/link";

export function Nav() {
  return (
    <header className="border-b border-panel-edge">
      <nav className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4">
        <Link href="/" className="font-mono text-sm font-semibold tracking-tight">
          <span className="text-accent">✱</span> meanwhile
        </Link>
        <div className="flex items-center gap-5 text-sm text-muted">
          <Link href="/sponsor" className="hover:text-foreground transition-colors">
            Sponsor a line
          </Link>
          <Link href="/dashboard" className="hover:text-foreground transition-colors">
            Earnings
          </Link>
          <Link
            href="/signin"
            className="rounded-md border border-panel-edge px-3 py-1.5 text-foreground hover:border-accent-dim hover:text-accent transition-colors"
          >
            Sign in
          </Link>
        </div>
      </nav>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="mt-auto border-t border-panel-edge">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-2 px-4 py-8 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
        <p>
          <span className="text-accent">✱</span> meanwhile — built for people who
          watch spinners professionally.
        </p>
        <p className="font-mono">
          open source · fully reversible · your machine, your cut
        </p>
      </div>
    </footer>
  );
}
