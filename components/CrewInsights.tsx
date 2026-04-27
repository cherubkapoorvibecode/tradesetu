// ─── CrewInsights ───
// Embedded inside the post-crew integrated report. Surfaces the
// Classifier (HS code), Cost (landed-cost stack), and Risk (operational
// red flags) agents' outputs in a clean tabbed panel.
//
// Compliance agent's output is NOT surfaced here — it's already the spine
// of the surrounding ComplianceResults component (summary, checklist,
// documents). This panel is the "extra" insight you wouldn't have gotten
// from a single-agent report.

import React, { useState } from "react";
import type { CrewResult, AgentSource } from "../types-crew";
import type { LanguagePreference } from "../types";
import { useTranslations } from "../hooks/useTranslations";

// Inline source list — shown at the bottom of each tab so the user can verify
// the agent's claims against current authoritative web sources.
const SourcesList: React.FC<{ sources?: AgentSource[]; title: string }> = ({ sources, title }) => {
  if (!sources || sources.length === 0) return null;
  return (
    <details className="mt-4 pt-4 border-t border-slate-100">
      <summary className="text-[10px] font-bold uppercase tracking-wider text-slate-400 cursor-pointer hover:text-slate-600 select-none">
        🌐 {title} · {sources.length} grounding source{sources.length === 1 ? "" : "s"}
      </summary>
      <ul className="mt-2 space-y-1.5">
        {sources.map((s, i) => {
          let host = "";
          try { host = new URL(s.uri).hostname.replace(/^www\./, ""); } catch { host = "source"; }
          return (
            <li key={i}>
              <a
                href={s.uri}
                target="_blank"
                rel="noopener noreferrer"
                className="block group"
              >
                <p className="text-xs text-blue-600 hover:text-blue-700 group-hover:underline truncate font-medium">
                  {s.title}
                </p>
                <p className="text-[10px] text-slate-400 font-mono truncate">{host}</p>
              </a>
            </li>
          );
        })}
      </ul>
    </details>
  );
};

interface Props {
  crew: CrewResult;
  languagePref: LanguagePreference;
}

type TabKey = "classifier" | "cost" | "risk";

const CrewInsights: React.FC<Props> = ({ crew, languagePref }) => {
  const t = useTranslations({
    title:        "Deeper Insights",
    subtitle:     "Tariff code, landed cost, and operational risk — beyond the basic checklist",
    tabClassifier:"HS Code",
    tabCost:      "Landed Cost",
    tabRisk:      "Operational Risk",
    classifierTitle: "Classifier Agent",
    costTitle:    "Cost Agent",
    riskTitle:    "Risk Agent",
    primaryCode:  "Primary HS Code",
    duty:         "Duty Rate",
    confidence:   "Confidence",
    reasoning:    "Why this code",
    alternates:   "Alternative codes",
    warnings:     "Classification warnings",
    estTotal:     "Est. cost addition",
    lineItems:    "Cost breakdown",
    fta:          "Free Trade Agreements",
    assumptions:  "Assumptions",
    eligible:     "Eligible",
    notEligible:  "Not eligible",
    riskScore:    "Risk score",
    flags:        "Top flags",
    portAdvice:   "Port advice",
    rejections:   "Common rejection reasons",
    mitigation:   "Mitigation",
  }, languagePref);

  const tabsAvailable: TabKey[] = [];
  if (crew.classifier) tabsAvailable.push("classifier");
  if (crew.cost) tabsAvailable.push("cost");
  if (crew.risk) tabsAvailable.push("risk");

  const [activeTab, setActiveTab] = useState<TabKey>(tabsAvailable[0] || "classifier");

  if (tabsAvailable.length === 0) return null;

  const tabMeta: Record<TabKey, { label: string; color: string; bg: string; activeRing: string }> = {
    classifier: { label: t.tabClassifier, color: "text-indigo-600", bg: "bg-indigo-50", activeRing: "ring-indigo-200" },
    cost:       { label: t.tabCost,       color: "text-amber-600",  bg: "bg-amber-50",  activeRing: "ring-amber-200" },
    risk:       { label: t.tabRisk,       color: "text-rose-600",   bg: "bg-rose-50",   activeRing: "ring-rose-200" },
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-3 border-b border-slate-50">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            ⚡ {t.title}
          </span>
        </div>
        <p className="text-xs text-slate-500">{t.subtitle}</p>
      </div>

      {/* Tab strip */}
      <div className="flex gap-1 px-5 pt-3 border-b border-slate-50">
        {tabsAvailable.map(tab => {
          const meta = tabMeta[tab];
          const isActive = tab === activeTab;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-2 text-xs font-bold rounded-t-lg transition-all ${
                isActive
                  ? `${meta.color} ${meta.bg} border-b-2 border-current`
                  : "text-slate-400 hover:text-slate-600"
              }`}
            >
              {meta.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="p-5">
        {activeTab === "classifier" && crew.classifier && (
          <ClassifierPanel output={crew.classifier} t={t} />
        )}
        {activeTab === "cost" && crew.cost && (
          <CostPanel output={crew.cost} t={t} />
        )}
        {activeTab === "risk" && crew.risk && (
          <RiskPanel output={crew.risk} t={t} />
        )}
      </div>
    </div>
  );
};

// ─── Classifier panel ────────────────────────────────────────────

const ClassifierPanel: React.FC<{ output: NonNullable<CrewResult["classifier"]>; t: any }> = ({ output, t }) => (
  <div className="space-y-5">
    <div className="flex items-baseline gap-3 flex-wrap">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">{t.primaryCode}</p>
        <span className="text-3xl font-black text-slate-900 font-mono tabular-nums">{output.hsCode}</span>
      </div>
      <div className="ml-auto flex gap-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">{t.duty}</p>
          <span className="text-sm font-bold text-indigo-600 font-mono">{output.dutyRate}</span>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">{t.confidence}</p>
          <span className={`text-sm font-bold ${
            output.confidence === "High" ? "text-emerald-600" :
            output.confidence === "Medium" ? "text-amber-600" : "text-rose-600"
          }`}>{output.confidence}</span>
        </div>
      </div>
    </div>

    <p className="text-sm text-slate-700 leading-relaxed">{output.description}</p>

    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">{t.reasoning}</p>
      <p className="text-sm text-slate-600 leading-relaxed">{output.reasoning}</p>
    </div>

    {output.alternativeCodes.length > 0 && (
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">{t.alternates}</p>
        <div className="space-y-2">
          {output.alternativeCodes.map((alt, i) => (
            <div key={i} className="p-3 bg-slate-50 rounded-lg border border-slate-100">
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-sm font-bold text-slate-900 font-mono">{alt.hsCode}</span>
                <span className="text-xs text-slate-500">{alt.description}</span>
              </div>
              <p className="text-xs text-slate-500 italic">{alt.whyDifferent}</p>
            </div>
          ))}
        </div>
      </div>
    )}

    {output.warnings.length > 0 && (
      <div className="p-3 bg-amber-50 rounded-lg border border-amber-100">
        <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600 mb-1.5">⚠ {t.warnings}</p>
        <ul className="space-y-1">
          {output.warnings.map((w, i) => (
            <li key={i} className="text-xs text-amber-800 leading-relaxed">{w}</li>
          ))}
        </ul>
      </div>
    )}
    <SourcesList sources={output.sources} title="Classifier sources" />
  </div>
);

// ─── Cost panel ─────────────────────────────────────────────────

const CostPanel: React.FC<{ output: NonNullable<CrewResult["cost"]>; t: any }> = ({ output, t }) => (
  <div className="space-y-5">
    <div className="flex items-baseline gap-3 flex-wrap">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">{t.estTotal}</p>
        <span className="text-2xl font-black text-slate-900">{output.estimatedTotalCostPerUnit}</span>
      </div>
      <div className="ml-auto">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">{t.duty}</p>
        <span className="text-sm font-bold text-amber-600 font-mono">{output.estimatedDutyRate}</span>
      </div>
    </div>

    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">{t.lineItems}</p>
      <div className="space-y-1.5">
        {output.lineItems.map((item, i) => (
          <div key={i} className="flex items-baseline justify-between gap-3 p-2.5 bg-slate-50 rounded-lg">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-800 truncate">{item.name}</p>
              <p className="text-xs text-slate-500 truncate">{item.notes}</p>
            </div>
            <span className="text-sm font-bold text-slate-900 font-mono whitespace-nowrap">{item.amount}</span>
          </div>
        ))}
      </div>
    </div>

    {output.ftaOpportunities.length > 0 && (
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">{t.fta}</p>
        <div className="space-y-1.5">
          {output.ftaOpportunities.map((fta, i) => (
            <div key={i} className={`p-3 rounded-lg border ${
              fta.eligible ? "bg-emerald-50 border-emerald-100" : "bg-slate-50 border-slate-100"
            }`}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-bold text-slate-900">{fta.agreement}</span>
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                  fta.eligible ? "bg-emerald-200/60 text-emerald-700" : "bg-slate-200/60 text-slate-500"
                }`}>{fta.eligible ? t.eligible : t.notEligible}</span>
              </div>
              <p className="text-xs text-slate-600">{fta.benefit}</p>
            </div>
          ))}
        </div>
      </div>
    )}

    {output.assumptions.length > 0 && (
      <details>
        <summary className="text-[10px] font-bold uppercase tracking-wider text-slate-400 cursor-pointer hover:text-slate-600">
          {t.assumptions} ({output.assumptions.length})
        </summary>
        <ul className="mt-2 space-y-1 pl-4 list-disc text-xs text-slate-500">
          {output.assumptions.map((a, i) => <li key={i}>{a}</li>)}
        </ul>
      </details>
    )}
    <SourcesList sources={output.sources} title="Cost sources" />
  </div>
);

// ─── Risk panel ─────────────────────────────────────────────────

const RiskPanel: React.FC<{ output: NonNullable<CrewResult["risk"]>; t: any }> = ({ output, t }) => {
  const scoreColor =
    output.overallRiskLevel === "High" ? "text-rose-600" :
    output.overallRiskLevel === "Medium" ? "text-amber-600" : "text-emerald-600";
  const scoreBg =
    output.overallRiskLevel === "High" ? "bg-rose-50" :
    output.overallRiskLevel === "Medium" ? "bg-amber-50" : "bg-emerald-50";

  return (
    <div className="space-y-5">
      <div className={`p-4 rounded-xl ${scoreBg} flex items-center gap-4`}>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">{t.riskScore}</p>
          <div className="flex items-baseline gap-1">
            <span className={`text-4xl font-black ${scoreColor}`}>{output.topRiskScore}</span>
            <span className="text-sm text-slate-400">/ 100</span>
          </div>
        </div>
        <div className="ml-auto text-right">
          <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${scoreColor} bg-white/60`}>
            {output.overallRiskLevel}
          </span>
        </div>
      </div>

      {output.flags.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">{t.flags}</p>
          <div className="space-y-2">
            {output.flags.map((flag, i) => (
              <div key={i} className="p-3 bg-white border border-slate-100 rounded-lg">
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-sm font-bold text-slate-900 flex-1">{flag.title}</span>
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                    flag.severity === "High" ? "bg-rose-100 text-rose-700" :
                    flag.severity === "Medium" ? "bg-amber-100 text-amber-700" :
                    "bg-emerald-100 text-emerald-700"
                  }`}>{flag.severity}</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed mb-2">{flag.description}</p>
                <div className="text-xs">
                  <span className="font-bold text-emerald-700">↳ {t.mitigation}:</span>
                  <span className="text-slate-700 ml-1">{flag.mitigation}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {output.portAdvice && (
        <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
          <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600 mb-1">⚓ {t.portAdvice}</p>
          <p className="text-sm text-slate-700 leading-relaxed">{output.portAdvice}</p>
        </div>
      )}

      {output.commonRejections.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">{t.rejections}</p>
          <ul className="space-y-1.5">
            {output.commonRejections.map((r, i) => (
              <li key={i} className="text-sm text-slate-700 flex gap-2">
                <span className="text-slate-300 flex-shrink-0">×</span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <SourcesList sources={output.sources} title="Risk sources" />
    </div>
  );
};

export default CrewInsights;
