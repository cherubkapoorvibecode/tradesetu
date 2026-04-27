
import React, { useState } from 'react';
import { AnalysisResult, Severity, LGComplianceStatus, Violation, AnalysisValidity } from '../../types-labelguard';
import InfoTooltip from './InfoTooltip';
import FixModal from './FixModal';
import { generatePDF } from '../../services/labelGuardReportGenerator';

interface AnalysisReportProps {
  result: AnalysisResult;
  fileName: string;
  imageUrl: string;
}

const AnalysisReport: React.FC<AnalysisReportProps> = ({ result, fileName, imageUrl }) => {
  const [selectedViolation, setSelectedViolation] = useState<Violation | null>(null);

  const getStatusColor = (status: LGComplianceStatus) => {
    switch (status) {
      case LGComplianceStatus.PASS:              return 'bg-green-100 text-green-800 border-green-200';
      case LGComplianceStatus.FAIL:              return 'bg-red-100 text-red-800 border-red-200';
      case LGComplianceStatus.MINOR_ISSUES:      return 'bg-orange-100 text-orange-800 border-orange-200';
      case LGComplianceStatus.POTENTIAL_WARNING: return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case LGComplianceStatus.INVALID_INPUT:     return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusLabel = (status: LGComplianceStatus) => {
    switch (status) {
      case LGComplianceStatus.PASS:              return 'Compliant';
      case LGComplianceStatus.FAIL:              return 'Critical Fail';
      case LGComplianceStatus.MINOR_ISSUES:      return 'Minor Issues';
      case LGComplianceStatus.POTENTIAL_WARNING: return 'Needs Review';
      case LGComplianceStatus.INVALID_INPUT:     return 'Analysis Skipped';
    }
  };

  const getSeverityBadge = (severity: Severity) => {
    switch (severity) {
      case Severity.CRITICAL:
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-200">CRITICAL</span>;
      case Severity.WARNING:
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-orange-100 text-orange-800 border border-orange-200">WARNING</span>;
      case Severity.INFO:
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">INFO</span>;
    }
  };

  const handleDownload = () => generatePDF(result, fileName);

  // ── Invalid Input View ─────────────────────────────────────────────────────
  if (result.validity !== AnalysisValidity.VALID) {
    return (
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden p-8 text-center h-full flex flex-col items-center justify-center">
        <div className="bg-gray-100 p-4 rounded-full mb-6">
          {result.validity === AnalysisValidity.NOT_A_LABEL ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          ) : result.validity === AnalysisValidity.NON_FOOD_LABEL ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
            </svg>
          )}
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">Analysis Skipped</h3>
        <div className="inline-block px-3 py-1 rounded-full bg-gray-100 text-gray-600 text-xs font-bold mb-6">
          REASON: {result.validity.replace(/_/g, " ")}
        </div>
        <p className="text-gray-600 max-w-md mx-auto leading-relaxed mb-8">{result.executiveSummary}</p>
        <button onClick={handleDownload} className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Download Log
        </button>
      </div>
    );
  }

  // ── Normal Report View ─────────────────────────────────────────────────────
  return (
    <>
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
          <div>
            <h3 className="text-xl font-bold text-gray-900 mb-1">{fileName}</h3>
            <p className="text-gray-500 text-sm">FDA Compliance Report</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleDownload}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download PDF
            </button>
            <div className={`px-4 py-2 rounded-lg border text-sm font-bold uppercase tracking-wide ${getStatusColor(result.status)}`}>
              {getStatusLabel(result.status)}
            </div>
          </div>
        </div>

        {/* Executive Summary */}
        <div className="p-6 bg-gray-50 border-b border-gray-100">
          <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">Executive Summary</h4>
          <p className="text-gray-700 leading-relaxed">{result.executiveSummary}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
          {/* Violations */}
          <div className="p-6 border-r border-gray-100">
            <div className="flex items-center mb-4">
              <h4 className="text-lg font-semibold text-gray-900">Violations & Warnings</h4>
              <InfoTooltip content="Issues detected based on 21 CFR Part 101 and FALCPA regulations." />
            </div>

            {result.violations.length === 0 ? (
              <div className="text-center py-8 text-green-600 bg-green-50 rounded-lg">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="font-medium">No violations detected</p>
              </div>
            ) : (
              <div className="space-y-4">
                {result.violations.map((v, idx) => (
                  <div key={idx} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow relative">
                    <div className="flex justify-between items-start mb-2">
                      <h5 className="font-semibold text-gray-900 pr-20">{v.ruleName}</h5>
                      <div className="absolute top-4 right-4">{getSeverityBadge(v.severity)}</div>
                    </div>
                    <p className="text-gray-600 text-sm mb-3">{v.description}</p>
                    <div className="flex items-center text-xs text-gray-500 mb-4">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                      <span>Ref: {v.citation}</span>
                    </div>
                    <button
                      onClick={() => setSelectedViolation(v)}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 text-sm font-semibold rounded-md border border-blue-100 hover:bg-blue-100 transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Fix it
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Mandatory Elements Checklist */}
          <div className="p-6">
            <div className="flex items-center mb-4">
              <h4 className="text-lg font-semibold text-gray-900">Mandatory Elements Checklist</h4>
              <InfoTooltip content="Verification of the 7 mandatory label elements required by FDA." />
            </div>
            <div className="space-y-2">
              {result.mandatoryElements.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:bg-gray-50">
                  <div>
                    <span className="text-gray-700 font-medium">{item.element}</span>
                    {item.notes && <span className="text-xs text-gray-500 ml-2 block sm:inline">({item.notes})</span>}
                  </div>
                  <div className="flex items-center">
                    {item.present ? (
                      <span className="flex items-center text-green-600 text-sm font-semibold">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        Present
                      </span>
                    ) : (
                      <span className="flex items-center text-red-600 text-sm font-semibold">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                        Missing
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <FixModal
        isOpen={!!selectedViolation}
        onClose={() => setSelectedViolation(null)}
        violation={selectedViolation}
        imageUrl={imageUrl}
      />
    </>
  );
};

export default AnalysisReport;
