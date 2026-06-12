import { describe, expect, it } from "vitest";
import {
  addRcBlock,
  hasRcBlock,
  removeRcBlock,
  RC_BEGIN,
  RC_END,
} from "../src/adapters/rc-edit";

const BIN = "/Users/x/.meanwhile/bin";

describe("rc block editing", () => {
  it("appends to an empty file", () => {
    const out = addRcBlock("", BIN);
    expect(out).toContain(RC_BEGIN);
    expect(out).toContain(`export PATH="${BIN}:$PATH"`);
    expect(out).toContain(RC_END);
  });

  it("appends after existing content with separation", () => {
    const src = "alias ll='ls -la'\n";
    const out = addRcBlock(src, BIN);
    expect(out.startsWith(src)).toBe(true);
    expect(out).toContain(RC_BEGIN);
  });

  it("is idempotent", () => {
    const once = addRcBlock("export A=1\n", BIN);
    const twice = addRcBlock(once, BIN);
    expect(twice).toBe(once);
    expect(twice.split(RC_BEGIN).length).toBe(2); // exactly one block
  });

  it("removes cleanly, restoring the original", () => {
    const src = "export A=1\nalias g=git\n";
    const roundTrip = removeRcBlock(addRcBlock(src, BIN));
    expect(roundTrip).toBe(src);
  });

  it("remove is a no-op without a block", () => {
    const src = "export A=1\n";
    expect(removeRcBlock(src)).toBe(src);
  });

  it("refreshes a stale block in place (old bin path replaced)", () => {
    const old = addRcBlock("x=1\n", "/old/bin");
    const fresh = addRcBlock(old, BIN);
    expect(fresh).not.toContain("/old/bin");
    expect(fresh).toContain(BIN);
    expect(fresh.split(RC_BEGIN).length).toBe(2);
  });

  it("hasRcBlock detects presence", () => {
    expect(hasRcBlock("")).toBe(false);
    expect(hasRcBlock(addRcBlock("", BIN))).toBe(true);
  });

  it("preserves content after the block when removing", () => {
    const withBlock = addRcBlock("before\n", BIN) + "after\n";
    const out = removeRcBlock(withBlock);
    expect(out).toContain("before\n");
    expect(out).toContain("after\n");
    expect(out).not.toContain(RC_BEGIN);
  });
});
