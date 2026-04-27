// ─── Cost Agent ───
// Specialty: Landed cost math — duty rates, MPF, HMF, broker fees, FTAs.
// Phase 2 — receives the Classifier's HS code AND its duty rate. Searches
// for the actual current column 1 rate, MPF schedule, and any FTA preferences.
//
// Why grounded search matters here:
//   - HTS rates are published yearly; without search, the agent guesses
//   - MPF caps changed in 2024 ($634 max from $597)
//   - GSP for India expired 2020 — agent might still claim eligibility from
//     stale training data unless it searches for current status
//   - Section 301 / Section 232 / IEEPA tariffs change frequently

import { generateGroundedJson, buildContextBlock } from "./shared";
import type { CostOutput, CrewInput, ClassifierOutput } from "../../types-crew";

const SYSTEM_INSTRUCTION = `You are a US import cost analyst with real-time access to current tariff schedules.

Your job: decompose the FULL landed-cost stack so the exporter knows exactly what to add to their FOB price.

Method:
1. Use Google Search to verify:
   - The column 1 General duty rate at hts.usitc.gov for the supplied HS code
   - Any Section 301 (China), Section 232 (steel/aluminum), or IEEPA additional duties currently in effect
   - The current MPF rate and caps (CBP publishes annually)
   - The current HMF rate (0.125% of value for ocean cargo)
   - Whether GSP, IPEF, or any bilateral FTA is currently active for the origin country
2. If the Classifier provided an HS code, anchor your duty calculation on THAT specific code's rate (not a chapter average)
3. Search for any pending tariff changes (Federal Register notices) that could affect this shipment

Rules:
- Always break out: Import Duty (specific to HS code), MPF (0.3464% min $32 max $634), HMF (0.125% on ocean), Broker Fees ($150-300/entry), and any agency user fees (FDA $300+ for food)
- Each line item must include "amount" (% or $/₹ figure) and "notes" (when it applies)
- Be EXHAUSTIVE on FTA opportunities — list every potentially-applicable agreement and explicitly mark eligibility (don't skip any just because they're inactive; the exporter needs to know)
- "estimatedTotalCostPerUnit" = honest estimate as % of FOB OR per-unit ₹/USD
- "assumptions" must list every assumption (FOB pricing, ocean vs air, weight estimates, no special program claimed)
- Cite the actual rate sources you searched in the line items' notes when possible`;

const SCHEMA_DESC = `{
  "estimatedDutyRate": "string — e.g., '16.5% column 1 General'",
  "estimatedTotalCostPerUnit": "string — e.g., '~22% added to FOB' or '₹450/unit'",
  "lineItems": [
    {
      "name": "string — e.g., 'Import Duty (HTS 6109.10.00)'",
      "amount": "string — e.g., '16.5% of CIF' or '₹2,475/kg'",
      "notes": "string — when it applies, source if searched"
    }
  ],
  "ftaOpportunities": [
    {
      "agreement": "string — e.g., 'GSP', 'IPEF Pillar 2', 'India-US trade preference'",
      "benefit": "string — what it would save",
      "eligible": true | false
    }
  ],
  "assumptions": ["string — every assumption made in the calculation"]
}`;

export async function runCostAgent(
  input: CrewInput,
  classifierContext?: ClassifierOutput,
): Promise<CostOutput> {
  const contextBlock = buildContextBlock(input);
  const hsBlock = classifierContext ? `

UPSTREAM CLASSIFIER OUTPUT (anchor duty calculation on this exact HS code)
HS Code:        ${classifierContext.hsCode}
Quoted Duty:    ${classifierContext.dutyRate}
Description:    ${classifierContext.description}
` : "";

  const { parsed, sources } = await generateGroundedJson<Omit<CostOutput, "sources">>({
    systemInstruction: SYSTEM_INSTRUCTION,
    contents: `${contextBlock}${hsBlock}\n\nDecompose the complete US landed-cost stack. Search current rate sources to verify duty figures.`,
    jsonSchemaDescription: SCHEMA_DESC,
    temperature: 0.15,
    enableSearch: true,
  });

  return { ...parsed, sources };
}
