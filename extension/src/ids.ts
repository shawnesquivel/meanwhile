import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { meanwhileDir } from "./config";

/**
 * Stable anonymous device id. Minted once, persisted in ~/.meanwhile, and
 * reused across editor restarts so impressions from one machine aggregate.
 * Not derived from any hardware identifier.
 */
export function deviceId(): string {
  const file = join(meanwhileDir(), "device.json");
  try {
    const j = JSON.parse(readFileSync(file, "utf8")) as { clientId?: string };
    if (j && typeof j.clientId === "string" && j.clientId.length >= 8) {
      return j.clientId;
    }
  } catch {
    /* mint below */
  }
  const id = `dev_${randomBytes(12).toString("base64url")}`;
  try {
    writeFileSync(file, JSON.stringify({ clientId: id }, null, 2) + "\n", {
      mode: 0o600,
    });
  } catch {
    /* still usable in-memory for this session */
  }
  return id;
}

/** Unique per-event nonce for metric dedupe. */
export function eventNonce(): string {
  return randomUUID();
}
