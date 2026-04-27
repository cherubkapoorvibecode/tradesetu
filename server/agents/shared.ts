import { GoogleGenAI } from "@google/genai";
import type { AgentSource } from "../../types-crew";

const MODEL = "gemini-2.5-flash";

export function getCrewClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "PLACEHOLDER_API_KEY") {
    throw new Error("GEMINI_API_KEY not configured. Set it in .env.local");
  }
  return new GoogleGenAI({ apiKey });
}

export const CREW_MODEL = MODEL;

// Strip ```json ... ``` fences if Gemini wraps output even when asked not to.
// Also strips any leading/trailing prose the model sometimes adds before JSON
// when grounded with web search (a known quirk of tool-use mode).
export function sanitizeJson(text: string): string {
  let out = text.trim();
  // Strip ``` fences
  out = out.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  // If the model added prose, find the first { or [ and last } or ]
  const firstBrace = Math.min(
    ...[out.indexOf("{"), out.indexOf("[")].filter(i => i !== -1),
  );
  const lastBrace = Math.max(out.lastIndexOf("}"), out.lastIndexOf("]"));
  if (firstBrace !== Infinity && lastBrace > firstBrace) {
    out = out.slice(firstBrace, lastBrace + 1);
  }
  return out;
}

// Build the shared "context block" each agent gets prepended.
// Each specialist sees the same product context but gets a different
// system instruction + output schema, so attention stays focused.
export function buildContextBlock(input: {
  productName: string;
  category: string;
  description: string;
  materials?: string;
  countryOfManufacture: string;
  destinationCountry: string;
  intendedUse?: string;
  channel?: string;
  isFirstShipment?: boolean;
}): string {
  return `
PRODUCT CONTEXT
Product Name:     ${input.productName}
Category:         ${input.category}
Description:      ${input.description}
Materials:        ${input.materials || "(not specified)"}
Origin:           ${input.countryOfManufacture}
Destination:      ${input.destinationCountry}
Intended Use:     ${input.intendedUse || "General Consumer"}
Channel:          ${input.channel || "(not specified)"}
First Shipment:   ${input.isFirstShipment ? "Yes" : "No"}
  `.trim();
}

// Extract grounding sources from a Gemini response. Sources come from
// `candidates[0].groundingMetadata.groundingChunks`, each with a `.web.uri`.
// We dedupe by URI, cap at 8 per agent, and fall back to empty array.
export function extractSources(response: any): AgentSource[] {
  const chunks: any[] =
    response?.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

  const seen = new Set<string>();
  const out: AgentSource[] = [];
  for (const chunk of chunks) {
    const web = chunk?.web;
    if (!web?.uri || seen.has(web.uri)) continue;
    seen.add(web.uri);
    out.push({
      uri: web.uri,
      title: web.title || new URL(web.uri).hostname,
    });
    if (out.length >= 8) break;
  }
  return out;
}

// ─── Grounded JSON Generation ───────────────────────────────────────
//
// Why this helper exists:
//   The Google GenAI SDK doesn't allow `responseSchema` AND `googleSearch`
//   tool together — Gemini either refuses the request or ignores the schema.
//   So when we want web grounding, we have to:
//     1. Embed the JSON schema in the system instruction as a string
//     2. Add the googleSearch tool
//     3. Manually parse the response, with one retry if parsing fails
//
//   This trades strict-schema enforcement for the much bigger benefit of
//   responses grounded in current real-world data (HTS rates that change
//   yearly, FDA guidance that updates monthly, etc.).

export interface GroundedJsonRequest {
  systemInstruction: string;
  contents: string;
  jsonSchemaDescription: string;     // human-readable schema spec inlined into prompt
  temperature?: number;
  enableSearch?: boolean;            // default true
}

export interface GroundedJsonResult<T> {
  parsed: T;
  sources: AgentSource[];
}

export async function generateGroundedJson<T>(req: GroundedJsonRequest): Promise<GroundedJsonResult<T>> {
  const ai = getCrewClient();
  const useSearch = req.enableSearch !== false;

  const fullSystem = `${req.systemInstruction}

OUTPUT FORMAT — STRICT
Respond with a SINGLE JSON object that exactly matches this structure:
${req.jsonSchemaDescription}

Rules:
- Output ONLY the JSON object. No markdown fences. No prose before or after.
- All required fields must be present. Omit nothing.
- Use double quotes for all strings.
- ${useSearch ? "Use the search tool to ground your facts in current sources (HTS rates, regulations, port advisories). Cite agencies by name." : "Use only your training knowledge."}`;

  const response = await ai.models.generateContent({
    model: CREW_MODEL,
    contents: req.contents,
    config: {
      systemInstruction: fullSystem,
      temperature: req.temperature ?? 0.2,
      ...(useSearch ? { tools: [{ googleSearch: {} }] } : {}),
    },
  });

  const text = response.text || "";
  const sources = useSearch ? extractSources(response) : [];

  // Try parsing. If parse fails, attempt one repair pass.
  let parsed: T;
  try {
    parsed = JSON.parse(sanitizeJson(text)) as T;
  } catch (firstErr) {
    // Repair pass: ask the model to fix its own output to be valid JSON.
    console.warn("[Crew] First parse failed, retrying with repair prompt...");
    const repair = await ai.models.generateContent({
      model: CREW_MODEL,
      contents: `The following response was supposed to be valid JSON but failed to parse. Fix it. Output only the corrected JSON object, nothing else.\n\nORIGINAL:\n${text}`,
      config: { temperature: 0 },
    });
    parsed = JSON.parse(sanitizeJson(repair.text || "")) as T;
  }

  return { parsed, sources };
}
