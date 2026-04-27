// ─── Orchestrator ───
// Coordinates the 4 specialist agents + synthesizer in a 2-phase DAG.
//
//   Phase 1: Classifier alone           (its HS code is needed by all 3 below)
//             ↓
//   Phase 2: Compliance ║ Cost ║ Risk   (parallel, all receive Classifier's output)
//             ↓
//   Phase 3: Synthesizer                (reads all 4 specialist reports)
//
// Why this topology beats pure parallel fanout:
//   - Cost Agent searches the actual current duty rate for the EXACT HS code
//     instead of guessing a chapter average
//   - Compliance Agent searches for code-specific regulatory regime
//   - Risk Agent searches FDA refusal data filtered by that HS chapter
//   - The marginal latency cost of Phase 1 (~3-5s) buys massive accuracy gains
//     for Phase 2 (which would otherwise hallucinate code-specific facts)
//
// Why it still beats a single sequential chain:
//   Phase 2 still runs 3 specialists in parallel — they're independent given
//   the HS code. A purely sequential chain would 3x the latency.
//
// Failure isolation:
//   Each agent runs through Promise.allSettled. If Classifier fails, Phase 2
//   still proceeds without HS context (degraded mode). If a Phase 2 agent
//   fails, the others still complete. Synthesizer adapts to whatever made it.

import type {
  CrewInput,
  CrewResult,
  CrewEvent,
  AgentName,
  ClassifierOutput,
} from "../../types-crew";
import { runClassifierAgent } from "./classifierAgent";
import { runComplianceAgent } from "./complianceAgent";
import { runCostAgent } from "./costAgent";
import { runRiskAgent } from "./riskAgent";
import { runSynthesizerAgent } from "./synthesizerAgent";

type EmitFn = (event: CrewEvent) => void;

// Run one agent with status tracking + error isolation.
async function runAgent<T>(
  name: AgentName,
  fn: () => Promise<T>,
  emit: EmitFn,
  result: CrewResult,
): Promise<T | null> {
  emit({ type: "agent_started", agent: name });
  const t0 = Date.now();
  try {
    const output = await fn();
    (result as any)[name] = output;
    const ms = Date.now() - t0;
    console.log(`[Crew] ${name} completed in ${ms}ms`);
    emit({ type: "agent_done", agent: name, output });
    return output;
  } catch (e: any) {
    const errorMsg = e?.message || String(e);
    result.errors[name] = errorMsg;
    emit({ type: "agent_error", agent: name, error: errorMsg });
    console.error(`[Crew] ${name} failed:`, errorMsg);
    return null;
  }
}

export async function runCrew(input: CrewInput, emit: EmitFn = () => {}): Promise<CrewResult> {
  const result: CrewResult = { errors: {} };
  const start = Date.now();

  // ── Phase 1: Classifier (alone) ───────────────────────────────────
  // Its HS code feeds Phase 2. We gate Phase 2 on Phase 1 to ensure
  // downstream agents can search for code-specific data.
  const classifierOutput = await runAgent<ClassifierOutput>(
    "classifier",
    () => runClassifierAgent(input),
    emit,
    result,
  );

  // ── Phase 2: 3 specialists in parallel, with HS context ──────────
  // If Classifier failed, the specialists still run (degraded mode —
  // no HS code in their context blocks).
  const phase2Start = Date.now();
  await Promise.allSettled([
    runAgent("compliance", () => runComplianceAgent(input, classifierOutput || undefined), emit, result),
    runAgent("cost",       () => runCostAgent(input, classifierOutput || undefined),       emit, result),
    runAgent("risk",       () => runRiskAgent(input, classifierOutput || undefined),       emit, result),
  ]);
  const phase2Ms = Date.now() - phase2Start;
  console.log(`[Crew] Phase 2 (3 specialists in parallel) finished in ${phase2Ms}ms`);

  // ── Phase 3: Synthesizer (only if at least one specialist succeeded) ─
  const anySuccess = result.classifier || result.compliance || result.cost || result.risk;
  if (anySuccess) {
    await runAgent(
      "synthesizer",
      () => runSynthesizerAgent({
        classifier: result.classifier,
        compliance: result.compliance,
        cost:       result.cost,
        risk:       result.risk,
      }),
      emit,
      result,
    );
  }

  console.log(`[Crew] Total elapsed: ${Date.now() - start}ms`);
  emit({ type: "crew_done", result });
  return result;
}
