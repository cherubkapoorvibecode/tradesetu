
export enum Severity {
  CRITICAL = 'CRITICAL',
  WARNING = 'WARNING',
  INFO = 'INFO'
}

export enum AnalysisValidity {
  VALID = 'VALID',
  NOT_A_LABEL = 'NOT_A_LABEL',
  NON_FOOD_LABEL = 'NON_FOOD_LABEL',
  UNREADABLE = 'UNREADABLE'
}

export enum LGComplianceStatus {
  PASS = 'PASS',
  MINOR_ISSUES = 'MINOR_ISSUES',
  POTENTIAL_WARNING = 'POTENTIAL_WARNING',
  FAIL = 'FAIL',
  INVALID_INPUT = 'INVALID_INPUT'
}

export interface Violation {
  ruleName: string;
  description: string;
  citation: string;
  severity: Severity;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  recommendation: string;
  originalText?: string;
  suggestedText?: string;
  boundingBox2d?: [number, number, number, number];
}

export interface AnalysisResult {
  validity: AnalysisValidity;
  executiveSummary: string;
  status: LGComplianceStatus;
  violations: Violation[];
  mandatoryElements: {
    element: string;
    present: boolean;
    notes: string;
  }[];
}

export interface LabelFile {
  id: string;
  file: File;
  previewUrl: string;
  status: 'pending' | 'analyzing' | 'done' | 'error';
  result?: AnalysisResult;
  error?: string;
}
