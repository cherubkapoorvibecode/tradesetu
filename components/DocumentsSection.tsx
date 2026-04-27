// ─── DocumentsSection ───
// A redesigned documents view: grouped by category, each doc gets an icon
// inferred from its name, status pills are inline, and progress shows in
// the section header. Replaces the previous flat-list "To Do | name" rows.

import React from "react";
import type { ComplianceStatus } from "../types";

interface DocumentsSectionProps {
  documents: string[];
  translatedDocuments?: string[];
  progress: Record<string, ComplianceStatus>;
  onStatusChange: (key: string, status: ComplianceStatus) => void;
  statusConfig: Record<ComplianceStatus, { label: string; color: string; bg: string; icon: string }>;
  statusOptions: ComplianceStatus[];
  sectionTitle: string;
  completedDocs: number;
  totalDocs: number;
}

// Bucket each document into one of 4 functional groups so the user sees
// "what kind of paper am I missing?" at a glance.
type DocCategory = "commercial" | "regulatory" | "customs" | "specialized";

const CATEGORY_META: Record<DocCategory, { label: string; color: string; bg: string; ring: string; icon: React.ReactNode }> = {
  commercial: {
    label: "Commercial Documents",
    color: "text-blue-600",
    bg: "bg-blue-50",
    ring: "ring-blue-100",
    icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>,
  },
  regulatory: {
    label: "Regulatory Filings",
    color: "text-emerald-600",
    bg: "bg-emerald-50",
    ring: "ring-emerald-100",
    icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>,
  },
  customs: {
    label: "Customs & Logistics",
    color: "text-indigo-600",
    bg: "bg-indigo-50",
    ring: "ring-indigo-100",
    icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>,
  },
  specialized: {
    label: "Specialized Certifications",
    color: "text-amber-600",
    bg: "bg-amber-50",
    ring: "ring-amber-100",
    icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" /></svg>,
  },
};

// Categorize a document by keyword matching against its name.
function categorize(doc: string): DocCategory {
  const d = doc.toLowerCase();
  if (/invoice|packing|bill of lading|waybill|origin|inspection certificate$/.test(d)) return "commercial";
  if (/fda|fcc|cpsc|usda|epa|registration|prior notice|fsvp|certificate of analysis|coa\b/.test(d)) return "regulatory";
  if (/customs|broker|attorney|bond|isf|10\+2|entry/.test(d)) return "customs";
  return "specialized";
}

const DocumentsSection: React.FC<DocumentsSectionProps> = ({
  documents,
  translatedDocuments,
  progress,
  onStatusChange,
  statusConfig,
  statusOptions,
  sectionTitle,
  completedDocs,
  totalDocs,
}) => {
  // Group docs by category
  const groups: Record<DocCategory, Array<{ doc: string; displayDoc: string; key: string; idx: number }>> = {
    commercial: [], regulatory: [], customs: [], specialized: [],
  };
  documents.forEach((doc, idx) => {
    const cat = categorize(doc);
    groups[cat].push({
      doc,
      displayDoc: translatedDocuments?.[idx] || doc,
      key: `doc:${doc}`,
      idx,
    });
  });

  const orderedCategories: DocCategory[] = ["commercial", "regulatory", "customs", "specialized"];
  const percent = totalDocs > 0 ? Math.round((completedDocs / totalDocs) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Section header with progress meter */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">{sectionTitle}</h2>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-400 tabular-nums">{completedDocs} / {totalDocs}</span>
          <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${percent}%` }} />
          </div>
        </div>
      </div>

      {/* Category groups */}
      <div className="space-y-3">
        {orderedCategories.map(cat => {
          const items = groups[cat];
          if (items.length === 0) return null;
          const meta = CATEGORY_META[cat];

          return (
            <div key={cat} className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
              {/* Category label */}
              <div className={`flex items-center gap-2 px-4 py-2.5 border-b border-slate-50 ${meta.bg}`}>
                <div className={`w-6 h-6 rounded-md bg-white flex items-center justify-center ${meta.color}`}>
                  {meta.icon}
                </div>
                <span className={`text-xs font-bold uppercase tracking-wider ${meta.color}`}>{meta.label}</span>
                <span className="text-[10px] font-bold text-slate-400 ml-auto tabular-nums">{items.length}</span>
              </div>

              {/* Document rows */}
              <ul className="divide-y divide-slate-50">
                {items.map(({ doc, displayDoc, key }) => {
                  const status = progress[key] || "not_started";
                  const config = statusConfig[status];
                  const isDone = status === "completed";
                  const isSkipped = status === "not_applicable";

                  return (
                    <li key={key} className={`group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-slate-50/50 ${isDone ? "bg-emerald-50/30" : ""}`}>
                      {/* Visual checkbox-style status */}
                      <button
                        onClick={() => onStatusChange(key, isDone ? "not_started" : "completed")}
                        className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all flex-shrink-0 ${
                          isDone ? "bg-emerald-500 border-emerald-500" :
                          isSkipped ? "bg-slate-100 border-slate-200" :
                          "bg-white border-slate-200 hover:border-emerald-400"
                        }`}
                        title={isDone ? "Mark as to-do" : "Mark as done"}
                      >
                        {isDone && (
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={4}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                        )}
                      </button>

                      {/* Document name */}
                      <span className={`text-sm flex-1 transition-colors ${
                        isDone ? "line-through text-slate-400" :
                        isSkipped ? "text-slate-300" :
                        "text-slate-800 font-medium"
                      }`}>
                        {displayDoc}
                      </span>

                      {/* Status select (compact) */}
                      <select
                        value={status}
                        onChange={(e) => onStatusChange(key, e.target.value as ComplianceStatus)}
                        className={`text-[10px] font-bold rounded-md px-2 py-1 border-0 cursor-pointer outline-none ${config.bg} ${config.color} appearance-none text-center w-[80px] flex-shrink-0`}
                      >
                        {statusOptions.map(s => (
                          <option key={s} value={s}>{statusConfig[s].label}</option>
                        ))}
                      </select>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DocumentsSection;
