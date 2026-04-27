
import React, { useState } from 'react';
import { ProductCategory, SellingChannel, OriginCountry, DestinationCountry, IntendedUse, UserInput, LanguagePreference } from '../types';
import { useTranslations } from '../hooks/useTranslations';
import MicButton from './MicButton';
import { translateText } from '../services/claudeService';

interface Props {
  onSubmit: (data: UserInput) => void;
  isLoading: boolean;
  languagePref: LanguagePreference;
}

const ComplianceForm: React.FC<Props> = ({ onSubmit, isLoading, languagePref }) => {
  const [formData, setFormData] = useState<UserInput>({
    productName: '',
    category: ProductCategory.Food,
    description: '',
    materials: '',
    countryOfManufacture: OriginCountry.India,
    destinationCountry: DestinationCountry.USA,
    intendedUse: IntendedUse.GeneralConsumer,
    channel: SellingChannel.AmazonFBA,
    isFirstShipment: true,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const finalValue = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
    setFormData(prev => ({ ...prev, [name]: finalValue }));
  };

  const t = useTranslations({
    labelName:        "Product Name",
    labelCategory:    "Category",
    labelIntendedUse: "Intended Use",
    labelChannel:     "Selling Channel",
    labelOrigin:      "Origin Country",
    labelDest:        "Destination Country",
    labelDesc:        "Product Description",
    labelMaterials:   "Materials / Ingredients (Optional)",
    labelFirstShip:   "This is my first shipment to this destination",
    placeholderName:  "e.g. Organic Turmeric Powder",
    placeholderDesc:  "Detailed description of the product, its usage, and intended audience...",
    placeholderMat:   "e.g. 100% Cotton, Turmeric, Black Pepper",
    submitBtn:        "Generate Compliance Report",
    analyzing:        "Analyzing your shipment...",
    voiceHint:        "Tap to describe your product by voice — in any Indian language",
  }, languagePref);

  // Voice → text. The transcript may be in Hindi/Gujarati/etc — we translate to
  // English before stuffing into the form so the downstream agents stay in English.
  const handleVoice = (field: "productName" | "description" | "materials") =>
    async (text: string, languageCode: string) => {
      let englishText = text;
      if (languageCode && languageCode !== "en-IN" && languageCode !== "unknown") {
        try {
          englishText = await translateText(text, "en-IN", languageCode, "formal");
        } catch {
          // fall through with original transcript
        }
      }
      setFormData(prev => ({ ...prev, [field]: prev[field] ? `${prev[field]} ${englishText}` : englishText }));
    };

  const inputClasses = "w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none appearance-none";

  const selectWrapper = (children: React.ReactNode) => (
    <div className="relative">
      {children}
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-400">
        <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" /></svg>
      </div>
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-3xl shadow-2xl shadow-slate-200/50 p-8 md:p-10 max-w-2xl mx-auto border border-slate-100">
      <div className="space-y-8">
        <div>
          <label className="block text-sm font-bold text-slate-800 mb-2">{t.labelName}</label>
          <input
            required
            name="productName"
            value={formData.productName}
            onChange={handleChange}
            placeholder={t.placeholderName}
            className={inputClasses}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-bold text-slate-800 mb-2">{t.labelCategory}</label>
            {selectWrapper(
              <select name="category" value={formData.category} onChange={handleChange} className={inputClasses}>
                {Object.values(ProductCategory).map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            )}
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-800 mb-2">{t.labelIntendedUse}</label>
            {selectWrapper(
              <select name="intendedUse" value={formData.intendedUse} onChange={handleChange} className={inputClasses}>
                {Object.values(IntendedUse).map(use => (
                  <option key={use} value={use}>{use}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-bold text-slate-800 mb-2">{t.labelChannel}</label>
            {selectWrapper(
              <select name="channel" value={formData.channel} onChange={handleChange} className={inputClasses}>
                {Object.values(SellingChannel).map(ch => (
                  <option key={ch} value={ch}>{ch}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-bold text-slate-800 mb-2">{t.labelOrigin}</label>
            {selectWrapper(
              <select name="countryOfManufacture" value={formData.countryOfManufacture} onChange={handleChange} className={inputClasses}>
                {Object.values(OriginCountry).map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            )}
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-800 mb-2">{t.labelDest}</label>
            {selectWrapper(
              <select name="destinationCountry" value={formData.destinationCountry} onChange={handleChange} className={inputClasses}>
                {Object.values(DestinationCountry).map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-bold text-slate-800">{t.labelDesc}</label>
            <div className="flex items-center gap-2 text-[11px] text-slate-400 font-medium">
              <span className="hidden sm:inline">{t.voiceHint}</span>
              <MicButton size="sm" languagePref={languagePref} onTranscript={handleVoice("description")} title={t.voiceHint} />
            </div>
          </div>
          <textarea
            required
            name="description"
            value={formData.description}
            onChange={handleChange}
            rows={4}
            placeholder={t.placeholderDesc}
            className={`${inputClasses} resize-none`}
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-slate-800 mb-2">{t.labelMaterials}</label>
          <input
            name="materials"
            value={formData.materials}
            onChange={handleChange}
            placeholder={t.placeholderMat}
            className={inputClasses}
          />
        </div>

        <div className="flex items-center space-x-3 p-5 bg-blue-50/50 rounded-2xl border border-blue-100/50">
          <div className="relative flex items-center cursor-pointer">
            <input
              type="checkbox"
              name="isFirstShipment"
              id="isFirstShipment"
              checked={formData.isFirstShipment}
              onChange={handleChange}
              className="peer h-6 w-6 cursor-pointer appearance-none rounded-md border border-slate-300 bg-white checked:bg-blue-600 checked:border-blue-600 focus:outline-none transition-all"
            />
            <svg className="absolute h-4 w-4 text-white opacity-0 peer-checked:opacity-100 pointer-events-none left-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="4"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
          </div>
          <label htmlFor="isFirstShipment" className="text-sm font-semibold text-slate-700 cursor-pointer select-none">
            {t.labelFirstShip}
          </label>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className={`w-full py-5 rounded-2xl font-extrabold text-lg transition-all transform active:scale-[0.99] ${
            isLoading
              ? 'bg-slate-200 cursor-not-allowed text-slate-400'
              : 'bg-blue-600 hover:bg-blue-700 text-white shadow-xl shadow-blue-500/20'
          }`}
        >
          {isLoading ? (
            <div className="flex items-center justify-center space-x-3">
              <svg className="animate-spin h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
              <span>{t.analyzing}</span>
            </div>
          ) : t.submitBtn}
        </button>
      </div>
    </form>
  );
};

export default ComplianceForm;
