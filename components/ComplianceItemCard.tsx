
import React, { useState } from 'react';
import { ComplianceItem, FeedbackReason, LanguagePreference } from '../types';
import { useTranslations } from '../hooks/useTranslations';

interface ComplianceItemCardProps {
  item: ComplianceItem;
  feedbackState: "positive" | "negative" | null;
  onFeedback: (isPositive: boolean, reason?: FeedbackReason) => void;
  onLabelGuard?: () => void;
  languagePref: LanguagePreference;
}

// Detect label/packaging-related compliance items — triggers the LabelGuard CTA.
// Exported so ComplianceResults can also style the row at the list level.
export function isLabelItem(item: { name: string; enforcedBy: string }): boolean {
  const haystack = `${item.name} ${item.enforcedBy}`.toLowerCase();
  return /label|packaging|food labeling/.test(haystack);
}

const ComplianceItemCard: React.FC<ComplianceItemCardProps> = ({ item, feedbackState, onFeedback, onLabelGuard, languagePref }) => {
  const [showReasons, setShowReasons] = useState(false);

  const t = useTranslations({
    wasHelpful:    "Was this helpful?",
    thanks:        "Thanks!",
    noted:         "Noted",
    incorrect:     "Incorrect",
    tooVague:      "Too vague",
    notApplicable: "Doesn't apply",
    missingCtx:    "Missing info",
    labelCtaTitle: "Check your label with FDA LabelGuard",
    labelCtaSub:   "AI-powered compliance check against 21 CFR Part 101 and FALCPA allergen rules",
    labelCtaBtn:   "Analyze label",
  }, languagePref);

  const feedbackReasons: { value: FeedbackReason; label: string }[] = [
    { value: "incorrect",       label: t.incorrect },
    { value: "too_vague",       label: t.tooVague },
    { value: "not_applicable",  label: t.notApplicable },
    { value: "missing_context", label: t.missingCtx },
  ];

  return (
    <div className="pt-4 space-y-4">
      {/* Why this matters */}
      <p className="text-sm text-slate-600 leading-relaxed">{item.reason}</p>

      {/* Detailed explanation */}
      {item.detailedExplanation && (
        <div className="text-sm text-slate-500 leading-relaxed whitespace-pre-line">
          {item.detailedExplanation}
        </div>
      )}

      {/* LabelGuard CTA — only for label/packaging items, with a valid handler */}
      {onLabelGuard && isLabelItem(item) && (
        <button
          onClick={onLabelGuard}
          className="w-full flex items-center justify-between gap-3 p-3.5 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white hover:from-blue-700 hover:to-indigo-800 transition-all group shadow-sm hover:shadow-md"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-white/15 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div className="text-left">
              <p className="text-sm font-bold">{t.labelCtaTitle}</p>
              <p className="text-[11px] text-blue-100/90 mt-0.5">{t.labelCtaSub}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-xs font-bold bg-white/15 px-2.5 py-1 rounded-md hidden sm:inline">{t.labelCtaBtn}</span>
            <svg className="w-4 h-4 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </button>
      )}

      {/* Regulations as tags — always English (regulatory citations) */}
      {item.regulations && item.regulations.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {item.regulations.map((reg, i) => (
            <span key={i} className="px-2 py-1 bg-blue-50 text-blue-600 text-[11px] font-semibold rounded-md">
              {reg}
            </span>
          ))}
        </div>
      )}

      {/* Feedback row */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-100/50">
        <span className="text-[11px] text-slate-300 font-medium">{t.wasHelpful}</span>
        <div className="flex items-center gap-1">
          {feedbackState === "positive" && (
            <span className="text-xs text-emerald-500 font-semibold mr-2">{t.thanks}</span>
          )}
          {feedbackState === "negative" && (
            <span className="text-xs text-amber-500 font-semibold mr-2">{t.noted}</span>
          )}
          <button
            onClick={() => !feedbackState && onFeedback(true)}
            disabled={!!feedbackState}
            className={`p-1.5 rounded-md transition-all ${
              feedbackState === "positive" ? "bg-emerald-100 text-emerald-500" :
              feedbackState ? "text-slate-200" :
              "text-slate-300 hover:text-emerald-500 hover:bg-emerald-50"
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z" />
            </svg>
          </button>
          <button
            onClick={() => { if (!feedbackState) setShowReasons(true); }}
            disabled={!!feedbackState}
            className={`p-1.5 rounded-md transition-all ${
              feedbackState === "negative" ? "bg-amber-100 text-amber-500" :
              feedbackState ? "text-slate-200" :
              "text-slate-300 hover:text-amber-500 hover:bg-amber-50"
            }`}
          >
            <svg className="w-3.5 h-3.5 rotate-180" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Reason picker */}
      {showReasons && !feedbackState && (
        <div className="flex flex-wrap gap-1.5">
          {feedbackReasons.map((r) => (
            <button
              key={r.value}
              onClick={() => { onFeedback(false, r.value); setShowReasons(false); }}
              className="px-2.5 py-1 text-[11px] font-semibold rounded-md bg-slate-50 border border-slate-200 text-slate-500 hover:border-amber-300 hover:bg-amber-50 hover:text-amber-600 transition-all"
            >
              {r.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ComplianceItemCard;
