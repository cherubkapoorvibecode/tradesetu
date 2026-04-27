// ─── Multi-Agent Crew Types ───
//
// The "crew" is 4 specialist agents (Classifier, Compliance, Cost, Risk) +
// 1 synthesizer running in parallel against a single product/route query.
// Each agent emits a tightly-scoped, independently-validated output so the UI
// can render partial results as soon as any one agent completes.

export type AgentName = "classifier" | "compliance" | "cost" | "risk" | "synthesizer";

export type AgentStatus = "idle" | "thinking" | "searching" | "synthesizing" | "done" | "error";

// Web sources cited by an agent (extracted from Gemini grounding metadata).
// Surfaced to the UI as small citation chips under each agent's output.
export interface AgentSource {
  uri: string;
  title: string;
  snippet?: string;  // optional preview text
}

// ─── Classifier Agent: HS code + alternates ───

export interface ClassifierOutput {
  hsCode: string;                    // e.g. "6109.10.00"
  description: string;
  chapter: string;                   // e.g. "Chapter 61"
  dutyRate: string;                  // e.g. "16.5%"
  confidence: "High" | "Medium" | "Low";
  reasoning: string;                 // 2-3 sentences citing GRI rules
  alternativeCodes: Array<{
    hsCode: string;
    description: string;
    whyDifferent: string;
  }>;
  warnings: string[];
  sources?: AgentSource[];           // grounding citations
}

// ─── Compliance Agent: regulatory map ───

export interface ComplianceItem {
  name: string;
  reason: string;
  enforcedBy: string;
  risk: "High" | "Medium" | "Low";
  detailedExplanation: string;
  regulations: string[];
}

export interface ComplianceOutput {
  summary: string;
  requiredCompliance: ComplianceItem[];
  notRequired: string[];
  documentsNeeded: string[];
  timeline: string;
  bottleneck: string;
  sources?: AgentSource[];
}

// ─── Cost Agent: landed-cost breakdown ───

export interface CostLineItem {
  name: string;       // "Import Duty (HTS 6109.10.00)"
  amount: string;     // "₹2,475 / kg" or "16.5% of FOB"
  notes: string;
}

export interface CostOutput {
  estimatedDutyRate: string;          // "16.5%"
  estimatedTotalCostPerUnit: string;  // "₹450 added per unit"
  lineItems: CostLineItem[];
  ftaOpportunities: Array<{
    agreement: string;
    benefit: string;
    eligible: boolean;
  }>;
  assumptions: string[];               // what the agent assumed (FOB, weight, etc.)
  sources?: AgentSource[];
}

// ─── Risk Agent: rejection patterns + red flags ───

export interface RiskFlag {
  title: string;
  severity: "High" | "Medium" | "Low";
  description: string;
  mitigation: string;
}

export interface RiskOutput {
  overallRiskLevel: "High" | "Medium" | "Low";
  topRiskScore: number;            // 0-100
  flags: RiskFlag[];
  portAdvice: string;              // best/worst US ports of entry for this product
  commonRejections: string[];      // historical rejection reasons
  sources?: AgentSource[];
}

// ─── Synthesizer: cross-agent narrative ───

export interface SynthesizerOutput {
  executiveSummary: string;        // 3 sentences merging all 4 specialists
  topActions: string[];            // 3-5 prioritized actions
  conflicts: Array<{               // detected disagreements
    description: string;
    agents: AgentName[];
  }>;
  confidenceScore: number;         // 0-100, weighted across all 4 agents
}

// ─── Crew Result (full bundle) ───

export interface CrewResult {
  classifier?: ClassifierOutput;
  compliance?: ComplianceOutput;
  cost?: CostOutput;
  risk?: RiskOutput;
  synthesizer?: SynthesizerOutput;
  errors: Partial<Record<AgentName, string>>;
}

// ─── SSE Event Types (live streaming) ───

export type CrewEvent =
  | { type: "agent_started"; agent: AgentName; }
  | { type: "agent_progress"; agent: AgentName; message: string; }
  | { type: "agent_done"; agent: AgentName; output: any; }
  | { type: "agent_error"; agent: AgentName; error: string; }
  | { type: "crew_done"; result: CrewResult; };

// ─── Crew Input (same shape as UserInput, kept here for isolation) ───

export interface CrewInput {
  productName: string;
  category: string;
  description: string;
  materials?: string;
  countryOfManufacture: string;
  destinationCountry: string;
  intendedUse?: string;
  channel?: string;
  isFirstShipment?: boolean;
}
