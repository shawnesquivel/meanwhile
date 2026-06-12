import { describe, expect, it } from "vitest";
import {
  applySponsorSettings,
  isOurStatusLine,
  revertSponsorSettings,
  STATUSLINE_MARKER,
} from "../src/adapters/settings-edit";

const CMD = `node "/Users/x/.meanwhile/statusline.mjs"`;
const VERBS = ["Try Linear — Linear", "Neon — serverless Postgres"];

const apply = (
  src: string,
  over: Partial<Parameters<typeof applySponsorSettings>[1]> = {},
) =>
  applySponsorSettings(src, {
    statuslineCommand: CMD,
    verbs: VERBS,
    overwriteForeignVerbs: false,
    ...over,
  });

describe("applySponsorSettings", () => {
  it("patches an empty file", () => {
    const r = apply("");
    const j = JSON.parse(r.next);
    expect(j.statusLine).toEqual({ type: "command", command: CMD, padding: 0 });
    expect(j.spinnerVerbs).toEqual({ mode: "replace", verbs: VERBS });
    expect(r.changed).toBe(true);
    expect(r.conflicts).toEqual([]);
  });

  it("preserves every unrelated key, byte-for-byte on values", () => {
    const src = JSON.stringify(
      {
        enabledPlugins: { "composio-mcp@composio": true },
        extraKnownMarketplaces: { composio: { source: { path: "/x" } } },
        model: "opus",
      },
      null,
      2,
    );
    const r = apply(src);
    const j = JSON.parse(r.next);
    expect(j.enabledPlugins).toEqual({ "composio-mcp@composio": true });
    expect(j.extraKnownMarketplaces.composio.source.path).toBe("/x");
    expect(j.model).toBe("opus");
  });

  it("refuses to clobber a user statusLine", () => {
    const src = JSON.stringify({
      statusLine: { type: "command", command: "my-own-script.sh" },
    });
    const r = apply(src);
    const j = JSON.parse(r.next);
    expect(j.statusLine.command).toBe("my-own-script.sh");
    expect(r.conflicts).toContain("statusline_foreign");
    // verbs still applied
    expect(j.spinnerVerbs).toEqual({ mode: "replace", verbs: VERBS });
  });

  it("refuses to clobber user spinnerVerbs unless ownership proven", () => {
    const src = JSON.stringify({
      spinnerVerbs: { mode: "append", verbs: ["Pondering"] },
    });
    const r = apply(src);
    expect(JSON.parse(r.next).spinnerVerbs).toEqual({
      mode: "append",
      verbs: ["Pondering"],
    });
    expect(r.conflicts).toContain("spinnerverbs_foreign");

    const r2 = apply(src, { overwriteForeignVerbs: true });
    expect(JSON.parse(r2.next).spinnerVerbs).toEqual({
      mode: "replace",
      verbs: VERBS,
    });
    expect(r2.conflicts).toEqual([]);
  });

  it("is idempotent: re-applying changes nothing", () => {
    const r1 = apply("{}");
    const r2 = apply(r1.next, { overwriteForeignVerbs: true });
    expect(r2.changed).toBe(false);
    expect(r2.next).toBe(r1.next);
  });

  it("rotates verbs in place when ours", () => {
    const r1 = apply("{}");
    const r2 = apply(r1.next, {
      verbs: ["New sponsor line"],
      overwriteForeignVerbs: true,
    });
    expect(JSON.parse(r2.next).spinnerVerbs).toEqual({
      mode: "replace",
      verbs: ["New sponsor line"],
    });
    expect(r2.changed).toBe(true);
  });

  it("throws on unparseable settings instead of destroying them", () => {
    expect(() => apply("{ not json")).toThrow();
    expect(() => apply("[1,2]")).toThrow();
  });
});

describe("revertSponsorSettings", () => {
  it("round-trips an empty original exactly", () => {
    const r = apply("{}");
    const reverted = revertSponsorSettings(r.next, r.prev);
    expect(JSON.parse(reverted)).toEqual({});
  });

  it("round-trips a real-world settings file", () => {
    const original = {
      enabledPlugins: { "vercel@claude-plugins-official": true },
      model: "opus",
    };
    const src = JSON.stringify(original, null, 2);
    const r = apply(src);
    const reverted = revertSponsorSettings(r.next, r.prev);
    expect(JSON.parse(reverted)).toEqual(original);
  });

  it("restores the user's own prior statusLine and verbs", () => {
    const original = {
      statusLine: { type: "command", command: "mine.sh" },
      spinnerVerbs: { mode: "append", verbs: ["Pondering"] },
    };
    // Simulate a forced takeover (user opted in), then restore.
    const r = applySponsorSettings(JSON.stringify(original), {
      statuslineCommand: CMD,
      verbs: VERBS,
      overwriteForeignVerbs: true,
    });
    // statusLine stays foreign (we never clobber), spinnerVerbs became ours.
    const reverted = revertSponsorSettings(r.next, r.prev);
    expect(JSON.parse(reverted)).toEqual(original);
  });

  it("leaves keys Claude rewrote after patching untouched", () => {
    const r = apply("{}");
    const j = JSON.parse(r.next);
    j.somethingClaudeAdded = { a: 1 };
    const reverted = revertSponsorSettings(JSON.stringify(j), r.prev);
    expect(JSON.parse(reverted)).toEqual({ somethingClaudeAdded: { a: 1 } });
  });
});

describe("isOurStatusLine", () => {
  it("identifies by marker", () => {
    expect(isOurStatusLine({ command: `node x/${STATUSLINE_MARKER}` })).toBe(true);
    expect(isOurStatusLine({ command: "other.sh" })).toBe(false);
    expect(isOurStatusLine(undefined)).toBe(false);
    expect(isOurStatusLine("string")).toBe(false);
  });
});
