
import React, { useState, useCallback } from 'react';
import { LabelFile, LGComplianceStatus } from '../types-labelguard';
import { LanguagePreference } from '../types';
import { analyzeLabelImage, fileToBase64 } from '../services/labelGuardService';
import { generateBatchPDF } from '../services/labelGuardReportGenerator';
import FileUpload from './labelguard/FileUpload';
import AnalysisReport from './labelguard/AnalysisReport';

interface LabelGuardProps {
  onBack: () => void;
  languagePref: LanguagePreference;
}

function statusDot(status: LabelFile['status'], result?: LabelFile['result']): string {
  if (status === 'analyzing') return 'bg-blue-400 animate-pulse';
  if (status === 'error')     return 'bg-gray-400';
  if (status === 'pending')   return 'bg-slate-300';
  // done
  switch (result?.status) {
    case LGComplianceStatus.PASS:              return 'bg-green-500';
    case LGComplianceStatus.FAIL:              return 'bg-red-500';
    case LGComplianceStatus.MINOR_ISSUES:      return 'bg-orange-400';
    case LGComplianceStatus.POTENTIAL_WARNING: return 'bg-yellow-400';
    default:                                   return 'bg-gray-400';
  }
}

function statusLabel(status: LabelFile['status'], result?: LabelFile['result']): string {
  if (status === 'analyzing') return 'Analyzing…';
  if (status === 'error')     return 'Error';
  if (status === 'pending')   return 'Pending';
  switch (result?.status) {
    case LGComplianceStatus.PASS:              return 'Compliant';
    case LGComplianceStatus.FAIL:              return 'Critical Fail';
    case LGComplianceStatus.MINOR_ISSUES:      return 'Minor Issues';
    case LGComplianceStatus.POTENTIAL_WARNING: return 'Needs Review';
    case LGComplianceStatus.INVALID_INPUT:     return 'Skipped';
    default:                                   return 'Done';
  }
}

const LabelGuard: React.FC<LabelGuardProps> = ({ onBack }) => {
  const [labelFiles, setLabelFiles] = useState<LabelFile[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const selectedFile = labelFiles.find(f => f.id === selectedId) ?? null;
  const doneCount = labelFiles.filter(f => f.status === 'done').length;

  const handleFilesSelected = useCallback(async (files: File[]) => {
    const newFiles: LabelFile[] = files.map(file => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file,
      previewUrl: URL.createObjectURL(file),
      status: 'pending',
    }));

    setLabelFiles(prev => {
      const updated = [...prev, ...newFiles];
      return updated;
    });

    // Auto-select first new file
    setSelectedId(newFiles[0].id);

    // Analyze each new file sequentially
    setIsAnalyzing(true);
    for (const lf of newFiles) {
      // Mark as analyzing
      setLabelFiles(prev => prev.map(f => f.id === lf.id ? { ...f, status: 'analyzing' } : f));
      setSelectedId(lf.id);

      try {
        const { base64, mimeType } = await fileToBase64(lf.file);
        const result = await analyzeLabelImage(base64, mimeType);
        setLabelFiles(prev => prev.map(f => f.id === lf.id ? { ...f, status: 'done', result } : f));
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Analysis failed';
        setLabelFiles(prev => prev.map(f => f.id === lf.id ? { ...f, status: 'error', error: message } : f));
      }
    }
    setIsAnalyzing(false);
  }, []);

  const handleBatchDownload = () => {
    generateBatchPDF(labelFiles);
  };

  const handleRemoveFile = (id: string) => {
    setLabelFiles(prev => {
      const updated = prev.filter(f => f.id !== id);
      if (selectedId === id) {
        setSelectedId(updated.length > 0 ? updated[updated.length - 1].id : null);
      }
      return updated;
    });
  };

  return (
    <div className="max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="mb-8">
        <button
          onClick={onBack}
          className="text-slate-400 hover:text-slate-600 font-bold text-sm mb-6 flex items-center transition-colors"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back
        </button>

        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl font-black text-slate-900">FDA Label Guard</h1>
                <p className="text-slate-500 text-sm font-medium">AI-powered food label compliance for US export</p>
              </div>
            </div>
            <p className="text-slate-400 text-sm max-w-xl">
              Upload food product label images to check compliance with 21 CFR Part 101, FALCPA allergen requirements, and US import regulations.
            </p>
          </div>

          {doneCount > 1 && (
            <button
              onClick={handleBatchDownload}
              className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-bold rounded-xl hover:bg-slate-800 transition-all"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Batch PDF ({doneCount})
            </button>
          )}
        </div>
      </div>

      {labelFiles.length === 0 ? (
        /* ── Empty state: full-width upload ─────────────────────────────────── */
        <div className="max-w-2xl mx-auto">
          <FileUpload onFilesSelected={handleFilesSelected} disabled={isAnalyzing} />
          <p className="text-center text-slate-400 text-xs mt-4 font-medium">
            Analyzes compliance with 21 CFR Part 101 · FALCPA allergens · Country of Origin labeling
          </p>
        </div>
      ) : (
        /* ── Main layout: sidebar + report ───────────────────────────────────── */
        <div className="flex gap-6">
          {/* Sidebar */}
          <div className="w-72 flex-shrink-0 space-y-3">
            {/* Upload more */}
            <FileUpload onFilesSelected={handleFilesSelected} disabled={isAnalyzing} />

            {/* File list */}
            <div className="space-y-2">
              {labelFiles.map(lf => (
                <div
                  key={lf.id}
                  onClick={() => setSelectedId(lf.id)}
                  className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                    selectedId === lf.id
                      ? 'border-blue-500 bg-blue-50 shadow-sm'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  {/* Thumbnail */}
                  <div className="w-12 h-12 rounded-lg overflow-hidden bg-slate-100 flex-shrink-0">
                    <img src={lf.previewUrl} alt={lf.file.name} className="w-full h-full object-cover" />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-700 truncate">{lf.file.name}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${statusDot(lf.status, lf.result)}`} />
                      <span className="text-[11px] text-slate-500 font-medium">{statusLabel(lf.status, lf.result)}</span>
                    </div>
                    {lf.status === 'error' && lf.error && (
                      <p className="text-[10px] text-red-500 mt-0.5 truncate">{lf.error}</p>
                    )}
                  </div>

                  {/* Remove */}
                  <button
                    onClick={e => { e.stopPropagation(); handleRemoveFile(lf.id); }}
                    className="text-slate-300 hover:text-slate-500 flex-shrink-0 p-1"
                    aria-label="Remove"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Report Panel */}
          <div className="flex-1 min-w-0">
            {selectedFile?.status === 'pending' && (
              <div className="bg-white rounded-xl border border-slate-200 p-16 text-center">
                <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </div>
                <p className="text-slate-500 font-medium">Queued for analysis…</p>
              </div>
            )}

            {selectedFile?.status === 'analyzing' && (
              <div className="bg-white rounded-xl border border-slate-200 p-16 text-center">
                <div className="flex gap-1.5 justify-center mb-4">
                  <span className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <p className="text-slate-600 font-semibold">Analyzing with Gemini Vision…</p>
                <p className="text-slate-400 text-sm mt-1">Checking 21 CFR Part 101, allergens, mandatory elements</p>
              </div>
            )}

            {selectedFile?.status === 'error' && (
              <div className="bg-white rounded-xl border border-red-200 p-16 text-center">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <p className="text-red-600 font-semibold">Analysis Failed</p>
                <p className="text-slate-400 text-sm mt-1">{selectedFile.error}</p>
              </div>
            )}

            {selectedFile?.status === 'done' && selectedFile.result && (
              <AnalysisReport
                result={selectedFile.result}
                fileName={selectedFile.file.name}
                imageUrl={selectedFile.previewUrl}
              />
            )}

            {!selectedFile && (
              <div className="bg-white rounded-xl border border-slate-200 p-16 text-center">
                <p className="text-slate-400 font-medium">Select a file from the sidebar to view its report</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default LabelGuard;
