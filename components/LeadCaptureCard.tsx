// ─── LeadCaptureCard ───
// Shown after the compliance report. The big emerald CTA reads "Speak with an
// agent for free" — clicking opens a modal form that collects contact info +
// the user's specific question. Submissions land in the Notion
// "Agent Consultation Requests" database as a "New" lead.
//
// Why this matters (per the business plan): export agencies are the GTM
// "trust wrapper" — even after seeing a great AI report, exporters still
// often want a human to confirm before they ship. This is the warm-handoff.

import React, { useState, useEffect } from "react";
import { submitLead } from "../services/claudeService";
import { getSessionId } from "../services/analytics";
import { useTranslations } from "../hooks/useTranslations";
import type { LanguagePreference, UserInput } from "../types";

interface Props {
  userInput: UserInput | null;
  languagePref: LanguagePreference;
}

const LeadCaptureCard: React.FC<Props> = ({ userInput, languagePref }) => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [question, setQuestion] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const t = useTranslations({
    ctaTitle:    "Want a human to walk you through this?",
    ctaSub:      "Speak with an export compliance agent for free — no commitment, no card.",
    ctaButton:   "Speak with an agent for free",
    modalTitle:  "Speak with an export compliance agent",
    modalSub:    "Tell us how to reach you. An agent reviews your report and follows up within 24 hours.",
    nameLbl:     "Your name",
    emailLbl:    "Email",
    phoneLbl:    "Phone (optional)",
    companyLbl:  "Company (optional)",
    questionLbl: "Anything specific you want help with? (optional)",
    namePh:      "e.g. Priya Shah",
    emailPh:     "you@yourcompany.in",
    phonePh:     "+91 ...",
    companyPh:   "Your business name",
    questionPh:  "e.g. Will FDA accept my COA from a non-NABL lab?",
    submitBtn:   "Request a callback",
    submitting:  "Sending…",
    successTitle:"Got it — we'll be in touch",
    successSub:  "An agent will review your report and email you within 24 hours.",
    cancel:      "Cancel",
    free:        "Free · No commitment",
  }, languagePref);

  // Esc to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const reset = () => {
    setName(""); setEmail(""); setPhone(""); setCompany(""); setQuestion("");
    setErr(null); setSubmitting(false); setSubmitted(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (!name.trim() || !email.trim()) {
      setErr("Name and email are required");
      return;
    }
    setSubmitting(true);
    try {
      await submitLead({
        name:            name.trim(),
        email:           email.trim(),
        phone:           phone.trim() || undefined,
        company:         company.trim() || undefined,
        question:        question.trim() || undefined,
        productCategory: userInput?.category,
        tradeRoute:      userInput ? `${userInput.countryOfManufacture} → ${userInput.destinationCountry}` : undefined,
        productName:     userInput?.productName,
        sessionId:       getSessionId(),
      });
      setSubmitted(true);
      setTimeout(() => { setOpen(false); reset(); }, 2200);
    } catch (e: any) {
      setErr(e?.message || "Something went wrong. Try again.");
      setSubmitting(false);
    }
  };

  return (
    <>
      {/* The CTA card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 p-6 text-white shadow-xl shadow-emerald-900/20">
        {/* Decorative dots */}
        <div className="absolute -right-12 -top-12 w-44 h-44 rounded-full bg-white/10 pointer-events-none" />
        <div className="absolute -right-4 -bottom-8 w-28 h-28 rounded-full bg-white/5 pointer-events-none" />

        <div className="relative flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <span className="inline-block px-2 py-0.5 bg-white/15 text-emerald-50 rounded-md text-[10px] font-bold uppercase tracking-wider mb-3">
              {t.free}
            </span>
            <h3 className="text-xl md:text-2xl font-black mb-1.5 leading-tight">{t.ctaTitle}</h3>
            <p className="text-emerald-50/90 text-sm leading-relaxed max-w-md">{t.ctaSub}</p>
          </div>

          <button
            onClick={() => setOpen(true)}
            className="bg-white hover:bg-emerald-50 text-emerald-700 px-5 py-3 rounded-xl text-sm font-bold transition-all hover:shadow-xl hover:shadow-emerald-900/20 hover:-translate-y-0.5 flex-shrink-0 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
            {t.ctaButton}
          </button>
        </div>
      </div>

      {/* Modal */}
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => !submitting && setOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {submitted ? (
              <div className="p-10 text-center">
                <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                </div>
                <h3 className="text-xl font-black text-slate-900 mb-1">{t.successTitle}</h3>
                <p className="text-sm text-slate-500">{t.successSub}</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="p-6">
                <div className="flex items-start justify-between mb-1">
                  <h3 className="text-lg font-bold text-slate-900">{t.modalTitle}</h3>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    disabled={submitting}
                    className="text-slate-400 hover:text-slate-600 -mt-1 -mr-1 p-1"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
                <p className="text-xs text-slate-500 mb-5">{t.modalSub}</p>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">{t.nameLbl}</label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={t.namePh}
                      className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">{t.emailLbl}</label>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder={t.emailPh}
                        className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">{t.phoneLbl}</label>
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder={t.phonePh}
                        className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">{t.companyLbl}</label>
                    <input
                      type="text"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      placeholder={t.companyPh}
                      className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">{t.questionLbl}</label>
                    <textarea
                      rows={3}
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                      placeholder={t.questionPh}
                      className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all resize-none"
                    />
                  </div>

                  {/* Context preview — reassures the user the agent will see their report */}
                  {userInput && (
                    <div className="text-[11px] text-slate-400 bg-slate-50 border border-slate-100 rounded-lg p-2.5 leading-relaxed">
                      <span className="font-bold text-slate-500">Context shared with the agent:</span> {userInput.productName} · {userInput.countryOfManufacture} → {userInput.destinationCountry} · {userInput.category}
                    </div>
                  )}

                  {err && (
                    <p className="text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-lg p-2">{err}</p>
                  )}

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      disabled={submitting}
                      className="flex-1 py-3 rounded-xl text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                    >
                      {t.cancel}
                    </button>
                    <button
                      type="submit"
                      disabled={submitting || !name.trim() || !email.trim()}
                      className={`flex-[2] py-3 rounded-xl text-sm font-bold transition-all ${
                        submitting || !name.trim() || !email.trim()
                          ? "bg-slate-100 text-slate-300 cursor-not-allowed"
                          : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/20"
                      }`}
                    >
                      {submitting ? t.submitting : t.submitBtn}
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default LeadCaptureCard;
