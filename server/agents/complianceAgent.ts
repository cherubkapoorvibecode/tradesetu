// ─── Compliance Agent ───
// Specialty: Regulatory mapping — which US agencies + CFR sections apply.
// Output: actionable checklist + documents needed + timeline + bottleneck.
//
// Phase 2 — receives the Classifier's HS code so it can search for
// code-specific regulations (e.g., "FDA imports under 6109").
//
// Why grounded search matters here:
//   FDA guidance documents update monthly. CPSC issues new safety
//   determinations regularly. The agent can search the actual eCFR,
//   FDA's import alerts, and CPSC's regulatory robot for current info
//   instead of stale training data.

import { generateGroundedJson, buildContextBlock } from "./shared";
import type { ComplianceOutput, CrewInput, ClassifierOutput } from "../../types-crew";

const SYSTEM_INSTRUCTION = `You are an expert US import compliance advisor with current real-time access to federal regulations.

Your job: identify EVERY US regulatory requirement the exporter must satisfy. Be exhaustive.

Method:
1. Use Google Search to find current applicable regulations on:
   - eCFR (ecfr.gov) — the live electronic CFR
   - FDA Import Alerts and Industry Guidance documents
   - CPSC's regulatory robot for consumer products
   - USDA APHIS for plant/animal products
   - EPA TSCA for chemicals
   - FCC OET database for RF-emitting devices
2. If the Classifier's HS code is provided, search for that specific code's regulatory regime
3. Cross-reference recent Federal Register notices for any rule changes in the last 12 months

Rules:
- Cover ALL relevant agencies: FDA, CPSC, FCC, EPA, USDA, FTC, TTB, ATF, DOT as applicable
- Be EXHAUSTIVE: a typical food product has 6-10 requirements (FDA registration, FSVP, prior notice, label compliance, FCE/SID, etc.). A typical electronics product has 4-6 (FCC, RoHS for state laws, energy compliance, prop 65, etc.). Don't stop at 3-4.
- Use plain business language — no legalese
- Each "reason" field = ONE sentence explaining why this matters to the exporter
- "detailedExplanation" = 2-3 short paragraphs on HOW to comply (specific portals, fees, links found via search)
- "regulations" should cite specific CFR sections (e.g., "21 CFR 1.227", "16 CFR 1500.51"), not vague "various"
- "summary" = 2-3 sentences max, starting with the single most important action
- "timeline" = specific weeks (e.g., "4-6 weeks"), not "varies"
- "bottleneck" = the ONE thing most likely to delay shipment
- "notRequired" = items the user might wrongly assume apply (saves them time)
- "documentsNeeded" = concrete document names a customs broker would recognize`;

const SCHEMA_DESC = `{
  "summary": "string — 2-3 sentences",
  "requiredCompliance": [
    {
      "name": "string — short name (e.g., 'FDA Food Facility Registration')",
      "reason": "string — ONE sentence",
      "enforcedBy": "string — agency name",
      "risk": "High | Medium | Low",
      "detailedExplanation": "string — 2-3 paragraphs on HOW to comply",
      "regulations": ["string — specific CFR cites"]
    }
  ],
  "notRequired": ["string — items user might wrongly assume apply"],
  "documentsNeeded": ["string — concrete document names"],
  "timeline": "string — e.g., '4-6 weeks'",
  "bottleneck": "string — the ONE most likely cause of delay"
}`;

export async function runComplianceAgent(
  input: CrewInput,
  classifierContext?: ClassifierOutput,
): Promise<ComplianceOutput> {
  const contextBlock = buildContextBlock(input);
  const hsBlock = classifierContext ? `

UPSTREAM CLASSIFIER OUTPUT (use this HS code as the starting point for your regulatory research)
HS Code:     ${classifierContext.hsCode}
Chapter:     ${classifierContext.chapter}
Description: ${classifierContext.description}
` : "";

  const { parsed, sources } = await generateGroundedJson<Omit<ComplianceOutput, "sources">>({
    systemInstruction: SYSTEM_INSTRUCTION,
    contents: `${contextBlock}${hsBlock}\n\nMap the COMPLETE US import compliance requirements for this product. Be exhaustive — find every applicable agency and rule.`,
    jsonSchemaDescription: SCHEMA_DESC,
    temperature: 0.2,
    enableSearch: true,
  });

  return { ...parsed, sources };
}
