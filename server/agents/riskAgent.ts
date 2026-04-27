// ─── Risk Agent ───
// Specialty: Operational risk — port-of-entry patterns, common rejection
// reasons, paperwork red flags.
// Phase 2 — receives the Classifier's HS code so it can search FDA Import
// Refusal Reports and CBP enforcement actions for THAT specific category.
//
// Why grounded search matters here:
//   - FDA Import Refusal Reports are published monthly with actual rejection
//     reasons by product category
//   - CBP releases informed compliance publications on common errors
//   - Port wait times and inspection rates are publicly available
//   - Recent enforcement actions (warning letters, detention orders) signal
//     where regulators are focusing — not in training data

import { generateGroundedJson, buildContextBlock } from "./shared";
import type { RiskOutput, CrewInput, ClassifierOutput } from "../../types-crew";

const SYSTEM_INSTRUCTION = `You are a US import operational risk analyst with access to current CBP and FDA enforcement data.

Your job: surface NON-OBVIOUS operational risks that experienced customs brokers know but novice exporters don't.

Method:
1. Use Google Search to find:
   - FDA Import Refusal Reports filtered by the product category (accessdata.fda.gov/scripts/importrefusals)
   - Recent FDA Import Alerts that could trigger automatic detention
   - CBP CSMS messages about new inspection priorities for this commodity
   - Port-specific data: which US ports are known for which inspection bottlenecks
2. If the Classifier provided an HS code, search for refusal patterns under that exact heading
3. Look for recent enforcement trends (last 12 months) — what is CBP currently flagging?

Rules:
- "flags" = practical operational risks (sample holds, lab testing delays, paperwork mismatches, seasonal bottlenecks)
- Be SPECIFIC to this product + origin combo — generic "make sure documents are accurate" is useless
- Cite actual recent refusal reasons or enforcement actions when found via search
- "portAdvice" = which US port of entry tends to clear this product type fastest, vs which to avoid (e.g., "LA/Long Beach has highest textile inspection rate; Norfolk averages 30% faster clearance for furniture")
- "commonRejections" = top 3-5 ACTUAL reasons CBP/FDA reject this product category from this origin (search recent refusal data)
- "topRiskScore" = 0-100 (0 = trivial, 100 = will almost certainly be held)
- Each flag's "mitigation" must be concrete — e.g., "Get COA from NABL-accredited lab" not "ensure quality"
- Distinguish between regulatory risks (handled by Compliance Agent) and OPERATIONAL risks (your focus)
- Be EXHAUSTIVE: a typical first-time shipment has 5-8 distinct risk flags`;

const SCHEMA_DESC = `{
  "overallRiskLevel": "High | Medium | Low",
  "topRiskScore": 0,
  "flags": [
    {
      "title": "string — short flag name",
      "severity": "High | Medium | Low",
      "description": "string — what the risk is, citing actual data when possible",
      "mitigation": "string — concrete action to reduce this risk"
    }
  ],
  "portAdvice": "string — port-specific recommendations",
  "commonRejections": ["string — actual top rejection reasons"]
}`;

export async function runRiskAgent(
  input: CrewInput,
  classifierContext?: ClassifierOutput,
): Promise<RiskOutput> {
  const contextBlock = buildContextBlock(input);
  const hsBlock = classifierContext ? `

UPSTREAM CLASSIFIER OUTPUT (search refusal data for THIS specific HS code/chapter)
HS Code:     ${classifierContext.hsCode}
Chapter:     ${classifierContext.chapter}
Description: ${classifierContext.description}
` : "";

  const { parsed, sources } = await generateGroundedJson<Omit<RiskOutput, "sources">>({
    systemInstruction: SYSTEM_INSTRUCTION,
    contents: `${contextBlock}${hsBlock}\n\nIdentify the operational risks and rejection patterns. Search FDA Import Refusal data and recent CBP enforcement for this product/origin combo.`,
    jsonSchemaDescription: SCHEMA_DESC,
    temperature: 0.3,
    enableSearch: true,
  });

  return { ...parsed, sources };
}
