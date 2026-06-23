import { describe, it, expect, beforeAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadDotEnv, readEnv } from "../src/env.js";

// A .env exercising every tricky case the parser must handle. Keys are
// test-specific so loadDotEnv (which won't overwrite existing vars) is reliable.
const DOTENV = [
  "T_INLINE=gsk_realkey   # this comment must be stripped",
  'T_QUOTED="value with # hash inside"',
  "T_PLAIN=simple",
  "T_EMPTY=",
  "T_HASH_ONLY=# only a comment",
  "# a full-line comment",
  "",
  "T_SPACED =  spaced value  ",
].join("\n");

beforeAll(() => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "engram-env-"));
  fs.writeFileSync(path.join(dir, ".env"), DOTENV);
  loadDotEnv(dir);
});

describe("loadDotEnv", () => {
  it("strips an unquoted inline comment (the bug that picked the wrong provider)", () => {
    expect(process.env.T_INLINE).toBe("gsk_realkey");
  });

  it("keeps a '#' that is inside a quoted value", () => {
    expect(process.env.T_QUOTED).toBe("value with # hash inside");
  });

  it("reads a plain value", () => {
    expect(process.env.T_PLAIN).toBe("simple");
  });

  it("treats a value that is only a comment as empty", () => {
    expect(process.env.T_HASH_ONLY).toBe("");
  });

  it("trims whitespace around key and value", () => {
    expect(process.env.T_SPACED).toBe("spaced value");
  });
});

describe("readEnv", () => {
  it("returns undefined for an empty value so defaults can apply", () => {
    expect(readEnv("T_EMPTY")).toBeUndefined();
  });

  it("returns undefined for a whitespace-only value", () => {
    process.env.T_WS = "   ";
    expect(readEnv("T_WS")).toBeUndefined();
  });

  it("returns the trimmed value when set", () => {
    expect(readEnv("T_PLAIN")).toBe("simple");
  });
});
