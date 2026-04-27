
import React, { useEffect, useState } from 'react';
import { LanguagePreference } from '../types';
import { useTranslations } from '../hooks/useTranslations';

interface WithLang { languagePref: LanguagePreference; }

interface HeroProps extends WithLang {
  onCtaClick: () => void;
}

export const Hero: React.FC<HeroProps> = ({ onCtaClick, languagePref }) => {
  const t = useTranslations({
    badge:       "Built from 30+ Indian exporter interviews",
    headline:    "Simplify Export Compliance for your Business",
    subheadline: "Scared of stuck shipments, rejected listings, or licensed risks? TradeSetu catches every requirement, cost, and red flag before you ship.",
    cta:         "Get your free compliance report now!",
    trusted:     "Trusted By 500+ Exporters",
  }, languagePref);

  return (
    <div className="relative pt-10 pb-12 md:pt-20 md:pb-20 px-6 text-center max-w-5xl mx-auto">
      <div className="inline-flex items-center space-x-2 px-3 py-1 bg-blue-50 border border-blue-100 rounded-full text-blue-700 text-xs font-bold uppercase tracking-widest mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
        <span>{t.badge}</span>
      </div>

      <h1 className="text-4xl md:text-7xl font-black text-slate-900 tracking-tight leading-[1.1] mb-8 animate-in fade-in slide-in-from-bottom-5 duration-700 delay-100">
        {t.headline}
      </h1>

      <p className="text-xl md:text-2xl text-slate-500 max-w-3xl mx-auto leading-relaxed font-medium mb-12 animate-in fade-in slide-in-from-bottom-6 duration-700 delay-200">
        {t.subheadline}
      </p>

      <button
        onClick={onCtaClick}
        className="animate-in fade-in slide-in-from-bottom-8 duration-700 delay-300 group relative inline-flex items-center justify-center px-8 py-4 text-lg font-bold text-white transition-all duration-200 bg-slate-900 rounded-2xl hover:bg-slate-800 hover:shadow-2xl hover:shadow-slate-900/30 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-900"
      >
        {t.cta}
        <svg className="w-5 h-5 ml-2 -mr-1 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6"></path></svg>
      </button>

      <div className="mt-12 flex justify-center items-center space-x-8 text-slate-400 grayscale opacity-60 animate-in fade-in duration-1000 delay-500">
        <span className="font-bold text-sm tracking-widest uppercase">{t.trusted}</span>
      </div>
    </div>
  );
};

export const DemoAnimation: React.FC<WithLang> = ({ languagePref }) => {
  const [activeStep, setActiveStep] = useState(0);

  const t = useTranslations({
    previewBadge:  "Live Intelligence Preview",
    previewTitle:  "See how TradeSetu protects your shipment",
    previewBody:   "Our AI engine runs 50+ regulatory checks against US Customs & Border Protection databases in real-time.",
    looping:       "Running Next Simulation...",
    s0label: "Product Identified",   s0sub: "Organic Cotton Baby Romper",
    s1label: "HTS Code Matched",     s1sub: "6111.20.6010 (Duty Free)",
    s2label: "Safety Standards",     s2sub: "CPSC & Flammability Checks",
    s3label: "Compliance Verified",  s3sub: "Ready for Export",
  }, languagePref);

  const steps = [
    { label: t.s0label, sub: t.s0sub, icon: "👕" },
    { label: t.s1label, sub: t.s1sub, icon: "🔍" },
    { label: t.s2label, sub: t.s2sub, icon: "🛡️" },
    { label: t.s3label, sub: t.s3sub, icon: "✅" },
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % (steps.length + 1));
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-6 mb-20">
      <div className="relative bg-slate-900 rounded-3xl p-8 md:p-12 overflow-hidden shadow-2xl shadow-blue-900/20 border border-slate-800">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl -mr-20 -mt-20"></div>
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-purple-500/20 rounded-full blur-3xl -ml-20 -mb-20"></div>

        <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-block px-3 py-1 bg-slate-800 text-blue-400 rounded-lg text-xs font-bold uppercase tracking-widest mb-6 border border-slate-700">
              {t.previewBadge}
            </div>
            <h3 className="text-3xl font-black text-white mb-6">
              {t.previewTitle}
            </h3>
            <p className="text-slate-400 text-lg leading-relaxed mb-8">
              {t.previewBody}
            </p>
            <div className="flex space-x-4">
              <div className="h-2 w-20 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all duration-500 ease-out"
                  style={{ width: `${Math.min(((activeStep + 1) / 4) * 100, 100)}%` }}
                ></div>
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="space-y-4">
              {steps.map((step, idx) => (
                <div
                  key={idx}
                  className={`flex items-center p-4 rounded-xl border transition-all duration-500 transform ${
                    idx <= activeStep
                      ? 'bg-slate-800/80 border-slate-700 opacity-100 translate-x-0'
                      : 'bg-slate-800/0 border-transparent opacity-0 translate-x-8'
                  } ${idx === activeStep ? 'ring-2 ring-blue-500/50 shadow-lg shadow-blue-900/50' : ''}`}
                >
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xl mr-4 bg-slate-900 border border-slate-700">
                    {step.icon}
                  </div>
                  <div>
                    <div className="text-white font-bold text-sm">{step.label}</div>
                    <div className="text-slate-400 text-xs">{step.sub}</div>
                  </div>
                  {idx <= activeStep && (
                    <div className="ml-auto">
                      <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                    </div>
                  )}
                </div>
              ))}
              {activeStep === steps.length && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-900/90 backdrop-blur-sm rounded-xl transition-all duration-300">
                  <div className="text-blue-400 font-bold animate-pulse">{t.looping}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const Features: React.FC<WithLang> = ({ languagePref }) => {
  const t = useTranslations({
    header:    "Why Indian Exporters Choose TradeSetu",
    headerSub: "Replacing expensive consultants with instant intelligence.",
    f1Title:   "Instant Reasoning",
    f1Desc:    "Don't wait weeks for a legal opinion. Our AI analyzes your product against live US CBP and FDA databases in seconds.",
    f2Title:   "High Accuracy",
    f2Desc:    "We map your specific ingredients and materials to the exact HTS codes and safety standards required for entry.",
    f3Title:   "Cost Effective",
    f3Desc:    "Start for free. Get detailed form-filling assistance for a fraction of what traditional customs brokers charge.",
  }, languagePref);

  return (
    <div className="py-24 bg-white border-t border-slate-100">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-black text-slate-900 mb-4">{t.header}</h2>
          <p className="text-lg text-slate-500 font-medium max-w-2xl mx-auto">{t.headerSub}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          <div className="space-y-4">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 mb-2">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
            </div>
            <h3 className="text-xl font-bold text-slate-900">{t.f1Title}</h3>
            <p className="text-slate-500 leading-relaxed">{t.f1Desc}</p>
          </div>

          <div className="space-y-4">
            <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600 mb-2">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            </div>
            <h3 className="text-xl font-bold text-slate-900">{t.f2Title}</h3>
            <p className="text-slate-500 leading-relaxed">{t.f2Desc}</p>
          </div>

          <div className="space-y-4">
            <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center text-amber-600 mb-2">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            </div>
            <h3 className="text-xl font-bold text-slate-900">{t.f3Title}</h3>
            <p className="text-slate-500 leading-relaxed">{t.f3Desc}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export const Testimonials: React.FC<WithLang> = ({ languagePref }) => {
  const t = useTranslations({
    header: "Trusted by Global Brands",
    q1: "Our first shipment of organic spices was stuck at Newark port for 5 days. TradeSetu helped us identify the missing Prior Notice confirmation in minutes. Now we check every shipment here first.",
    q1name: "Rajesh K.",
    q1role: "Spice Exporter, Mumbai",
    q2: "The form filling service is a lifesaver. It generated the exact Certificate of Origin I needed for my textiles. Much cheaper than my previous agent.",
    q2name: "Anita S.",
    q2role: "Textile Manufacturer, Surat",
  }, languagePref);

  return (
    <div className="py-24 bg-slate-50 border-t border-slate-200">
      <div className="max-w-7xl mx-auto px-6">
        <h2 className="text-3xl md:text-4xl font-black text-slate-900 mb-16 text-center">{t.header}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {[
            { quote: t.q1, name: t.q1name, role: t.q1role, initials: "RK" },
            { quote: t.q2, name: t.q2name, role: t.q2role, initials: "AS" },
          ].map((item, i) => (
            <div key={i} className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
              <div className="flex text-amber-400 mb-4">
                {[1,2,3,4,5].map(s => <svg key={s} className="w-5 h-5 fill-current" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>)}
              </div>
              <p className="text-slate-700 font-medium text-lg italic mb-6">"{item.quote}"</p>
              <div className="flex items-center">
                <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center font-bold text-slate-500">{item.initials}</div>
                <div className="ml-3">
                  <p className="text-sm font-bold text-slate-900">{item.name}</p>
                  <p className="text-xs font-bold text-slate-400 uppercase">{item.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export const BottomCTA: React.FC<WithLang> = ({ languagePref }) => {
  const t = useTranslations({
    headline: "Ready to ship with confidence?",
    cta:      "Get your free compliance report now!",
  }, languagePref);

  return (
    <div className="py-20 bg-slate-900 text-center px-6">
      <h2 className="text-3xl md:text-5xl font-black text-white mb-8">{t.headline}</h2>
      <button
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        className="px-10 py-5 bg-blue-600 text-white font-bold text-xl rounded-2xl hover:bg-blue-500 transition-colors shadow-lg shadow-blue-900/50"
      >
        {t.cta}
      </button>
    </div>
  );
};
