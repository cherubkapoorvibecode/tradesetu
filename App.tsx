
import React, { useState, useRef } from 'react';
import ComplianceForm from './components/ComplianceForm';
import ComplianceResults from './components/ComplianceResults';
import HsClassifier from './components/HsClassifier';
import LabelGuard from './components/LabelGuard';
import CrewView from './components/CrewView';
import { Hero, Features, Testimonials, BottomCTA, DemoAnimation } from './components/LandingComponents';
import LanguageSelector from './components/LanguageSelector';
import { UserInput, ComplianceReport, LanguagePreference } from './types';
import type { CrewResult, CrewInput } from './types-crew';
import { trackFormSubmit } from './services/analytics';
import { useTranslations } from './hooks/useTranslations';

type ViewState = 'landing' | 'app' | 'crew' | 'results' | 'hs-classify' | 'label-automation';

// Project the multi-agent CrewResult into the legacy ComplianceReport shape
// the existing ComplianceResults component expects. We pull summary/checklist
// from the Compliance Agent and overlay synthesizer's executive summary.
function projectCrewToReport(crew: CrewResult): ComplianceReport | null {
  const c = crew.compliance;
  if (!c) return null;
  const synthSummary = crew.synthesizer?.executiveSummary || c.summary;
  const costRange = crew.cost?.estimatedTotalCostPerUnit || "See Cost Agent breakdown";
  return {
    summary: synthSummary,
    requiredCompliance: c.requiredCompliance,
    notRequired: c.notRequired,
    documentsNeeded: c.documentsNeeded,
    timeline: c.timeline,
    costRange,
    bottleneck: c.bottleneck,
  };
}

const App: React.FC = () => {
  const [view, setView] = useState<ViewState>('landing');
  const [report, setReport] = useState<ComplianceReport | null>(null);
  const [crewResult, setCrewResult] = useState<CrewResult | null>(null);
  const [crewInput, setCrewInput] = useState<CrewInput | null>(null);
  const [userInput, setUserInput] = useState<UserInput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [languagePref, setLanguagePref] = useState<LanguagePreference>(null);

  const nav = useTranslations({
    getReport:  "Get Free Report",
    backHome:   "Back to Home",
    formTitle:  "Build Your Compliance Strategy",
    formSub:    "Tell us what you're shipping. Get an audit-ready trade plan — requirements, costs, documents, and red flags — in under a minute.",
    formError:  "We encountered an error analyzing your product. Please try again.",
  }, languagePref);

  const handleStartCheck = () => {
    setView('app');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLogoClick = () => {
    setView('landing');
    setReport(null);
    setUserInput(null);
    setCrewResult(null);
    setCrewInput(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Form submit → kick off the multi-agent crew. The CrewView handles its
  // own loading state via SSE, so we don't need a top-level loading flag here.
  const handleFormSubmit = (data: UserInput) => {
    setError(null);
    setUserInput(data);
    trackFormSubmit(data);
    const cInput: CrewInput = {
      productName:           data.productName,
      category:              data.category,
      description:           data.description,
      materials:             data.materials,
      countryOfManufacture:  data.countryOfManufacture,
      destinationCountry:    data.destinationCountry,
      intendedUse:           data.intendedUse,
      channel:               data.channel,
      isFirstShipment:       data.isFirstShipment,
    };
    setCrewInput(cInput);
    setView('crew');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCrewComplete = (result: CrewResult) => {
    setCrewResult(result);
    const projected = projectCrewToReport(result);
    if (projected) {
      setReport(projected);
      setView('results');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      setError("All specialist agents failed. Please retry.");
      setView('app');
    }
  };

  const handleReportUpdate = (updatedReport: ComplianceReport) => {
    setReport(updatedReport);
  };

  const resetFlow = () => {
    setReport(null);
    setUserInput(null);
    setCrewResult(null);
    setCrewInput(null);
    setError(null);
    setView('app');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-slate-50 selection:bg-blue-100">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center relative">
          <div className="flex items-center space-x-2 cursor-pointer" onClick={handleLogoClick}>
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
            </div>
            <span className="text-xl font-extrabold text-slate-900 tracking-tight uppercase">TRADESETU</span>
          </div>
          <div className="flex items-center gap-3">
            <LanguageSelector value={languagePref} onChange={setLanguagePref} />
            <button
               onClick={handleStartCheck}
               className="bg-slate-900 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-slate-800 transition-all hover:shadow-lg hover:shadow-slate-200"
            >
              {nav.getReport}
            </button>
          </div>
        </div>
      </nav>

      <main>
        {/* Crew View — live multi-agent visualization */}
        {view === 'crew' && crewInput && (
          <div className="px-6 py-12 md:py-16 min-h-[80vh]">
            <CrewView
              input={crewInput}
              onComplete={handleCrewComplete}
              onCancel={() => setView('app')}
              languagePref={languagePref}
            />
          </div>
        )}

        {/* Results View */}
        {view === 'results' && report && (
          <div className="px-6 py-12 md:py-20 min-h-[80vh]">
             <ComplianceResults report={report} userInput={userInput} crewResult={crewResult} onReset={resetFlow} onReportUpdate={handleReportUpdate} onLabelGuard={() => { setView('label-automation'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} languagePref={languagePref} />
          </div>
        )}

        {/* HS Classifier View — kept reachable as a deep link, but no longer in nav */}
        {view === 'hs-classify' && (
          <div className="px-6 py-12 md:py-20 min-h-[80vh]">
            <HsClassifier
              onBack={() => {
                setView(report ? 'results' : 'landing');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              languagePref={languagePref}
              prefill={userInput ? {
                productName: userInput.productName,
                category: userInput.category,
                description: userInput.description,
                materials: userInput.materials,
                originCountry: userInput.countryOfManufacture,
                destinationCountry: userInput.destinationCountry,
                intendedUse: userInput.intendedUse,
              } : undefined}
            />
          </div>
        )}

        {/* Label Guard View */}
        {view === 'label-automation' && (
          <div className="px-6 py-12 md:py-20 min-h-[80vh]">
            <LabelGuard
              onBack={() => {
                // Smart back: if there's an active report (user came from
                // the FDA Labeling CTA inside the report), return there.
                // Otherwise, fall back to the landing page.
                setView(report ? 'results' : 'landing');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              languagePref={languagePref}
            />
          </div>
        )}

        {/* App/Form View */}
        {view === 'app' && (
          <div className="px-6 py-12 md:py-20 min-h-[80vh] flex flex-col items-center">
            <div className="max-w-3xl w-full text-center mb-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <button
                onClick={() => setView('landing')}
                className="text-slate-400 hover:text-slate-600 font-bold text-sm mb-6 flex items-center justify-center transition-colors"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
                {nav.backHome}
              </button>
              <h3 className="text-3xl font-black text-slate-900 mb-2">{nav.formTitle}</h3>
              <p className="text-slate-500 text-lg">{nav.formSub}</p>
            </div>

            {error && (
              <div className="max-w-2xl w-full mb-8 p-4 bg-red-50 border border-red-200 text-red-600 rounded-xl text-center font-bold">
                {error}
              </div>
            )}

            <div className="w-full animate-in fade-in slide-in-from-bottom-6 duration-700">
              <ComplianceForm onSubmit={handleFormSubmit} isLoading={false} languagePref={languagePref} />
            </div>
          </div>
        )}

        {/* Landing View */}
        {view === 'landing' && (
          <>
            <Hero onCtaClick={handleStartCheck} languagePref={languagePref} />

            <DemoAnimation languagePref={languagePref} />

            <Features languagePref={languagePref} />
            <Testimonials languagePref={languagePref} />

            <BottomCTA languagePref={languagePref} />
          </>
        )}
      </main>

      {/* Footer Disclaimer */}
      <footer className="bg-slate-900 text-slate-400 py-16 px-6 border-t border-slate-800">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-16 pt-8">
          <div className="space-y-6">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-slate-700 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
              </div>
              <span className="text-xl font-black text-white tracking-tight uppercase">TRADESETU</span>
            </div>
            <p className="text-base leading-relaxed max-w-sm opacity-80 font-medium">
              The intelligence layer for Indian SMB exporters. Built so a single missing form never costs you a customer.
            </p>
          </div>
          <div className="bg-slate-800/40 p-8 rounded-3xl border border-slate-700/50 backdrop-blur-sm">
            <h4 className="text-white font-black mb-4 uppercase text-xs tracking-widest flex items-center">
              <svg className="w-4 h-4 mr-2 text-amber-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"></path></svg>
              Intelligence Notice
            </h4>
            <p className="text-sm leading-relaxed italic font-medium">
              TradeSetu is a reasoning engine, not a law firm. Information provided is synthesized from US CBP and FDA databases via AI. Always cross-verify critical compliance steps with a certified Customs Broker.
            </p>
          </div>
        </div>
        <div className="max-w-7xl mx-auto mt-16 pt-8 border-t border-slate-800 text-xs font-bold flex flex-wrap justify-between gap-4 uppercase tracking-wider">
          <span className="opacity-50">© 2024 TradeSetu Intelligence Inc.</span>
          <div className="flex space-x-8">
            <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-white transition-colors">Terms</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
