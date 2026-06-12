import { dlog } from "./log";

/** Error carrying the HTTP status so callers can branch on 401 etc. */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly bodyText: string,
  ) {
    super(`HTTP ${status}`);
  }
}

const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * Minimal JSON fetch with a hard timeout. The extension host ships Node 20+,
 * so global fetch/AbortController are available without dependencies.
 */
export async function fetchJson<T>(
  url: string,
  init?: RequestInit & { timeoutMs?: number },
): Promise<T> {
  const ctl = new AbortController();
  const t = setTimeout(
    () => ctl.abort(),
    init?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );
  try {
    const res = await fetch(url, {
      ...init,
      signal: ctl.signal,
      headers: {
        "content-type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
    const text = await res.text();
    if (!res.ok) throw new HttpError(res.status, text);
    return JSON.parse(text) as T;
  } catch (e) {
    if (!(e instanceof HttpError)) dlog("http", "fetch failed", { url, e: String(e) });
    throw e;
  } finally {
    clearTimeout(t);
  }
}
