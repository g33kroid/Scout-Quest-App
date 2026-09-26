import "server-only";
import { getLlmApiKey } from "@/lib/server/env";

export type TranslatableLocale = "en" | "ar";

export interface QuestTranslationInput {
  sourceLocale: TranslatableLocale;
  targetLocale: TranslatableLocale;
  title: string;
  flavour: string | null;
  description: string;
}

export interface QuestTranslationResult {
  ok: boolean;
  title?: string;
  flavour?: string | null;
  description?: string;
  error?: string;
}

export interface Translator {
  translateQuest(input: QuestTranslationInput): Promise<QuestTranslationResult>;
}

// Consistency across 20 leaders depends on shared terms translating the
// same way every time (docs/tasks/11-bilingual.md) — passed in the prompt
// rather than left to the model to invent per call. Invented terms only
// (CLAUDE.md — no real data); a real deploy would extend this from the
// units/patrols/badges tables rather than a static list.
const GLOSSARY: Record<string, string> = {
  Scout: "كشاف",
  Leader: "قائد",
  Patrol: "فصيلة",
  Quest: "مهمة",
  Unit: "وحدة",
  Badge: "شارة",
};

function buildPrompt(input: QuestTranslationInput): string {
  const sourceName = input.sourceLocale === "ar" ? "Arabic" : "English";
  const targetName = input.targetLocale === "ar" ? "Arabic" : "English";
  const glossaryLines = Object.entries(GLOSSARY).map(([en, ar]) => `- "${en}" ↔ "${ar}"`);

  return [
    `Translate this scouting activity ("quest") from ${sourceName} to ${targetName}.`,
    `Glossary — use these exact terms wherever they appear, in either direction:`,
    glossaryLines.join("\n"),
    `Return strictly a JSON object with keys "title", "flavour" (string or null), and "description". No other text, no markdown fences.`,
    `Title: ${input.title}`,
    `Flavour: ${input.flavour ?? ""}`,
    `Description: ${input.description}`,
  ].join("\n\n");
}

// Real translation call — server-side only, the API key never reaches the
// client (docs/tasks/11-bilingual.md). Haiku: a short, low-stakes text
// transform, not a task that needs a larger model.
class AnthropicTranslator implements Translator {
  constructor(private readonly apiKey: string) {}

  async translateQuest(input: QuestTranslationInput): Promise<QuestTranslationResult> {
    if (!this.apiKey) {
      return { ok: false, error: "Translation is not configured on this server." };
    }

    let response: Response;
    try {
      response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": this.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1024,
          messages: [{ role: "user", content: buildPrompt(input) }],
        }),
      });
    } catch {
      return { ok: false, error: "Translation service is unavailable." };
    }

    if (!response.ok) {
      return { ok: false, error: `Translation service returned ${response.status}.` };
    }

    const data = (await response.json()) as {
      content?: { type: string; text?: string }[];
    };
    const text = data.content?.find((block) => block.type === "text")?.text;
    if (!text) {
      return { ok: false, error: "Translation service returned no content." };
    }

    let parsed: { title?: string; flavour?: string | null; description?: string };
    try {
      parsed = JSON.parse(text);
    } catch {
      return { ok: false, error: "Translation service returned an unreadable result." };
    }
    if (!parsed.title || !parsed.description) {
      return { ok: false, error: "Translation service returned an incomplete result." };
    }

    return {
      ok: true,
      title: parsed.title,
      flavour: parsed.flavour ?? null,
      description: parsed.description,
    };
  }
}

// Deterministic, no network call at all — the task's own test case
// ("no network call to the LLM occurs on any read path") plus ordinary CI
// hygiene: this must never depend on, or pay for, a real model call.
class StubTranslator implements Translator {
  async translateQuest(input: QuestTranslationInput): Promise<QuestTranslationResult> {
    return {
      ok: true,
      title: `[${input.targetLocale}] ${input.title}`,
      flavour: input.flavour ? `[${input.targetLocale}] ${input.flavour}` : null,
      description: `[${input.targetLocale}] ${input.description}`,
    };
  }
}

const isE2eTestMode = process.env.E2E_TEST_MODE === "true";
let translator: Translator = isE2eTestMode
  ? new StubTranslator()
  : new AnthropicTranslator(getLlmApiKey());

export function getTranslator(): Translator {
  return translator;
}

// Test-only seam — never used by production code paths.
export function _setTranslatorForTests(next: Translator): void {
  translator = next;
}
