
import React, { useEffect } from 'react';
import { Violation, Severity } from '../../types-labelguard';

interface FixModalProps {
  isOpen: boolean;
  onClose: () => void;
  violation: Violation | null;
  imageUrl: string;
}

const FixModal: React.FC<FixModalProps> = ({ isOpen, onClose, violation, imageUrl }) => {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen || !violation) return null;

  const getBoxStyle = (box: [number, number, number, number]) => {
    const [ymin, xmin, ymax, xmax] = box;
    return {
      top: `${(ymin / 1000) * 100}%`,
      left: `${(xmin / 1000) * 100}%`,
      height: `${((ymax - ymin) / 1000) * 100}%`,
      width: `${((xmax - xmin) / 1000) * 100}%`,
    };
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" onClick={onClose}></div>
        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-5xl sm:w-full">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="sm:flex sm:items-start h-[70vh]">

              {/* Left: Image Viewer */}
              <div className="w-full sm:w-1/2 h-full bg-gray-100 rounded-lg relative overflow-hidden flex items-center justify-center border border-gray-200">
                <div className="relative w-full h-full">
                  <img src={imageUrl} alt="Label Issue Source" className="absolute inset-0 w-full h-full object-contain" />
                  {violation.boundingBox2d && (
                    <div
                      className="absolute border-4 border-red-500 shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] animate-pulse"
                      style={getBoxStyle(violation.boundingBox2d)}
                    >
                      <span className="absolute -top-8 left-0 bg-red-600 text-white text-xs font-bold px-2 py-1 rounded">Issue Location</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Right: Fix Details */}
              <div className="mt-3 text-center sm:mt-0 sm:ml-6 sm:text-left sm:w-1/2 h-full overflow-y-auto pr-2">
                <div className="flex justify-between items-start">
                  <h3 className="text-xl leading-6 font-bold text-gray-900" id="modal-title">{violation.ruleName}</h3>
                  <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="mt-4 space-y-6">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide
                      ${violation.severity === Severity.CRITICAL ? 'bg-red-100 text-red-800' :
                        violation.severity === Severity.WARNING ? 'bg-orange-100 text-orange-800' : 'bg-blue-100 text-blue-800'}`}>
                      {violation.severity} Violation
                    </span>
                    <span className="text-sm text-gray-500 font-mono bg-gray-100 px-2 py-1 rounded">{violation.citation}</span>
                  </div>

                  <div className="text-xs text-gray-400 uppercase tracking-widest font-semibold">
                    AI Confidence: {violation.confidence}
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-1">What's Wrong?</h4>
                    <p className="text-gray-600">{violation.description}</p>
                  </div>

                  {(violation.originalText || violation.suggestedText) && (
                    <div className="grid grid-cols-1 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-200">
                      {violation.originalText && (
                        <div>
                          <span className="text-xs font-bold text-red-600 uppercase block mb-1">Detected Text</span>
                          <div className="bg-white p-2 rounded border border-red-100 text-red-800 text-sm font-mono break-words">"{violation.originalText}"</div>
                        </div>
                      )}
                      {violation.suggestedText && (
                        <div className="relative">
                          <div className="absolute left-1/2 -top-3 -ml-2 bg-white rounded-full p-1 border border-gray-200">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                            </svg>
                          </div>
                          <span className="text-xs font-bold text-green-600 uppercase block mb-1">Recommended Fix</span>
                          <div className="bg-white p-2 rounded border border-green-100 text-green-800 text-sm font-mono break-words">"{violation.suggestedText}"</div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg">
                    <h4 className="text-sm font-bold text-blue-900 uppercase mb-2 flex items-center">
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                      </svg>
                      Corrective Action
                    </h4>
                    <p className="text-blue-800 text-sm leading-relaxed">{violation.recommendation}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse border-t border-gray-100">
            <button
              type="button"
              className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none sm:ml-3 sm:w-auto sm:text-sm"
              onClick={onClose}
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FixModal;
