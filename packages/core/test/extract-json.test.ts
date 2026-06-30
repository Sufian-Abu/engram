import { describe, it, expect } from "vitest";
import { extractJson } from "../src/llm-client.js";

describe("extractJson (JSON-mode fallback parser)", () => {
  it("parses a bare JSON object", () => {
    expect(extractJson('{"title":"Hi","topics":["a"]}')).toEqual({ title: "Hi", topics: ["a"] });
  });

  it("strips ```json code fences", () => {
    const text = '```json\n{"title":"Fenced"}\n```';
    expect(extractJson(text)).toEqual({ title: "Fenced" });
  });

  it("slices the object out of surrounding prose", () => {
    const text = 'Sure! Here is the entry:\n{"title":"Sliced","summary":"x"}\nHope that helps.';
    expect(extractJson(text)).toEqual({ title: "Sliced", summary: "x" });
  });

  it("returns null when there's no JSON", () => {
    expect(extractJson("I cannot help with that.")).toBeNull();
    expect(extractJson("")).toBeNull();
  });
});
