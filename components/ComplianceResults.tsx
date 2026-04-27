
import React, { useState, useEffect } from 'react';
import { ComplianceReport, UserInput, FeedbackReason, ComplianceProgress, ComplianceStatus, LanguagePreference, TranslatedReport } from '../types';
import type { CrewResult } from '../types-crew';
import { submitFeedback, submitProductFeedback, translateText } from '../services/claudeService';
import { LANG_LABEL_EN } from './LanguageSelector';
import { useTranslations } from '../hooks/useTranslations';
import { getSessionId, trackReportView, trackItemExpand, trackStatusChange, trackFeedbackGiven, trackProductFeedback } from '../services/analytics';
import ComplianceItemCard, { isLabelItem } from './ComplianceItemCard';
import ChatPanel from './ChatPanel';
import DocumentsSection from './DocumentsSection';
import CrewInsights from './CrewInsights';

interface Props {
  report: ComplianceReport;
  userInput: UserInput | null;
  crewResult?: CrewResult | null;
  onReset: () => void;
  onReportUpdate: (report: ComplianceReport) => void;
  onHsClassify?: () => void;
  onLabelGuard?: () => void;
  languagePref: LanguagePreference;
}

// Status config colours — labels are translated dynamically via ui.*
const STATUS_STYLE: Record<ComplianceStatus, { color: string; bg: string; icon: string }> = {
  not_started:    { color: "text-slate-400",   bg: "bg-slate-100",   icon: "○" },
  in_progress:    { color: "text-blue-600",    bg: "bg-blue-100",    icon: "◐" },
  completed:      { color: "text-emerald-600", bg: "bg-emerald-100", icon: "✓" },
  not_applicable: { color: "text-slate-300",   bg: "bg-slate-50",    icon: "—" },
};

const STATUS_OPTIONS: ComplianceStatus[] = ["not_started", "in_progress", "completed", "not_applicable"];

const ComplianceResults: React.FC<Props> = ({ report, userInput, crewResult, onReset, onReportUpdate, onHsClassify, onLabelGuard, languagePref }) => {
  const [progress, setProgress] = useState<ComplianceProgress>({});
  const [expandedItem, setExpandedItem] = useState<number | null>(null);
  const [feedbackMap, setFeedbackMap] = useState<Record<string, { isPositive: boolean; reason?: FeedbackReason }>>({});
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [fbComment, setFbComment] = useState("");
  const [fbRating, setFbRating] = useState(0);
  const [fbSubmitted, setFbSubmitted] = useState(false);

  const ui = useTranslations({
    newCheck:     "New check",
    timeline:     "Timeline",
    bottleneck:   "Bottleneck",
    getHsCode:    "Get HS Code for this product",
    getHsSub:     "Find the right tariff classification and duty rates",
    whatToDo:     "What you need to do",
    documents:    "Documents to prepare",
    notRequired:  "Not required",
    todo:         "To Do",
    inProgress:   "In Progress",
    done:         "Done",
    skip:         "Skip",
    stepsOf:      "steps completed",
    wasHelpful:   "Was this helpful?",
    feedback:     "Feedback",
    howExp:       "How's your experience?",
    sendFeedback: "Send Feedback",
    thankYou:     "Thank you!",
    thankYouSub:  "Your feedback helps us improve.",
    fbPlaceholder:"What could we do better? What was most helpful?",
  }, languagePref);

  // Build translated STATUS_CONFIG — labels update reactively with language
  const STATUS_CONFIG: Record<ComplianceStatus, { label: string; color: string; bg: string; icon: string }> = {
    not_started:    { label: ui.todo,       ...STATUS_STYLE.not_started },
    in_progress:    { label: ui.inProgress, ...STATUS_STYLE.in_progress },
    completed:      { label: ui.done,       ...STATUS_STYLE.completed },
    not_applicable: { label: ui.skip,       ...STATUS_STYLE.not_applicable },
  };

  // Translation overlay — never mutates report, stored alongside it
  const [translatedReport, setTranslatedReport] = useState<TranslatedReport | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);

  // Auto-translate whenever languagePref or report changes
  useEffect(() => {
    if (!languagePref) {
      setTranslatedReport(null);
      return;
    }

    let cancelled = false;
    setIsTranslating(true);
    setTranslatedReport(null);

    const doTranslate = async () => {
      try {
        // Build a flat list of every string to translate in one go
        const toTranslate: string[] = [report.summary, ...report.documentsNeeded];
        const itemMeta: Array<{
          name: string;
          hasEnforcedBy: boolean;
          hasDetailedExplanation: boolean;
        }> = [];

        for (const item of report.requiredCompliance) {
          toTranslate.push(item.name);
          toTranslate.push(item.reason);
          toTranslate.push(item.enforcedBy);
          itemMeta.push({
            name: item.name,
            hasEnforcedBy: true,
            hasDetailedExplanation: !!item.detailedExplanation,
          });
          if (item.detailedExplanation) {
            toTranslate.push(item.detailedExplanation);
          }
        }

        const translated = await Promise.all(
          toTranslate.map(s => translateText(s, languagePref, 'en-IN', 'formal'))
        );
        if (cancelled) return;

        let cursor = 0;
        const translatedSummary = translated[cursor++];
        const translatedDocs = report.documentsNeeded.map(() => translated[cursor++]);
        const items: TranslatedReport['items'] = {};

        for (const meta of itemMeta) {
          const tName    = translated[cursor++];
          const tReason  = translated[cursor++];
          const tEnforced = translated[cursor++];
          const tDetail  = meta.hasDetailedExplanation ? translated[cursor++] : undefined;
          items[meta.name] = {
            name: tName,
            reason: tReason,
            enforcedBy: tEnforced,
            detailedExplanation: tDetail,
          };
        }

        setTranslatedReport({ summary: translatedSummary, items, documents: translatedDocs });
      } catch {
        // fail safe — show English
      } finally {
        if (!cancelled) setIsTranslating(false);
      }
    };

    doTranslate();
    return () => { cancelled = true; };
  }, [languagePref, report]);

  // Track report view on mount
  useEffect(() => {
    trackReportView(report.requiredCompliance.length);
  }, []);

  const handleFeedback = async (itemName: string, isPositive: boolean, reason?: FeedbackReason) => {
    setFeedbackMap((prev) => ({ ...prev, [itemName]: { isPositive, reason } }));
    trackFeedbackGiven(itemName, isPositive, reason);
    try {
      await submitFeedback({
        itemName,
        isPositive,
        reason,
        category: userInput?.category,
        tradeRoute: userInput ? `${userInput.countryOfManufacture} → ${userInput.destinationCountry}` : undefined,
        sessionId: getSessionId(),
      });
    } catch (e) {
      console.error("Failed to submit feedback:", e);
    }
  };

  const handleStatusChange = (key: string, newStatus: ComplianceStatus) => {
    const oldStatus = progress[key] || "not_started";
    setProgress((prev) => ({ ...prev, [key]: newStatus }));
    trackStatusChange(key, oldStatus, newStatus);
  };

  const handleProductFeedback = async () => {
    if (!fbComment.trim() && !fbRating) return;
    trackProductFeedback(fbRating, fbComment.length);
    try {
      await submitProductFeedback({
        comment: fbComment,
        rating: fbRating || undefined,
        category: userInput?.category,
        sessionId: getSessionId(),
      });
      setFbSubmitted(true);
      setTimeout(() => { setShowFeedbackModal(false); setFbSubmitted(false); setFbComment(""); setFbRating(0); }, 1500);
    } catch (e) {
      console.error("Failed to submit product feedback:", e);
    }
  };

  // Progress stats
  const allKeys = [
    ...report.requiredCompliance.map(i => i.name),
    ...report.documentsNeeded.map(d => `doc:${d}`),
  ];
  const completedCount = allKeys.filter(k => progress[k] === "completed").length;
  const naCount = allKeys.filter(k => progress[k] === "not_applicable").length;
  const actionable = allKeys.length - naCount;
  const percent = actionable > 0 ? Math.round((completedCount / actionable) * 100) : 0;

  // Sort items: high risk first
  const sortedCompliance = [...report.requiredCompliance].sort((a, b) => {
    const order = { High: 0, Medium: 1, Low: 2 };
    return order[a.risk] - order[b.risk];
  });

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-20">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <button onClick={onReset} className="text-slate-400 hover:text-slate-600 text-sm font-semibold flex items-center gap-1.5 mb-2 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            {ui.newCheck}
          </button>
          <h1 className="text-2xl font-black text-slate-900">
            {userInput?.productName || "Compliance Report"}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {userInput?.countryOfManufacture} → {userInput?.destinationCountry} · {userInput?.channel}
          </p>
        </div>
      </div>

      {/* Summary + Progress */}
      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-6 text-white shadow-xl">
        <p className="text-sm leading-relaxed opacity-90 mb-5">
          {translatedReport?.summary || report.summary}
        </p>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="w-full h-2.5 bg-white/20 rounded-full overflow-hidden">
              <div className="h-full bg-white rounded-full transition-all duration-500" style={{ width: `${percent}%` }} />
            </div>
          </div>
          <span className="text-lg font-black">{percent}%</span>
        </div>
        <p className="text-xs text-blue-200 mt-2">{completedCount} / {actionable} {ui.stepsOf}</p>

        {/* Auto-translate status */}
        {languagePref && isTranslating && (
          <div className="mt-3 flex items-center gap-1.5 text-xs text-white/60">
            <span className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin inline-block" />
            Translating to {LANG_LABEL_EN[languagePref]}…
          </div>
        )}
        {languagePref && translatedReport && !isTranslating && (
          <div className="mt-3 flex items-center gap-1.5 text-[10px] text-white/50 font-medium uppercase tracking-wider">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 2a10 10 0 100 20A10 10 0 0012 2zm0 0c-2.4 4-2.4 16 0 20m0-20c2.4 4 2.4 16 0 20M2 12h20" /></svg>
            {LANG_LABEL_EN[languagePref]}
          </div>
        )}
      </div>

      {/* Timeline + Bottleneck — compact row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-xl p-4 border border-slate-100">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{ui.timeline}</p>
          <p className="text-sm font-bold text-slate-900 mt-1">{report.timeline}</p>
        </div>
        <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
          <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">{ui.bottleneck}</p>
          <p className="text-sm font-bold text-amber-800 mt-1">{report.bottleneck}</p>
        </div>
      </div>

      {/* Crew Insights — Classifier + Cost + Risk panels */}
      {crewResult && (
        <CrewInsights crew={crewResult} languagePref={languagePref} />
      )}

      {/* Compliance Agent grounding sources — visible trust signal under the spine */}
      {crewResult?.compliance?.sources && crewResult.compliance.sources.length > 0 && (
        <div className="bg-blue-50/40 rounded-xl border border-blue-100 p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600 mb-2">
            🌐 Compliance grounded in {crewResult.compliance.sources.length} live sources
          </p>
          <div className="flex flex-wrap gap-1.5">
            {crewResult.compliance.sources.map((s, i) => {
              let host = "";
              try { host = new URL(s.uri).hostname.replace(/^www\./, ""); } catch { host = "source"; }
              return (
                <a key={i} href={s.uri} target="_blank" rel="noopener noreferrer" title={s.title}
                  className="px-2 py-0.5 bg-white hover:bg-blue-100 text-blue-700 rounded text-[10px] font-mono transition-colors">
                  {host}
                </a>
              );
            })}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      {onHsClassify && (
        <button
          onClick={onHsClassify}
          className="w-full flex items-center justify-between px-5 py-4 bg-white rounded-xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50/50 transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" /></svg>
            </div>
            <div className="text-left">
              <p className="text-sm font-bold text-slate-900">{ui.getHsCode}</p>
              <p className="text-xs text-slate-400">{ui.getHsSub}</p>
            </div>
          </div>
          <svg className="w-4 h-4 text-slate-300 group-hover:text-blue-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
        </button>
      )}

      {/* Action Checklist — THE primary view */}
      <div className="space-y-2">
        <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">{ui.whatToDo}</h2>

        {sortedCompliance.map((item, idx) => {
          const status = progress[item.name] || "not_started";
          const config = STATUS_CONFIG[status];
          const isExpanded = expandedItem === idx;
          const originalIdx = report.requiredCompliance.indexOf(item);
          // Items with an in-app automation path get a distinct visual treatment so
          // users can see at a glance which compliance steps they can solve today.
          const automatable = !!onLabelGuard && isLabelItem(item);

          return (
            <div key={item.name} className={`relative rounded-xl border transition-all duration-200 overflow-hidden ${
              status === "completed" ? "bg-emerald-50/50 border-emerald-100" :
              status === "in_progress" ? "bg-blue-50/50 border-blue-100" :
              status === "not_applicable" ? "bg-slate-50/30 border-slate-100 opacity-50" :
              automatable ? "bg-gradient-to-br from-violet-50/60 to-blue-50/40 border-violet-200/60 ring-1 ring-violet-100" :
              "bg-white border-slate-100"
            }`}>
              {/* Left accent stripe for automatable rows */}
              {automatable && status !== "completed" && status !== "not_applicable" && (
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-violet-500 to-blue-500" />
              )}
              {/* Row */}
              <div className="flex items-center gap-3 p-4">
                <select
                  value={status}
                  onChange={(e) => handleStatusChange(item.name, e.target.value as ComplianceStatus)}
                  className={`text-xs font-bold rounded-lg px-2 py-1 border-0 cursor-pointer outline-none ${config.bg} ${config.color} appearance-none text-center w-[85px]`}
                >
                  {STATUS_OPTIONS.map(s => (
                    <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
                  ))}
                </select>

                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => { setExpandedItem(isExpanded ? null : idx); if (!isExpanded) trackItemExpand(item.name, item.risk); }}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-sm font-semibold ${status === "completed" ? "line-through text-slate-400" : "text-slate-900"}`}>
                      {translatedReport?.items[item.name]?.name || item.name}
                    </span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      item.risk === "High" ? "bg-red-100 text-red-600" :
                      item.risk === "Medium" ? "bg-amber-100 text-amber-600" :
                      "bg-emerald-100 text-emerald-600"
                    }`}>
                      {item.risk}
                    </span>
                    {automatable && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-gradient-to-r from-violet-600 to-blue-600 text-white shadow-sm">
                        <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20"><path d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" /></svg>
                        Automate today
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {translatedReport?.items[item.name]?.enforcedBy || item.enforcedBy}
                  </p>
                </div>

                <button
                  onClick={() => { setExpandedItem(isExpanded ? null : idx); if (!isExpanded) trackItemExpand(item.name, item.risk); }}
                  className="p-1 text-slate-300 hover:text-slate-500 transition-colors"
                >
                  <svg className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>

              {/* Expanded detail */}
              {isExpanded && (
                <div className="px-4 pb-4 border-t border-slate-100/50">
                  <ComplianceItemCard
                    item={{
                      ...item,
                      reason: translatedReport?.items[item.name]?.reason || item.reason,
                      detailedExplanation: translatedReport?.items[item.name]?.detailedExplanation || item.detailedExplanation,
                    }}
                    languagePref={languagePref}
                    feedbackState={feedbackMap[item.name]?.isPositive === true ? "positive" : feedbackMap[item.name]?.isPositive === false ? "negative" : null}
                    onFeedback={(isPositive, reason) => handleFeedback(item.name, isPositive, reason)}
                    onLabelGuard={onLabelGuard}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Documents — grouped card grid with icons */}
      <DocumentsSection
        documents={report.documentsNeeded}
        translatedDocuments={translatedReport?.documents}
        progress={progress}
        onStatusChange={handleStatusChange}
        statusConfig={STATUS_CONFIG}
        statusOptions={STATUS_OPTIONS}
        sectionTitle={ui.documents}
        completedDocs={allKeys.filter(k => k.startsWith("doc:") && progress[k] === "completed").length}
        totalDocs={report.documentsNeeded.length}
      />


      {/* What's NOT required — collapsed by default */}
      {report.notRequired.length > 0 && (
        <details className="group">
          <summary className="text-sm font-bold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-600 list-none flex items-center gap-2">
            <svg className="w-3 h-3 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
            {ui.notRequired} ({report.notRequired.length})
          </summary>
          <div className="mt-2 space-y-1.5">
            {report.notRequired.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2 py-2 px-3 text-sm text-slate-400">
                <svg className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
                {item}
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Chat Panel */}
      {userInput && (
        <ChatPanel
          report={report}
          userInput={userInput}
          onReportUpdate={onReportUpdate}
          languagePref={languagePref}
        />
      )}

      {/* Floating Feedback Button */}
      <button
        onClick={() => setShowFeedbackModal(true)}
        className="fixed bottom-6 right-6 bg-blue-600 text-white px-4 py-3 rounded-full shadow-lg hover:bg-blue-700 transition-all flex items-center gap-2 text-sm font-semibold z-50"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
        </svg>
        {ui.feedback}
      </button>

      {/* Feedback Modal */}
      {showFeedbackModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowFeedbackModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            {fbSubmitted ? (
              <div className="text-center py-8">
                <div className="text-4xl mb-3">&#10003;</div>
                <p className="text-lg font-bold text-slate-800">{ui.thankYou}</p>
                <p className="text-sm text-slate-500">{ui.thankYouSub}</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-slate-900">{ui.howExp}</h3>
                  <button onClick={() => setShowFeedbackModal(false)} className="text-slate-400 hover:text-slate-600 p-1">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>

                {/* Star rating */}
                <div className="flex gap-1 justify-center py-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => setFbRating(star)}
                      className={`text-3xl transition-colors ${star <= fbRating ? "text-amber-400" : "text-slate-200 hover:text-amber-300"}`}
                    >
                      &#9733;
                    </button>
                  ))}
                </div>

                {/* Comment */}
                <textarea
                  value={fbComment}
                  onChange={(e) => setFbComment(e.target.value)}
                  placeholder={ui.fbPlaceholder}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500/10 focus:border-blue-400 outline-none resize-none h-28"
                />

                <button
                  onClick={handleProductFeedback}
                  disabled={!fbComment.trim() && !fbRating}
                  className={`w-full py-3 rounded-xl text-sm font-bold transition-all ${
                    fbComment.trim() || fbRating
                      ? "bg-blue-600 text-white hover:bg-blue-700"
                      : "bg-slate-100 text-slate-300"
                  }`}
                >
                  {ui.sendFeedback}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ComplianceResults;
