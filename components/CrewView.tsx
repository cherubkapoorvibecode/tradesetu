// ─── CrewView ───
// The live multi-agent visualization. After the user submits the form, this
// component opens an SSE stream to /api/crew/run and renders 4 agent panels
// that transition through (idle → thinking → done | error) with their
// scoped outputs displayed when each finishes.

import React, { useEffect, useState, useRef } from "react";
import type {
  CrewEvent,
  CrewInput,
  CrewResult,
  AgentName,
  AgentStatus,
  ClassifierOutput,
  ComplianceOutput,
  CostOutput,
  RiskOutput,
  SynthesizerOutput,
} from "../types-crew";
import { streamCrew } from "../services/crewService";
import type { LanguagePreference } from "../types";
import { useTranslations } from "../hooks/useTranslations";

interface CrewViewProps {
  input: CrewInput;
  onComplete: (result: CrewResult) => void;
  onCancel: () => void;
  languagePref: LanguagePreference;
}

// ─── Agent metadata (icons, colors, names) ───────────────────────────

const AGENT_META: Record<Exclude<AgentName, "synthesizer">, {
  label: string;
  tagline: string;
  color: string;
  bg: string;
  ring: string;
  icon: React.ReactNode;
}> = {
  classifier: {
    label: "Tariff Code",
    tagline: "HS classification",
    color: "text-indigo-600",
    bg: "bg-indigo-50",
    ring: "ring-indigo-200",
    icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" /></svg>,
  },
  compliance: {
    label: "Compliance",
    tagline: "Rules and documents",
    color: "text-emerald-600",
    bg: "bg-emerald-50",
    ring: "ring-emerald-200",
    icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>,
  },
  cost: {
    label: "Landed Cost",
    tagline: "Duties, fees, and FTAs",
    color: "text-amber-600",
    bg: "bg-amber-50",
    ring: "ring-amber-200",
    icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  },
  risk: {
    label: "Risk Check",
    tagline: "Holds and red flags",
    color: "text-rose-600",
    bg: "bg-rose-50",
    ring: "ring-rose-200",
    icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>,
  },
};

// ─── Agent status pill ──────────────────────────────────────────────

function StatusPill({ status }: { status: AgentStatus }) {
  if (status === "idle") {
    return <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Queued</span>;
  }
  if (status === "thinking") {
    return (
      <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-blue-600">
        <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
        Thinking…
      </span>
    );
  }
  if (status === "done") {
    return (
      <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-600">
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
        Done
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-rose-600">
      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
      Failed
    </span>
  );
}

// ─── Individual agent card ──────────────────────────────────────────

interface AgentCardProps {
  agent: Exclude<AgentName, "synthesizer">;
  status: AgentStatus;
  output?: any;
  error?: string;
}

const AgentCard: React.FC<AgentCardProps> = ({ agent, status, output, error }) => {
  const meta = AGENT_META[agent];
  const isActive = status === "thinking";

  return (
    <div className={`relative bg-white rounded-2xl border transition-all duration-300 overflow-hidden ${
      isActive ? `border-transparent ring-2 ${meta.ring} shadow-lg` : "border-slate-100 shadow-sm"
    }`}>
      {/* Header */}
      <div className="p-4 flex items-start justify-between gap-3 border-b border-slate-50">
        <div className="flex items-start gap-3 min-w-0">
          <div className={`w-9 h-9 rounded-lg ${meta.bg} ${meta.color} flex items-center justify-center flex-shrink-0`}>
            {meta.icon}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900 truncate">{meta.label}</p>
            <p className="text-xs text-slate-400 truncate">{meta.tagline}</p>
          </div>
        </div>
        <StatusPill status={status} />
      </div>

      {/* Body */}
      <div className="p-4 min-h-[140px]">
        {status === "idle" && (
          <p className="text-xs text-slate-300 italic">Waiting to dispatch…</p>
        )}
        {status === "thinking" && (
          <ThinkingShimmer />
        )}
        {status === "error" && (
          <p className="text-xs text-rose-500 leading-relaxed">{error || "Agent failed"}</p>
        )}
        {status === "done" && output && (
          <AgentOutput agent={agent} output={output} />
        )}
      </div>
    </div>
  );
};

// ─── Skeleton "thinking" animation ──────────────────────────────────

const ThinkingShimmer: React.FC = () => (
  <div className="space-y-2">
    {[80, 60, 90, 50].map((w, i) => (
      <div
        key={i}
        className="h-2.5 bg-slate-100 rounded animate-pulse"
        style={{ width: `${w}%`, animationDelay: `${i * 100}ms` }}
      />
    ))}
  </div>
);

// ─── Source citations (from Google Search grounding) ────────────────

const SourceChips: React.FC<{ sources?: { uri: string; title: string }[] }> = ({ sources }) => {
  if (!sources || sources.length === 0) return null;
  return (
    <div className="mt-3 pt-3 border-t border-slate-50 flex items-center justify-between">
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
        Grounded
      </span>
      <span className="text-[10px] font-semibold text-slate-400">
        {sources.length} source{sources.length === 1 ? "" : "s"}
      </span>
    </div>
  );
};

const compactText = (text: string, max = 86) =>
  text.length > max ? `${text.slice(0, max).trim()}...` : text;

// ─── Per-agent output rendering (specialist-specific summary card) ──

const AgentOutput: React.FC<{ agent: Exclude<AgentName, "synthesizer">; output: any }> = ({ agent, output }) => {
  if (agent === "classifier") {
    const o = output as ClassifierOutput;
    return (
      <div className="space-y-2">
        <div className="text-xl font-black text-slate-900 font-mono">{o.hsCode}</div>
        <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">{compactText(o.description)}</p>
        <div className="flex items-center gap-2 pt-1">
          <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-md text-[10px] font-bold">{o.dutyRate}</span>
          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
            o.confidence === "High" ? "bg-emerald-50 text-emerald-600" :
            o.confidence === "Medium" ? "bg-amber-50 text-amber-600" :
            "bg-rose-50 text-rose-600"
          }`}>{o.confidence} confidence</span>
        </div>
        <SourceChips sources={o.sources} />
      </div>
    );
  }
  if (agent === "compliance") {
    const o = output as ComplianceOutput;
    const high = o.requiredCompliance.filter(i => i.risk === "High").length;
    return (
      <div className="space-y-2">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-black text-slate-900">{o.requiredCompliance.length}</span>
          <span className="text-xs text-slate-500">requirements identified</span>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {high > 0 && <span className="px-2 py-0.5 bg-rose-50 text-rose-600 rounded-md text-[10px] font-bold">{high} high-risk</span>}
          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-md text-[10px] font-bold">⏱ {o.timeline}</span>
        </div>
        <p className="text-xs text-slate-500 leading-relaxed line-clamp-2 pt-1">
          <span className="font-semibold text-slate-700">Bottleneck:</span> {compactText(o.bottleneck, 76)}
        </p>
        <SourceChips sources={o.sources} />
      </div>
    );
  }
  if (agent === "cost") {
    const o = output as CostOutput;
    return (
      <div className="space-y-2">
        <div className="text-lg font-black text-slate-900 leading-tight line-clamp-3">
          {compactText(o.estimatedTotalCostPerUnit, 96)}
        </div>
        <p className="text-[11px] text-slate-500">duty: <span className="font-bold text-slate-700 font-mono">{o.estimatedDutyRate}</span></p>
        <div className="flex items-center gap-1.5 flex-wrap pt-1">
          <span className="px-2 py-0.5 bg-amber-50 text-amber-600 rounded-md text-[10px] font-bold">{o.lineItems.length} line items</span>
          {o.ftaOpportunities.some(f => f.eligible) && (
            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-md text-[10px] font-bold">FTA eligible</span>
          )}
        </div>
        <SourceChips sources={o.sources} />
      </div>
    );
  }
  if (agent === "risk") {
    const o = output as RiskOutput;
    return (
      <div className="space-y-2">
        <div className="flex items-baseline gap-2">
          <span className={`text-2xl font-black ${
            o.overallRiskLevel === "High" ? "text-rose-600" :
            o.overallRiskLevel === "Medium" ? "text-amber-600" :
            "text-emerald-600"
          }`}>{o.topRiskScore}</span>
          <span className="text-xs text-slate-500">/ 100 risk score</span>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="px-2 py-0.5 bg-rose-50 text-rose-600 rounded-md text-[10px] font-bold">{o.flags.length} flags</span>
          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
            o.overallRiskLevel === "High" ? "bg-rose-50 text-rose-600" :
            o.overallRiskLevel === "Medium" ? "bg-amber-50 text-amber-600" :
            "bg-emerald-50 text-emerald-600"
          }`}>{o.overallRiskLevel} overall</span>
        </div>
        <SourceChips sources={o.sources} />
      </div>
    );
  }
  return null;
};

// ─── Synthesizer banner (appears last, on top of all 4 cards) ───────

const SynthesizerBanner: React.FC<{ output: SynthesizerOutput }> = ({ output }) => (
  <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-6 text-white shadow-2xl">
    <div className="flex items-center gap-2 mb-3">
      <span className="px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded-md text-[10px] font-bold uppercase tracking-wider">
        Confidence · {output.confidenceScore}%
      </span>
      {output.conflicts.length > 0 && (
        <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 rounded-md text-[10px] font-bold uppercase tracking-wider">
          {output.conflicts.length} thing{output.conflicts.length === 1 ? "" : "s"} to double-check
        </span>
      )}
    </div>
    <p className="text-base text-white leading-relaxed mb-4">{output.executiveSummary}</p>
    {output.topActions.length > 0 && (
      <div className="space-y-1.5">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Do these first</p>
        <ol className="space-y-1.5 text-sm text-slate-200">
          {output.topActions.map((a, i) => (
            <li key={i} className="flex gap-2.5">
              <span className="w-5 h-5 rounded-full bg-white/10 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
              <span className="leading-relaxed">{a}</span>
            </li>
          ))}
        </ol>
      </div>
    )}
    {output.conflicts.length > 0 && (
      <details className="mt-4 pt-3 border-t border-white/10">
        <summary className="text-xs font-semibold text-amber-300 cursor-pointer">Things worth a second look</summary>
        <ul className="mt-2 space-y-1.5 text-xs text-slate-300">
          {output.conflicts.map((c, i) => (
            <li key={i}>{c.description}</li>
          ))}
        </ul>
      </details>
    )}
  </div>
);

// ─── Main CrewView ──────────────────────────────────────────────────

const CrewView: React.FC<CrewViewProps> = ({ input, onComplete, onCancel, languagePref }) => {
  const t = useTranslations({
    title:    "Checking Your Export Plan",
    subtitle: "Tariff, compliance, cost, and risk checks run as separate specialist agents.",
    back:     "Cancel",
    waiting:  "Getting started…",
    finalCta: "View your full compliance plan",
    finalSub: "Detailed checklist, documents, costs, and risks merged into one workspace",
    phase1:   "Step 1 · Tariff code",
    phase2:   "Step 2 · Parallel specialist checks",
  }, languagePref);

  type AgentState = { status: AgentStatus; output?: any; error?: string };
  const initial: Record<Exclude<AgentName, "synthesizer">, AgentState> = {
    classifier: { status: "idle" },
    compliance: { status: "idle" },
    cost:       { status: "idle" },
    risk:       { status: "idle" },
  };

  const [agents, setAgents] = useState(initial);
  const [synth, setSynth] = useState<SynthesizerOutput | null>(null);
  const [synthStatus, setSynthStatus] = useState<AgentStatus>("idle");
  const [crewResult, setCrewResult] = useState<CrewResult | null>(null);
  const [streamErr, setStreamErr] = useState<string | null>(null);
  const elapsedRef = useRef<HTMLSpanElement | null>(null);
  const startTime = useRef(Date.now());

  // Live "elapsed" counter — pure DOM update so React doesn't re-render every 100ms
  useEffect(() => {
    const id = setInterval(() => {
      if (elapsedRef.current && !crewResult) {
        const sec = ((Date.now() - startTime.current) / 1000).toFixed(1);
        elapsedRef.current.textContent = `${sec}s`;
      }
    }, 100);
    return () => clearInterval(id);
  }, [crewResult]);

  // Open the SSE stream once on mount
  useEffect(() => {
    let cancelled = false;
    streamCrew(input, (event: CrewEvent) => {
      if (cancelled) return;

      if (event.type === "agent_started") {
        if (event.agent === "synthesizer") {
          setSynthStatus("thinking");
        } else {
          setAgents(prev => ({ ...prev, [event.agent]: { ...prev[event.agent], status: "thinking" } }));
        }
      } else if (event.type === "agent_done") {
        if (event.agent === "synthesizer") {
          setSynth(event.output as SynthesizerOutput);
          setSynthStatus("done");
        } else {
          setAgents(prev => ({ ...prev, [event.agent]: { status: "done", output: event.output } }));
        }
      } else if (event.type === "agent_error") {
        if (event.agent === "synthesizer") {
          setSynthStatus("error");
        } else {
          setAgents(prev => ({ ...prev, [event.agent]: { status: "error", error: event.error } }));
        }
      } else if (event.type === "crew_done") {
        setCrewResult(event.result);
      }
    }).catch((e: any) => {
      if (!cancelled) setStreamErr(e?.message || "Stream connection failed");
    });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const allDone = crewResult !== null;

  return (
    <div className="max-w-6xl mx-auto px-4 pb-20">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-600 text-sm font-semibold flex items-center gap-1.5 mb-3 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            {t.back}
          </button>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">{t.title}</h1>
          <p className="text-slate-500 mt-1 text-sm">{t.subtitle}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Elapsed</p>
          <span ref={elapsedRef} className="text-2xl font-black text-slate-900 font-mono tabular-nums">0.0s</span>
        </div>
      </div>

      {/* Synthesizer banner — appears last, animates in */}
      {synth && (
        <div className="mb-6 animate-in fade-in slide-in-from-top-4 duration-500">
          <SynthesizerBanner output={synth} />
        </div>
      )}

      {/* Phase 1 — Classifier alone */}
      <div className="mb-2 flex items-center gap-2">
        <div className="h-px flex-1 bg-slate-200" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t.phase1}</span>
        <div className="h-px flex-1 bg-slate-200" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <AgentCard
          agent="classifier"
          status={agents.classifier.status}
          output={agents.classifier.output}
          error={agents.classifier.error}
        />
        <div className="hidden md:flex items-center justify-center text-xs text-slate-400 italic px-4">
          Tariff code guides the next checks
        </div>
      </div>

      {/* Phase 2 — 3 specialists in parallel */}
      <div className="mb-2 flex items-center gap-2">
        <div className="h-px flex-1 bg-slate-200" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t.phase2}</span>
        <div className="h-px flex-1 bg-slate-200" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {(["compliance", "cost", "risk"] as const).map(name => (
          <AgentCard
            key={name}
            agent={name}
            status={agents[name].status}
            output={agents[name].output}
            error={agents[name].error}
          />
        ))}
      </div>

      {/* Synthesizer status bar (when running) */}
      {synthStatus === "thinking" && (
        <div className="mt-6 p-4 bg-slate-50 border border-slate-100 rounded-xl flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-white animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900">Putting it all together…</p>
            <p className="text-xs text-slate-500">Prioritizing the actions you need to take first</p>
          </div>
        </div>
      )}

      {streamErr && (
        <div className="mt-6 p-4 bg-rose-50 border border-rose-100 rounded-xl text-rose-700 text-sm">
          <span className="font-bold">Stream error:</span> {streamErr}
        </div>
      )}

      {/* Final CTA — show full integrated report */}
      {allDone && (
        <button
          onClick={() => crewResult && onComplete(crewResult)}
          className="mt-8 w-full p-5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold transition-all shadow-xl shadow-blue-500/20 flex items-center justify-between animate-in fade-in slide-in-from-bottom-4 duration-500"
        >
          <div className="text-left">
            <p className="text-base">{t.finalCta}</p>
            <p className="text-xs text-blue-100 font-medium mt-0.5">{t.finalSub}</p>
          </div>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
        </button>
      )}
    </div>
  );
};

export default CrewView;
