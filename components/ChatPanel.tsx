
import React, { useState, useRef, useEffect } from 'react';
import { ComplianceReport, UserInput, ChatMessage, LanguagePreference } from '../types';
import { sendChatMessage, translateText, detectLanguage } from '../services/claudeService';
import { useTranslations } from '../hooks/useTranslations';
import { trackChatMessage } from '../services/analytics';

interface ChatPanelProps {
  report: ComplianceReport;
  userInput: UserInput;
  onReportUpdate: (updatedReport: ComplianceReport) => void;
  languagePref: LanguagePreference;
}

// English labels are sent to Gemini — translation is applied only for display
const GUIDED_ACTIONS_EN = [
  { label: "What should I do first?",      icon: "→" },
  { label: "Help me find a customs broker", icon: "🔍" },
  { label: "Explain the biggest risk",      icon: "⚠" },
  { label: "What are the costs breakdown?", icon: "$" },
];

// Simple markdown renderer: bold, lists, line breaks
function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];

  lines.forEach((line, i) => {
    let processed = line;

    // Bold
    processed = processed.replace(/\*\*(.*?)\*\*/g, '§BOLD_START§$1§BOLD_END§');

    // Check if it's a numbered or bulleted list item
    const isListItem = /^\s*(\d+\.|[-•])\s/.test(processed);

    // Split by bold markers and rebuild
    const parts = processed.split(/§BOLD_START§|§BOLD_END§/);
    const spans: React.ReactNode[] = [];
    parts.forEach((part, j) => {
      if (j % 2 === 1) {
        spans.push(<strong key={`${i}-${j}`} className="font-semibold text-slate-800">{part}</strong>);
      } else {
        spans.push(part);
      }
    });

    if (processed.trim() === '') {
      elements.push(<br key={i} />);
    } else if (isListItem) {
      const cleaned = processed.replace(/^\s*(\d+\.|[-•])\s/, '');
      const cleanedSpans: React.ReactNode[] = [];
      const cleanParts = cleaned.split(/§BOLD_START§|§BOLD_END§/);
      cleanParts.forEach((part, j) => {
        if (j % 2 === 1) {
          cleanedSpans.push(<strong key={`${i}-${j}`} className="font-semibold text-slate-800">{part}</strong>);
        } else {
          cleanedSpans.push(part);
        }
      });
      const bullet = processed.match(/^\s*(\d+\.|[-•])/)?.[1] || "•";
      elements.push(
        <div key={i} className="flex gap-2 py-0.5">
          <span className="text-slate-400 flex-shrink-0 w-5 text-right">{bullet}</span>
          <span>{cleanedSpans}</span>
        </div>
      );
    } else {
      elements.push(<p key={i} className="py-0.5">{spans}</p>);
    }
  });

  return elements;
}

const ChatPanel: React.FC<ChatPanelProps> = ({ report, userInput, onReportUpdate, languagePref }) => {
  const t = useTranslations({
    header:      "Need help with any step?",
    placeholder: "Ask in any language…",
    phEn:        "Ask about any compliance step...",
    g0: "What should I do first?",
    g1: "Help me find a customs broker",
    g2: "Explain the biggest risk",
    g3: "What are the costs breakdown?",
  }, languagePref);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  // englishHistory mirrors messages but always in English — Gemini never sees translated content
  const [englishHistory, setEnglishHistory] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleSend = async (text?: string) => {
    const message = text || inputValue.trim();
    if (!message || isLoading) return;

    setInputValue("");
    setError(null);
    setIsOpen(true);

    const isGuidedAction = GUIDED_ACTIONS_EN.some(a => a.label === message);
    trackChatMessage(message.length, isGuidedAction);

    const userMessage: ChatMessage = { role: "user", content: message, timestamp: Date.now() };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      // ── Multilingual: translate input to English before sending to Gemini ──
      let englishMessage = message;
      let detectedLang: string | null = languagePref;

      if (languagePref) {
        // User selected a language — assume input is in that language
        try {
          englishMessage = await translateText(message, 'en-IN', languagePref, 'modern-colloquial');
        } catch {
          // Fall through with original message — Gemini handles mixed input reasonably
        }
      } else {
        // Auto-detect if message looks non-English (skip short/ASCII-only messages)
        const hasNonAscii = /[^\x00-\x7F]/.test(message);
        if (hasNonAscii) {
          try {
            detectedLang = await detectLanguage(message);
            if (detectedLang && detectedLang !== 'en-IN') {
              englishMessage = await translateText(message, 'en-IN', detectedLang, 'modern-colloquial');
            }
          } catch {
            // Keep original message
          }
        }
      }

      // Track English message in englishHistory (Gemini context stays pure English)
      const englishUserMsg: ChatMessage = { role: "user", content: englishMessage, timestamp: Date.now() };
      const updatedEnglishHistory = [...englishHistory, englishUserMsg];
      setEnglishHistory(updatedEnglishHistory);

      const response = await sendChatMessage({
        message: englishMessage,
        conversationHistory: updatedEnglishHistory,
        originalReport: report,
        originalInput: userInput,
      });

      // Track English reply in englishHistory
      const englishReplyMsg: ChatMessage = { role: "assistant", content: response.reply, timestamp: Date.now() };
      setEnglishHistory((prev) => [...prev, englishReplyMsg]);

      // ── Translate response back to user's language ──
      let displayReply = response.reply;
      const targetLang = languagePref || (detectedLang !== 'en-IN' ? detectedLang : null);
      if (targetLang && targetLang !== 'en-IN') {
        try {
          displayReply = await translateText(response.reply, targetLang, 'en-IN', 'modern-colloquial');
        } catch {
          // Show English reply as fallback
        }
      }

      setMessages((prev) => [...prev, { role: "assistant", content: displayReply, timestamp: Date.now() }]);

      if (response.updatedReport) {
        onReportUpdate(response.updatedReport);
      }
    } catch (e: any) {
      setError("Couldn't get a response. Try again.");
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
      {/* Header — clickable to toggle */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-5 py-4 flex items-center justify-between"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <span className="text-sm font-bold text-slate-800">{t.header}</span>
          {messages.length > 0 && (
            <span className="px-1.5 py-0.5 bg-blue-100 text-blue-600 text-[10px] font-bold rounded-full">{messages.length}</span>
          )}
        </div>
        <svg className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <>
          {/* Messages or guided actions */}
          <div className="px-5 pb-3 max-h-80 overflow-y-auto">
            {messages.length === 0 && !isLoading ? (
              <div className="grid grid-cols-2 gap-2 py-2">
                {GUIDED_ACTIONS_EN.map((action, i) => {
                  const displayLabel = [t.g0, t.g1, t.g2, t.g3][i];
                  return (
                    <button
                      key={i}
                      onClick={() => handleSend(action.label)} // always send English to Gemini
                      className="text-left px-3 py-2.5 text-xs font-medium rounded-xl bg-slate-50 border border-slate-100 text-slate-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600 transition-all"
                    >
                      <span className="mr-1.5">{action.icon}</span> {displayLabel}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map((msg, idx) => (
                  <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-blue-600 text-white rounded-br-md"
                        : "bg-slate-50 text-slate-700 rounded-bl-md border border-slate-100"
                    }`}>
                      {msg.role === "assistant" ? renderMarkdown(msg.content) : msg.content}
                    </div>
                  </div>
                ))}

                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-slate-50 px-4 py-3 rounded-2xl rounded-bl-md border border-slate-100">
                      <div className="flex gap-1">
                        <span className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                    </div>
                  </div>
                )}

                {error && <p className="text-xs text-red-500 text-center">{error}</p>}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Input */}
          <div className="px-5 py-3 border-t border-slate-100 flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={languagePref ? t.placeholder : t.phEn}
              className="flex-1 px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-blue-500/10 focus:border-blue-400 outline-none transition-all"
              disabled={isLoading}
            />
            <button
              onClick={() => handleSend()}
              disabled={isLoading || !inputValue.trim()}
              className={`px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
                isLoading || !inputValue.trim()
                  ? "bg-slate-100 text-slate-300"
                  : "bg-blue-600 text-white hover:bg-blue-700"
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default ChatPanel;
