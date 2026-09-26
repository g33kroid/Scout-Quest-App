import { describe, expect, it, afterEach } from "vitest";
import { getLlmApiKey, getSupabaseServiceRoleKey } from "./env";

describe("getSupabaseServiceRoleKey", () => {
  const original = process.env.SUPABASE_SERVICE_ROLE_KEY;

  afterEach(() => {
    if (original === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = original;
  });

  it("throws when the var is missing", () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    expect(() => getSupabaseServiceRoleKey()).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
  });

  it("returns the value when set", () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
    expect(getSupabaseServiceRoleKey()).toBe("test-key");
  });
});

describe("getLlmApiKey", () => {
  const original = process.env.LLM_API_KEY;

  afterEach(() => {
    if (original === undefined) delete process.env.LLM_API_KEY;
    else process.env.LLM_API_KEY = original;
  });

  it("returns an empty string when unset, rather than throwing", () => {
    delete process.env.LLM_API_KEY;
    expect(getLlmApiKey()).toBe("");
  });

  it("returns the value when set", () => {
    process.env.LLM_API_KEY = "test-llm-key";
    expect(getLlmApiKey()).toBe("test-llm-key");
  });
});
