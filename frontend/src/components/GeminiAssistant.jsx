import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Send,
  Bot,
  User,
  X,
  AlertCircle,
  Key,
  RefreshCw,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  HelpCircle,
  Lightbulb,
  ArrowRight,
  ShieldCheck,
  Layers,
  GraduationCap,
  MessageSquare
} from 'lucide-react';
import { getApiUrl } from '../config.js';

// Predefined commonly confused digit pairs for instant tutoring
const CONFUSED_PAIRS = [
  { p: 1, c: 7, label: '1 vs. 7', tag: 'Serif vs. Crossbar' },
  { p: 3, c: 8, label: '3 vs. 8', tag: 'Open Waist vs. Closed Loops' },
  { p: 4, c: 9, label: '4 vs. 9', tag: 'Right Angle vs. Closed Loop' },
  { p: 5, c: 6, label: '5 vs. 6', tag: 'Top Cap vs. Continuous Spiral' },
  { p: 0, c: 6, label: '0 vs. 6', tag: 'Symmetry vs. Ascender Stem' },
  { p: 2, c: 7, label: '2 vs. 7', tag: 'Flat Base vs. Angled Descent' }
];

export default function GeminiAssistant({
  isOpen,
  onClose,
  activePrediction,
  explanationData
}) {
  const [activeTab, setActiveTab] = useState('tutor'); // 'tutor' or 'chat'
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: "👋 Hi! I'm your DigitVision AI Handwriting Tutor & CNN Specialist. Ask me why specific digits are confused, how to improve your stroke clarity, or how our convolutional neural network extracts features!"
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isConfigured, setIsConfigured] = useState(true);
  const [lastError, setLastError] = useState(null);
  const [tutorData, setTutorData] = useState(null);
  const [selectedPair, setSelectedPair] = useState(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen && activeTab === 'chat') {
      scrollToBottom();
    }
  }, [messages, isOpen, activeTab]);

  // Request tutoring analysis for a specific digit pair or prediction
  const fetchTutorAdvice = async (pair = null, customPrompt = '') => {
    setLoading(true);
    setLastError(null);

    const predDigit = pair
      ? pair.p
      : (activePrediction && typeof activePrediction.predicted_digit === 'number'
          ? activePrediction.predicted_digit
          : (activePrediction && activePrediction.prediction !== undefined ? activePrediction.prediction : null));

    const compDigit = pair
      ? pair.c
      : (activePrediction && activePrediction.top_candidates && activePrediction.top_candidates.length > 1
          ? activePrediction.top_candidates[1].digit
          : null);

    const payload = {
      prompt: customPrompt || (pair
        ? `Explain why handwritten digit ${pair.p} is frequently confused with digit ${pair.c}, and provide practical stroke advice and a practice exercise.`
        : (predDigit !== null
            ? `Analyze my handwritten digit ${predDigit} and provide practical stroke improvement tips.`
            : 'Provide general handwriting clarity tips for MNIST digits.')),
      predicted_digit: predDigit,
      comparison_digit: compDigit,
      confidence: activePrediction ? activePrediction.confidence : null,
      probabilities: activePrediction ? activePrediction.probabilities : {},
      layer: (explanationData && explanationData.layer) || 'conv2_2'
    };

    try {
      const res = await fetch(getApiUrl('/api/assistant'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (data.configured === false) {
        setIsConfigured(false);
      } else {
        setIsConfigured(true);
      }

      if (res.ok && data.success) {
        setTutorData(data);
        if (customPrompt) {
          setMessages((prev) => [
            ...prev,
            { role: 'user', text: customPrompt },
            { role: 'assistant', text: data.reply }
          ]);
        }
      } else {
        const errMsg = data.error || 'Failed to retrieve handwriting tutor advice.';
        setLastError(errMsg);
        if (customPrompt) {
          setMessages((prev) => [
            ...prev,
            { role: 'user', text: customPrompt },
            { role: 'assistant', text: `⚠️ ${errMsg}` }
          ]);
        }
      }
    } catch (err) {
      const netErr = 'Network error: Unable to connect to the Handwriting Tutor backend.';
      setLastError(netErr);
      if (customPrompt) {
        setMessages((prev) => [
          ...prev,
          { role: 'user', text: customPrompt },
          { role: 'assistant', text: `⚠️ ${netErr}` }
        ]);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPair = (pair) => {
    setSelectedPair(pair);
    fetchTutorAdvice(pair);
  };

  const handleAnalyzeCurrentPrediction = () => {
    setSelectedPair(null);
    fetchTutorAdvice(null);
  };

  const handleSendChat = (e) => {
    if (e) e.preventDefault();
    const promptToSend = input.trim();
    if (!promptToSend || loading) return;

    setInput('');
    fetchTutorAdvice(null, promptToSend);
  };

  if (!isOpen) return null;

  const currentDigit = activePrediction
    ? (typeof activePrediction.predicted_digit === 'number'
        ? activePrediction.predicted_digit
        : activePrediction.prediction)
    : null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[500px] bg-[#0b0f19] border-l border-slate-800 shadow-2xl flex flex-col backdrop-blur-xl">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/80 backdrop-blur-md">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-cyan-500 flex items-center justify-center text-white shadow-md shadow-indigo-600/30">
            <GraduationCap className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-sm font-bold text-white tracking-tight">Handwriting Tutor</h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-indigo-500/10 text-indigo-300 border border-indigo-500/30">
                {isConfigured ? 'Gemini 2.5' : 'Offline Engine'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">Pedagogical stroke advice & confusion analysis</p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          title="Close Tutor Drawer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Mode Navigation Tabs */}
      <div className="flex border-b border-slate-800 bg-slate-950/60 px-4 pt-2 space-x-2">
        <button
          onClick={() => setActiveTab('tutor')}
          className={`flex items-center space-x-2 px-3 py-2 text-xs font-semibold rounded-t-lg transition-all border-b-2 ${
            activeTab === 'tutor'
              ? 'text-indigo-300 border-indigo-500 bg-slate-900/80'
              : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-slate-900/40'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Tutor & Stroke Advice</span>
        </button>
        <button
          onClick={() => setActiveTab('chat')}
          className={`flex items-center space-x-2 px-3 py-2 text-xs font-semibold rounded-t-lg transition-all border-b-2 ${
            activeTab === 'chat'
              ? 'text-indigo-300 border-indigo-500 bg-slate-900/80'
              : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-slate-900/40'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>Interactive Chat</span>
        </button>
      </div>

      {/* Unconfigured Notice (if key is missing) */}
      {!isConfigured && (
        <div className="mx-4 mt-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-start space-x-2.5">
          <Key className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="text-[11px] text-slate-300 leading-relaxed">
            <span className="font-semibold text-amber-200">Offline Tutor Active: </span>
            Operating using the built-in domain knowledge base. For live generative responses, set <code className="text-amber-200 bg-slate-900 px-1 rounded">GEMINI_API_KEY</code> in <code className="text-slate-300">backend/.env</code>.
          </div>
        </div>
      )}

      {/* Main Tab Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {activeTab === 'tutor' ? (
          <>
            {/* Active Prediction Feedback Card */}
            {currentDigit !== null && (
              <div className="p-3.5 rounded-xl bg-slate-900/80 border border-indigo-500/30 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-slate-400 font-medium">Current Drawing:</span>
                    <span className="px-2 py-0.5 rounded-md text-xs font-bold font-mono bg-brand-500/20 text-brand-300 border border-brand-500/30">
                      Digit {currentDigit}
                    </span>
                    {activePrediction && activePrediction.confidence && (
                      <span className="text-[11px] text-slate-400">
                        ({(activePrediction.confidence * 100).toFixed(1)}% conf)
                      </span>
                    )}
                  </div>

                  <button
                    onClick={handleAnalyzeCurrentPrediction}
                    disabled={loading}
                    className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium shadow-md shadow-indigo-600/20 transition-all disabled:opacity-50"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Analyze This Digit</span>
                  </button>
                </div>

                {explanationData && explanationData.layer && (
                  <div className="flex items-center space-x-1.5 text-[11px] text-indigo-300 bg-indigo-950/40 px-2 py-1 rounded-lg border border-indigo-500/20 font-mono">
                    <Layers className="w-3.5 h-3.5" />
                    <span>Grad-CAM Context: Layer {explanationData.layer} attention map available</span>
                  </div>
                )}
              </div>
            )}

            {/* Commonly Confused Digit Pairs Explorer */}
            <div>
              <div className="flex items-center space-x-1.5 text-xs font-semibold text-slate-300 mb-2">
                <Lightbulb className="w-4 h-4 text-amber-400" />
                <span>Commonly Confused Digit Pairs:</span>
              </div>
              <p className="text-[11px] text-slate-400 mb-2.5">
                Select a pair to explore why the CNN may confuse them and how to write them with maximum clarity:
              </p>

              <div className="grid grid-cols-2 gap-2">
                {CONFUSED_PAIRS.map((pair) => {
                  const isSelected = selectedPair && selectedPair.p === pair.p && selectedPair.c === pair.c;
                  return (
                    <button
                      key={`${pair.p}-${pair.c}`}
                      onClick={() => handleSelectPair(pair)}
                      disabled={loading}
                      className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                        isSelected
                          ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-lg shadow-indigo-600/10'
                          : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-900'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="text-xs font-bold font-mono text-indigo-300">{pair.label}</span>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                      </div>
                      <span className="text-[10px] text-slate-400 mt-1 line-clamp-1">{pair.tag}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Loading Indicator */}
            {loading && (
              <div className="p-6 rounded-2xl bg-slate-900/50 border border-indigo-500/20 flex flex-col items-center justify-center text-center animate-pulse space-y-2">
                <div className="w-8 h-8 rounded-full border-2 border-indigo-500/30 border-t-indigo-400 animate-spin" />
                <span className="text-xs font-semibold text-white">Analyzing Stroke Mechanics...</span>
                <span className="text-[11px] text-slate-400">
                  Cross-referencing CNN feature activations & confusion matrix geometry
                </span>
              </div>
            )}

            {/* Error & Retry State */}
            {lastError && !loading && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs space-y-2">
                <div className="flex items-center space-x-2 font-semibold">
                  <AlertCircle className="w-4 h-4 text-rose-400" />
                  <span>Tutor Service Notice</span>
                </div>
                <p className="text-[11px] text-slate-300">{lastError}</p>
                <button
                  onClick={() => fetchTutorAdvice(selectedPair)}
                  className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-medium transition-colors"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Retry Request</span>
                </button>
              </div>
            )}

            {/* Structured Tutor Guidance Card */}
            {tutorData && !loading && (
              <div className="rounded-2xl bg-slate-900/90 border border-indigo-500/30 p-4 space-y-4 shadow-xl">
                {/* Tutor Header with Source Badge */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center space-x-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold text-white">Pedagogical Feedback</span>
                  </div>
                  {tutorData.fallback && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                      Offline Domain Engine
                    </span>
                  )}
                </div>

                {/* Structured Sections if available */}
                {tutorData.tutor_analysis ? (
                  <div className="space-y-3.5 text-xs leading-relaxed">
                    {/* Confusion Reason */}
                    {tutorData.tutor_analysis.confusion_reason && (
                      <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                        <span className="font-semibold text-indigo-300 block mb-1">
                          🔍 Why Confusions Occur:
                        </span>
                        <p className="text-slate-300 text-[11px]">
                          {tutorData.tutor_analysis.confusion_reason}
                        </p>
                      </div>
                    )}

                    {/* Stroke Tips */}
                    {tutorData.tutor_analysis.stroke_tips && tutorData.tutor_analysis.stroke_tips.length > 0 && (
                      <div>
                        <span className="font-semibold text-white block mb-1.5 flex items-center space-x-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-brand-400" />
                          <span>Actionable Stroke Rules:</span>
                        </span>
                        <ul className="space-y-1.5 pl-1">
                          {tutorData.tutor_analysis.stroke_tips.map((tip, idx) => (
                            <li key={idx} className="flex items-start space-x-2 text-[11px] text-slate-300">
                              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 shrink-0" />
                              <span>{tip}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Practice Drill */}
                    {tutorData.tutor_analysis.practice_exercise && (
                      <div className="p-3 rounded-xl bg-purple-950/30 border border-purple-500/30 text-purple-200">
                        <span className="font-semibold text-purple-300 block text-[11px] mb-1">
                          🎯 Targeted Practice Drill:
                        </span>
                        <p className="text-[11px] text-purple-100/90">
                          {tutorData.tutor_analysis.practice_exercise}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-slate-200 whitespace-pre-wrap font-sans leading-relaxed">
                    {tutorData.reply}
                  </div>
                )}
              </div>
            )}

            {!tutorData && !loading && (
              <div className="p-8 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-2xl">
                <BookOpen className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-50" />
                <p className="text-slate-400 font-medium">Select a digit pair above or draw on the canvas</p>
                <p className="text-[11px] text-slate-500 mt-1">
                  The tutor will diagnose common morphological pitfalls and explain stroke rules.
                </p>
              </div>
            )}
          </>
        ) : (
          /* Interactive Chat Stream */
          <div className="space-y-4">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`flex items-start space-x-2.5 ${
                  m.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {m.role === 'assistant' && (
                  <div className="w-7 h-7 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300 flex-shrink-0 mt-0.5">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-brand-600 text-white shadow-md'
                      : 'bg-slate-900/90 text-slate-200 border border-slate-800'
                  }`}
                >
                  <div className="whitespace-pre-wrap font-sans">{m.text}</div>
                </div>

                {m.role === 'user' && (
                  <div className="w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center text-white flex-shrink-0 mt-0.5">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex items-center space-x-2 text-xs text-indigo-300 p-2">
                <div className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" />
                <div className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce [animation-delay:0.2s]" />
                <div className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce [animation-delay:0.4s]" />
                <span className="text-slate-400 text-[11px] ml-1">Tutor is reasoning...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Quick Prompts (visible in Chat tab) */}
      {activeTab === 'chat' && (
        <div className="p-2 border-t border-slate-800/80 bg-slate-900/40">
          <div className="text-[10px] text-slate-500 font-medium px-2 mb-1">Quick Prompts:</div>
          <div className="flex flex-wrap gap-1.5 px-1">
            <button
              onClick={() => fetchTutorAdvice(null, 'Why is digit 1 commonly confused with 7?')}
              className="text-[10px] px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            >
              1 vs 7 Confusion
            </button>
            <button
              onClick={() => fetchTutorAdvice(null, 'How does Grad-CAM compute gradients in layer conv2_2?')}
              className="text-[10px] px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            >
              Grad-CAM Explanation
            </button>
            <button
              onClick={() => fetchTutorAdvice(null, 'How does LeCun aspect-ratio preserving centering work?')}
              className="text-[10px] px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            >
              LeCun Centering
            </button>
          </div>
        </div>
      )}

      {/* Input Box for Chat Tab */}
      {activeTab === 'chat' && (
        <div className="p-3 border-t border-slate-800 bg-slate-900/80">
          <form onSubmit={handleSendChat} className="flex items-center space-x-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about stroke mechanics, digit confusions, or CNN layers..."
              className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="p-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl text-white shadow-md shadow-indigo-600/30 transition-all"
              title="Send Prompt"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
