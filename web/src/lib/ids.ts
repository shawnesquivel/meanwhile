import { createHash, randomBytes, randomUUID } from "node:crypto";

/** Prefixed, URL-safe id: `cmp_3f8a…`. The prefix makes ids self-describing
 *  in logs and prevents cross-table id mixups. */
export function newId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, "")}`;
}

/** A high-entropy opaque token (for ext auth state / access / refresh). */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/** Stable hex digest — we store hashes of opaque tokens, never the tokens. */
export function sha256hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}
