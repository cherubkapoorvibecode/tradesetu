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
- "topRiskScore" = 0-100 using this rubric: base commodity risk + origin-specific history + first-shipment penalty + number/severity of operational flags
- Do NOT use a default score like 75, 80, or 85. A spice powder, cotton t-shirt, toy, cosmetic, and RF device should not all receive the same score.
- Calibrate the score: Low = 0-39, Medium = 40-69, High = 70-100. Set "overallRiskLevel" from the score, not from a gut feeling.
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

function clampScore(score: number): number {
  return Math.max(5, Math.min(98, Math.round(score)));
}

function levelFromScore(score: number): RiskOutput["overallRiskLevel"] {
  if (score >= 70) return "High";
  if (score >= 40) return "Medium";
  return "Low";
}

function categoryBaseRisk(input: CrewInput): number {
  const text = `${input.category} ${input.productName} ${input.description} ${input.materials || ""}`.toLowerCase();
  if (/food|spice|powder|ingredient|supplement|beverage|tea|coffee|turmeric|herb/.test(text)) return 42;
  if (/cosmetic|skin|cream|soap|shampoo|lotion/.test(text)) return 36;
  if (/toy|child|children|infant|toddler|baby/.test(text)) return 38;
  if (/electronic|battery|wireless|bluetooth|wifi|rf|charger/.test(text)) return 34;
  if (/apparel|textile|cotton|garment|shirt|fabric/.test(text)) return 24;
  return 28;
}

function deriveRiskScore(input: CrewInput, output: Omit<RiskOutput, "sources">): number {
  const severityPoints = (output.flags || []).reduce((sum, flag) => {
    if (flag.severity === "High") return sum + 12;
    if (flag.severity === "Medium") return sum + 7;
    return sum + 3;
  }, 0);

  const rejectionPoints = Math.min((output.commonRejections || []).length * 3, 12);
  const firstShipmentPoints = input.isFirstShipment ? 7 : 0;
  const routeText = `${input.countryOfManufacture} ${input.destinationCountry}`.toLowerCase();
  const routePoints = routeText.includes("india") && /united states|usa|us/.test(routeText) ? 4 : 0;
  const flagCountAdjustment = (output.flags || []).length < 3 ? -8 : 0;

  return clampScore(
    categoryBaseRisk(input) +
    severityPoints +
    rejectionPoints +
    firstShipmentPoints +
    routePoints +
    flagCountAdjustment,
  );
}

function calibrateRiskOutput(
  input: CrewInput,
  output: Omit<RiskOutput, "sources">,
): Omit<RiskOutput, "sources"> {
  const rawScore = Number(output.topRiskScore);
  const derived = deriveRiskScore(input, output);
  const genericAnchor = [75, 80, 85].includes(Math.round(rawScore));
  const invalidScore = !Number.isFinite(rawScore) || rawScore < 0 || rawScore > 100;

  const topRiskScore = invalidScore || genericAnchor
    ? derived
    : clampScore(Math.round((rawScore * 0.65) + (derived * 0.35)));

  return {
    ...output,
    topRiskScore,
    overallRiskLevel: levelFromScore(topRiskScore),
  };
}

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

  return { ...calibrateRiskOutput(input, parsed), sources };
}
