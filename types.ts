
export enum ProductCategory {
  Food = "Food",
  Cosmetics = "Cosmetics",
  Toys = "Toys / Children's products",
  Apparel = "Apparel / Textile",
  Electronics = "Electronics",
  Other = "Other consumer goods"
}

export enum SellingChannel {
  AmazonFBA = "Amazon FBA",
  AmazonFBM = "Amazon FBM",
  OwnWebsite = "Own Website / D2C"
}

export enum OriginCountry {
  India = "India",
  China = "China",
  Vietnam = "Vietnam",
  Bangladesh = "Bangladesh",
  SriLanka = "Sri Lanka",
  Thailand = "Thailand",
  Indonesia = "Indonesia",
  Other = "Other"
}

export enum IntendedUse {
  GeneralConsumer = "General Consumer",
  AdultOnly = "Adult Only",
  ChildrenUnder12 = "Children (Under 12)",
  InfantToddler = "Infant / Toddler",
  Medical = "Medical / Health",
  Industrial = "Industrial / Commercial",
  FoodBeverage = "Food & Beverage",
  PetAnimal = "Pet / Animal",
}

export enum DestinationCountry {
  USA = "United States",
  UK = "United Kingdom",
  UAE = "United Arab Emirates",
  Germany = "Germany",
  Australia = "Australia",
  Canada = "Canada",
  Singapore = "Singapore",
  Netherlands = "Netherlands",
  Japan = "Japan",
  SaudiArabia = "Saudi Arabia"
}

export interface UserInput {
  productName: string;
  category: ProductCategory;
  description: string;
  materials: string;
  countryOfManufacture: string;
  destinationCountry: string;
  intendedUse: IntendedUse;
  channel: SellingChannel;
  isFirstShipment: boolean;
}

export interface ComplianceItem {
  name: string;
  reason: string;
  enforcedBy: string;
  risk: "High" | "Medium" | "Low";
  // Layer 2 - detailed view
  detailedExplanation?: string;
  regulations?: string[];
  // Layer 3 - full audit view
  reasoningTrace?: string;
  citations?: string[];
  alternativeInterpretations?: string[];
}

export interface ComplianceReport {
  summary: string;
  requiredCompliance: ComplianceItem[];
  notRequired: string[];
  documentsNeeded: string[];
  timeline: string;
  costRange: string;
  bottleneck: string;
}

// Chat types
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export interface ChatRequest {
  message: string;
  conversationHistory: ChatMessage[];
  originalReport: ComplianceReport;
  originalInput: UserInput;
  sessionId?: string;
}

export interface ChatResponse {
  reply: string;
  updatedReport?: ComplianceReport;
}

// Progress tracking
export type ComplianceStatus = "not_started" | "in_progress" | "completed" | "not_applicable";

export interface ComplianceProgress {
  [itemName: string]: ComplianceStatus;
}

// Feedback types
export type FeedbackReason = "incorrect" | "too_vague" | "not_applicable" | "missing_context";

export interface FeedbackEntry {
  itemName: string;
  isPositive: boolean;
  reason?: FeedbackReason;
  timestamp: number;
}

export interface FeedbackRequest {
  itemName: string;
  isPositive: boolean;
  reason?: FeedbackReason;
  category?: string;
  tradeRoute?: string;
  sessionId?: string;
}

// HS Classification types
export interface HsCode {
  hsCode: string;
  description: string;
  dutyRate: string;
  confidence: "High" | "Medium" | "Low";
}

export interface HsPrimaryCode extends HsCode {
  chapter: string;
}

export interface HsAlternativeCode extends HsCode {
  whyDifferent: string;
}

export interface FreeTradeAgreement {
  agreement: string;
  benefit: string;
  eligible: boolean;
}

export interface HsClassificationResult {
  primaryCode: HsPrimaryCode;
  alternativeCodes: HsAlternativeCode[];
  classificationReasoning: string;
  keyFactors: string[];
  warnings: string[];
  freeTradeAgreements: FreeTradeAgreement[];
}

export interface HsClassifyInput {
  productName: string;
  category: string;
  description: string;
  materials: string;
  originCountry: string;
  destinationCountry: string;
  intendedUse?: string;
  additionalDetails?: string;
}

// ─── Sarvam AI — Indian Language Support ───

export type SarvamLanguageCode =
  | 'hi-IN'   // Hindi
  | 'gu-IN'   // Gujarati
  | 'ta-IN'   // Tamil
  | 'te-IN'   // Telugu
  | 'kn-IN'   // Kannada
  | 'ml-IN'   // Malayalam
  | 'mr-IN'   // Marathi
  | 'pa-IN'   // Punjabi
  | 'bn-IN'   // Bengali
  | 'od-IN'   // Odia
  | 'ur-IN'   // Urdu
  | 'en-IN';  // English (Indian)

// null = English (default), no translation needed
export type LanguagePreference = SarvamLanguageCode | null;

export interface LanguageOption {
  code: SarvamLanguageCode | null;
  label: string;    // native script label: "हिन्दी", "ગુજરાતી", etc.
  labelEn: string;  // english name: "Hindi", "Gujarati", etc.
}

// Translated overlay — stored alongside ComplianceReport, never replaces it
// Uses item.name (English) as stable key — name is never translated in the key, only in display
export interface TranslatedReport {
  summary: string;
  items: Record<string, {
    name?: string;             // translated display name (keep English as progress key)
    reason: string;
    enforcedBy?: string;
    detailedExplanation?: string;
  }>;
  documents?: string[];        // translated document names (index-matched to report.documentsNeeded)
}
