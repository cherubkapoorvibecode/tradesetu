
import React, { useState } from 'react';
import { ProductCategory, OriginCountry, DestinationCountry, IntendedUse, HsClassificationResult, HsClassifyInput, LanguagePreference } from '../types';
import { classifyHsCode } from '../services/claudeService';
import { useTranslations } from '../hooks/useTranslations';

interface Props {
  onBack: () => void;
  prefill?: Partial<HsClassifyInput>;
  languagePref: LanguagePreference;
}

const HsClassifier: React.FC<Props> = ({ onBack, prefill, languagePref }) => {
  const [form, setForm] = useState<HsClassifyInput>({
    productName: prefill?.productName || '',
    category: prefill?.category || ProductCategory.Food,
    description: prefill?.description || '',
    materials: prefill?.materials || '',
    originCountry: prefill?.originCountry || OriginCountry.India,
    destinationCountry: prefill?.destinationCountry || DestinationCountry.USA,
    intendedUse: prefill?.intendedUse || IntendedUse.GeneralConsumer,
    additionalDetails: '',
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<HsClassificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ─── Translations ───
  const t = useTranslations({
    // Form
    pageTitle:       "HS Code Classifier",
    pageSubtitle:    "Get the right tariff code for your product in seconds.",
    back:            "Back",
    labelName:       "Product Name",
    labelCategory:   "Category",
    labelIntended:   "Intended Use",
    labelDesc:       "Product Description",
    labelMaterials:  "Materials / Ingredients",
    labelOrigin:     "Origin Country",
    labelDest:       "Destination Country",
    labelAdditional: "Additional Details (Optional)",
    phName:          "e.g. Organic Turmeric Powder",
    phDesc:          "Describe the product, how it's made, and what it's used for...",
    phMaterials:     "e.g. 100% Cotton, Turmeric, Black Pepper",
    phAdditional:    "e.g. Retail packaging, 500g pouches, organic certified",
    submitBtn:       "Classify HS Code",
    classifying:     "Classifying...",
    // Results
    classifyAnother: "Classify another",
    recommendedHs:   "Recommended HS Code",
    confidence:      "confidence",
    chapter:         "Chapter",
    dutyRate:        "Duty Rate",
    reasoning:       "Classification Reasoning",
    keyFactors:      "Key Classification Factors",
    alternatives:    "Alternative Classifications",
    duty:            "Duty",
    risks:           "Classification Risks",
    ftaHeader:       "Free Trade Agreements",
    eligible:        "Eligible",
    notEligible:     "Not Eligible",
    backToTools:     "Back to tools",
  }, languagePref);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await classifyHsCode(form);
      setResult(res);
    } catch (err: any) {
      setError(err.message || "Classification failed");
    } finally {
      setLoading(false);
    }
  };

  const inputCls = "w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none appearance-none";

  const selectWrap = (children: React.ReactNode) => (
    <div className="relative">
      {children}
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-400">
        <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" /></svg>
      </div>
    </div>
  );

  const confidenceColor = (c: string) =>
    c === "High"   ? "bg-emerald-100 text-emerald-700" :
    c === "Medium" ? "bg-amber-100 text-amber-700" :
                     "bg-red-100 text-red-700";

  // ─── Results View ───
  if (result) {
    return (
      <div className="max-w-3xl mx-auto space-y-6 pb-20">
        <div>
          <button onClick={() => setResult(null)} className="text-slate-400 hover:text-slate-600 text-sm font-semibold flex items-center gap-1.5 mb-2 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            {t.classifyAnother}
          </button>
          <h1 className="text-2xl font-black text-slate-900">{form.productName}</h1>
          <p className="text-sm text-slate-500 mt-0.5">{form.originCountry} → {form.destinationCountry}</p>
        </div>

        {/* Primary Code — Hero Card */}
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-6 text-white shadow-xl">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-blue-200 font-bold uppercase tracking-wider mb-1">{t.recommendedHs}</p>
              <p className="text-4xl font-black tracking-tight">{result.primaryCode.hsCode}</p>
              <p className="text-sm text-blue-100 mt-2 max-w-md">{result.primaryCode.description}</p>
            </div>
            <div className="text-right">
              <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-bold ${
                result.primaryCode.confidence === "High"   ? "bg-white/20 text-white" :
                result.primaryCode.confidence === "Medium" ? "bg-amber-400/30 text-amber-100" :
                                                             "bg-red-400/30 text-red-100"
              }`}>
                {result.primaryCode.confidence} {t.confidence}
              </span>
              <p className="text-xs text-blue-200 mt-3">{t.chapter}</p>
              <p className="text-sm font-bold text-white">{result.primaryCode.chapter}</p>
              <p className="text-xs text-blue-200 mt-2">{t.dutyRate}</p>
              <p className="text-sm font-bold text-white">{result.primaryCode.dutyRate}</p>
            </div>
          </div>
        </div>

        {/* Classification Reasoning */}
        <div className="bg-white rounded-xl p-5 border border-slate-100">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{t.reasoning}</h3>
          <p className="text-sm text-slate-700 leading-relaxed">{result.classificationReasoning}</p>
        </div>

        {/* Key Factors */}
        <div className="bg-white rounded-xl p-5 border border-slate-100">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">{t.keyFactors}</h3>
          <div className="flex flex-wrap gap-2">
            {result.keyFactors.map((f, i) => (
              <span key={i} className="px-3 py-1.5 bg-blue-50 text-blue-700 text-xs font-semibold rounded-lg">{f}</span>
            ))}
          </div>
        </div>

        {/* Alternative Codes */}
        {result.alternativeCodes.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t.alternatives}</h3>
            {result.alternativeCodes.map((alt, i) => (
              <div key={i} className="bg-white rounded-xl p-4 border border-slate-100 flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-black text-slate-900">{alt.hsCode}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${confidenceColor(alt.confidence)}`}>{alt.confidence}</span>
                  </div>
                  <p className="text-sm text-slate-600 mt-1">{alt.description}</p>
                  <p className="text-xs text-slate-400 mt-1.5">{alt.whyDifferent}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs text-slate-400">{t.duty}</p>
                  <p className="text-sm font-bold text-slate-700">{alt.dutyRate}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Warnings */}
        {result.warnings.length > 0 && (
          <div className="bg-amber-50 rounded-xl p-5 border border-amber-100">
            <h3 className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
              {t.risks}
            </h3>
            <ul className="space-y-2">
              {result.warnings.map((w, i) => (
                <li key={i} className="text-sm text-amber-800 flex items-start gap-2">
                  <span className="text-amber-400 mt-0.5">-</span>{w}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Free Trade Agreements */}
        {result.freeTradeAgreements.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t.ftaHeader}</h3>
            {result.freeTradeAgreements.map((fta, i) => (
              <div key={i} className={`flex items-center justify-between p-4 rounded-xl border ${
                fta.eligible ? "bg-emerald-50/50 border-emerald-100" : "bg-slate-50 border-slate-100"
              }`}>
                <div>
                  <p className="text-sm font-semibold text-slate-900">{fta.agreement}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{fta.benefit}</p>
                </div>
                <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold ${
                  fta.eligible ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-500"
                }`}>
                  {fta.eligible ? t.eligible : t.notEligible}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="pt-4">
          <button onClick={onBack} className="text-sm text-slate-400 hover:text-slate-600 font-semibold transition-colors">
            {t.backToTools}
          </button>
        </div>
      </div>
    );
  }

  // ─── Form View ───
  return (
    <div className="max-w-2xl mx-auto pb-20">
      <div className="text-center mb-10">
        <button onClick={onBack} className="text-slate-400 hover:text-slate-600 font-bold text-sm mb-6 flex items-center justify-center transition-colors">
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          {t.back}
        </button>
        <h2 className="text-3xl font-black text-slate-900 mb-2">{t.pageTitle}</h2>
        <p className="text-slate-500 text-lg">{t.pageSubtitle}</p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-600 rounded-xl text-center font-bold">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-3xl shadow-2xl shadow-slate-200/50 p-8 md:p-10 border border-slate-100 space-y-8">
        <div>
          <label className="block text-sm font-bold text-slate-800 mb-2">{t.labelName}</label>
          <input required name="productName" value={form.productName} onChange={handleChange} placeholder={t.phName} className={inputCls} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-bold text-slate-800 mb-2">{t.labelCategory}</label>
            {selectWrap(
              <select name="category" value={form.category} onChange={handleChange} className={inputCls}>
                {Object.values(ProductCategory).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            )}
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-800 mb-2">{t.labelIntended}</label>
            {selectWrap(
              <select name="intendedUse" value={form.intendedUse} onChange={handleChange} className={inputCls}>
                {Object.values(IntendedUse).map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-bold text-slate-800 mb-2">{t.labelDesc}</label>
          <textarea required name="description" value={form.description} onChange={handleChange} rows={3} placeholder={t.phDesc} className={`${inputCls} resize-none`} />
        </div>

        <div>
          <label className="block text-sm font-bold text-slate-800 mb-2">{t.labelMaterials}</label>
          <input name="materials" value={form.materials} onChange={handleChange} placeholder={t.phMaterials} className={inputCls} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-bold text-slate-800 mb-2">{t.labelOrigin}</label>
            {selectWrap(
              <select name="originCountry" value={form.originCountry} onChange={handleChange} className={inputCls}>
                {Object.values(OriginCountry).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            )}
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-800 mb-2">{t.labelDest}</label>
            {selectWrap(
              <select name="destinationCountry" value={form.destinationCountry} onChange={handleChange} className={inputCls}>
                {Object.values(DestinationCountry).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-bold text-slate-800 mb-2">{t.labelAdditional}</label>
          <input name="additionalDetails" value={form.additionalDetails} onChange={handleChange} placeholder={t.phAdditional} className={inputCls} />
        </div>

        <button type="submit" disabled={loading} className={`w-full py-5 rounded-2xl font-extrabold text-lg transition-all transform active:scale-[0.99] ${
          loading ? 'bg-slate-200 cursor-not-allowed text-slate-400' : 'bg-blue-600 hover:bg-blue-700 text-white shadow-xl shadow-blue-500/20'
        }`}>
          {loading ? (
            <div className="flex items-center justify-center space-x-3">
              <svg className="animate-spin h-6 w-6" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
              <span>{t.classifying}</span>
            </div>
          ) : t.submitBtn}
        </button>
      </form>
    </div>
  );
};

export default HsClassifier;
