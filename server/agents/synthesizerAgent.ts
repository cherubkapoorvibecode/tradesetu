// ─── Synthesizer ───
// Runs AFTER all 4 specialists complete. Reads their JSON outputs and:
//   1. Produces a 3-sentence executive summary (no specialist alone could)
//   2. Extracts top 3-5 prioritized actions across all four domains
//   3. Detects conflicts between specialists (e.g., HS code says Ch 61 knit
//      but Compliance Agent cites Ch 62 woven regulations → flag)
//   4. Computes a single weighted confidence score
//
// Why this is the orchestrator's "value-add":
//   Without synthesis, the user sees 4 disconnected reports and has to merge
//   them mentally. The synthesizer does the cross-domain reasoning that no
//   specialist alone has the context to perform.

import { Type } from "@google/genai";
import { getCrewClient, CREW_MODEL, sanitizeJson } from "./shared";
import type {
  SynthesizerOutput,
  ClassifierOutput,
  ComplianceOutput,
  CostOutput,
  RiskOutput,
} from "../../types-crew";

const SYSTEM_INSTRUCTION = `You are a senior trade compliance director synthesizing reports from 4 specialists.

Your job: read the 4 JSON outputs and produce a unified executive view.

Rules:
- "executiveSummary" = exactly 3 sentences. Sentence 1 = the headline finding.
  Sentence 2 = the cost/timeline reality. Sentence 3 = the single biggest risk.
- "topActions" = 3-5 actions, ordered by impact-to-effort ratio. Each must be ONE
  imperative sentence ("Register your facility with FDA at access.fda.gov within 2 weeks")
- "conflicts" = look for: HS code chapter mismatched with cited regulations,
  compliance timeline that contradicts cost FTA assumption, risk flag covering
  same ground as a compliance item but with different severity. List only REAL
  contradictions, not stylistic differences.
- "confidenceScore" = 0-100. Anchor at the LOWEST specialist confidence + adjust for conflicts.
  If any specialist failed, cap at 60.`;

const SCHEMA = {
  type: Type.OBJECT,
  properties: {
    executiveSummary: { type: Type.STRING },
    topActions:       { type: Type.ARRAY, items: { type: Type.STRING } },
    conflicts: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          description: { type: Type.STRING },
          agents: {
            type: Type.ARRAY,
            items: { type: Type.STRING, enum: ["classifier", "compliance", "cost", "risk", "synthesizer"] },
          },
        },
        required: ["description", "agents"],
      },
    },
    confidenceScore: { type: Type.NUMBER },
  },
  required: ["executiveSummary", "topActions", "conflicts", "confidenceScore"],
};

export async function runSynthesizerAgent(specialists: {
  classifier?: ClassifierOutput;
  compliance?: ComplianceOutput;
  cost?: CostOutput;
  risk?: RiskOutput;
}): Promise<SynthesizerOutput> {
  const ai = getCrewClient();

  // Compact the specialist outputs into a single context block
  const block = `
SPECIALIST REPORTS

— Classifier —
${specialists.classifier ? JSON.stringify(specialists.classifier, null, 2) : "(failed — no output)"}

— Compliance —
${specialists.compliance ? JSON.stringify(specialists.compliance, null, 2) : "(failed — no output)"}

— Cost —
${specialists.cost ? JSON.stringify(specialists.cost, null, 2) : "(failed — no output)"}

— Risk —
${specialists.risk ? JSON.stringify(specialists.risk, null, 2) : "(failed — no output)"}
  `.trim();

  const response = await ai.models.generateContent({
    model: CREW_MODEL,
    contents: `${block}\n\nSynthesize.`,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      temperature: 0.2,
      responseMimeType: "application/json",
      responseSchema: SCHEMA,
    },
  });

  const text = sanitizeJson(response.text || "");
  return JSON.parse(text) as SynthesizerOutput;
}
