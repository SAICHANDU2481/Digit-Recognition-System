import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Send, Bot, User, X, AlertCircle, Key, RefreshCw } from 'lucide-react';
import { getApiUrl } from '../config.js';

export default function GeminiAssistant({ isOpen, onClose, activePrediction }) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: "👋 Hi! I'm your Gemini AI Handwriting & CNN Assistant. Ask me how the convolutional neural network works, how to improve handwritten digits for higher recognition accuracy, or why a specific digit was classified with certain probabilities!"
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isConfigured, setIsConfigured] = useState(true);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  // When activePrediction changes and assistant is open, suggest prompt
  useEffect(() => {
    if (activePrediction && activePrediction.success && isOpen) {
      // Suggest context inquiry
    }
  }, [activePrediction, isOpen]);

  const handleSend = async (customPrompt) => {
    const promptToSend = customPrompt || input.trim();
    if (!promptToSend || loading) return;

    const userMsg = { role: 'user', text: promptToSend };
    setMessages((prev) => [...prev, userMsg]);
    if (!customPrompt) setInput('');
    setLoading(true);

    try {
      const res = await fetch(getApiUrl('/api/assistant'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: promptToSend,
          context: activePrediction && activePrediction.success ? {
            predicted_digit: activePrediction.predicted_digit,
            confidence: activePrediction.confidence,
            probabilities: activePrediction.probabilities
          } : null
        })
      });

      const data = await res.json();

      if (data.configured === false) {
        setIsConfigured(false);
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            text: data.message || "Gemini API key is not configured. Add your GEMINI_API_KEY in backend/.env to enable live AI responses."
          }
        ]);
      } else if (res.ok && data.success) {
        setMessages((prev) => [...prev, { role: 'assistant', text: data.reply }]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            text: `Error: ${data.error || 'Failed to reach Gemini API.'}`
          }
        ]);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: `Network Error: Could not connect to backend assistant endpoint.`
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[480px] bg-[#0c101d] border-l border-slate-800 shadow-2xl flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/60 backdrop-blur-md">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-purple-600/30">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white flex items-center space-x-1.5">
              <span>Gemini AI Assistant</span>
              <span className="text-[10px] px-1.5 py-0.2 bg-purple-500/20 text-purple-300 rounded border border-purple-500/30">
                GenAI SDK
              </span>
            </h2>
            <p className="text-[11px] text-slate-400">Handwriting & CNN Architectural Insights</p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Unconfigured Alert Notice if API key missing */}
      {!isConfigured && (
        <div className="m-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start space-x-2">
          <Key className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Gemini API Key Required</p>
            <p className="text-[11px] text-slate-300 mt-0.5">
              To chat with live Gemini AI, add your free key to <code className="bg-slate-900 px-1 rounded text-amber-200">backend/.env</code>:
              <br />
              <code className="text-[10px] text-emerald-300 select-all block mt-1">GEMINI_API_KEY=AIzaSy...</code>
            </p>
          </div>
        </div>
      )}

      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((m, idx) => (
          <div
            key={idx}
            className={`flex items-start space-x-2.5 ${
              m.role === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            {m.role === 'assistant' && (
              <div className="w-7 h-7 rounded-lg bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-300 flex-shrink-0 mt-0.5">
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
          <div className="flex items-center space-x-2 text-xs text-purple-300 p-2">
            <div className="w-2 h-2 rounded-full bg-purple-400 animate-bounce" />
            <div className="w-2 h-2 rounded-full bg-purple-400 animate-bounce [animation-delay:0.2s]" />
            <div className="w-2 h-2 rounded-full bg-purple-400 animate-bounce [animation-delay:0.4s]" />
            <span className="text-slate-400 text-[11px] ml-1">Gemini is reasoning...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Prompt Chips */}
      <div className="p-2 border-t border-slate-800/80 bg-slate-900/40">
        <div className="text-[10px] text-slate-500 font-medium px-2 mb-1">Quick Prompts:</div>
        <div className="flex flex-wrap gap-1.5 px-1">
          {activePrediction && activePrediction.success && (
            <button
              onClick={() => handleSend(`Why did the model classify this as digit ${activePrediction.predicted_digit} with ${(activePrediction.confidence * 100).toFixed(1)}% confidence?`)}
              className="text-[11px] px-2 py-1 rounded-lg bg-purple-950/60 hover:bg-purple-900/80 border border-purple-500/40 text-purple-300 text-left transition-colors"
            >
              🔍 Explain Current Prediction ({activePrediction.predicted_digit})
            </button>
          )}
          <button
            onClick={() => handleSend('How does the LeCun MNIST centering algorithm work?')}
            className="text-[11px] px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition-colors"
          >
            📐 MNIST Centering Algorithm
          </button>
          <button
            onClick={() => handleSend('How do convolutional layers extract edges and curves from handwritten digits?')}
            className="text-[11px] px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition-colors"
          >
            🧠 How Conv2D Works
          </button>
          <button
            onClick={() => handleSend('What tips can help make handwritten digits 1, 7, 3, and 8 clearer for computer vision?')}
            className="text-[11px] px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition-colors"
          >
            ✍️ Handwriting Clarity Tips
          </button>
        </div>
      </div>

      {/* Input Box */}
      <div className="p-3 border-t border-slate-800 bg-slate-900/80">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center space-x-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask Gemini about the model or digit recognition..."
            className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="p-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl text-white shadow-md shadow-purple-600/30 transition-all"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
