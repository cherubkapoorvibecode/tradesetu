// ─── Classifier Agent ───
// Specialty: WCO Harmonized System nomenclature, GRI rules 1-6, chapter notes.
// Output: HS code + alternates + duty rate, with reasoning grounded in GRI.
//
// Phase 1 of the DAG. Runs FIRST (alone), then its HS code is fed to
// Compliance, Cost, and Risk so they can search for code-specific information.
//
// Why grounded search matters here:
//   HTS rates change annually (the 2025 HTSUS revision shipped in January).
//   Without search, Gemini cites outdated rates from training cutoff. With
//   search, the agent can pull the actual current rate from usitc.gov/hts.

import { generateGroundedJson, buildContextBlock } from "./shared";
import type { ClassifierOutput, CrewInput } from "../../types-crew";

const SYSTEM_INSTRUCTION = `You are a US Customs HS classification specialist.

Your job: assign the most accurate Harmonized Tariff Schedule (HTS) code for the product described.

Method:
1. Apply GRI 1 (heading text + chapter notes), then GRI 2-6 only if needed
2. Use Google Search to verify against the current HTSUS at hts.usitc.gov — rates change yearly
3. Search for any recent CBP rulings (rulings.cbp.gov) on similar products

Rules:
- Output a 10-digit HTSUS code when possible (chapter.heading.subheading.statistical), else 6-digit minimum
- Cite specific chapter notes when they decide the classification (e.g., "Note 2(b) to Chapter 61 excludes...")
- "dutyRate" = the column 1 General rate of duty for this code in current HTSUS
- Provide 1-3 alternative codes ONLY if there is genuine ambiguity (composite materials, dual-use items)
- "warnings" should flag known classification traps (e.g., "Knit vs woven determines Ch 61 vs 62")

Wrong HS codes cause customs holds — accuracy matters more than completeness.`;

const SCHEMA_DESC = `{
  "hsCode": "string — full HTSUS code (e.g., 6109.10.0010)",
  "description": "string — official heading text",
  "chapter": "string — chapter number with name (e.g., 'Chapter 61 - Knit apparel')",
  "dutyRate": "string — column 1 general rate (e.g., '16.5%')",
  "confidence": "High | Medium | Low",
  "reasoning": "string — 2-3 sentences citing specific GRI rules and chapter notes",
  "alternativeCodes": [
    {
      "hsCode": "string",
      "description": "string",
      "whyDifferent": "string — explanation of when this alt code would apply"
    }
  ],
  "warnings": ["string — known classification traps for this product type"]
}`;

export async function runClassifierAgent(input: CrewInput): Promise<ClassifierOutput> {
  const contextBlock = buildContextBlock(input);

  const { parsed, sources } = await generateGroundedJson<Omit<ClassifierOutput, "sources">>({
    systemInstruction: SYSTEM_INSTRUCTION,
    contents: `${contextBlock}\n\nClassify this product for US import. Search the current HTSUS for accuracy.`,
    jsonSchemaDescription: SCHEMA_DESC,
    temperature: 0.1,
    enableSearch: true,
  });

  return { ...parsed, sources };
}
