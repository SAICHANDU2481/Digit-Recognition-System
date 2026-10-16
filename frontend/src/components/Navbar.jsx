import React from 'react';
import { Cpu, Activity, CheckCircle2, AlertTriangle, Sparkles, BookOpen, BarChart3, HelpCircle, Pencil } from 'lucide-react';

export default function Navbar({
  backendHealth,
  activeTab,
  setActiveTab,
  onOpenAssistant,
  onOpenHelp,
  onOpenBackendConfig,
}) {
  const isHealthy = backendHealth && backendHealth.status === 'healthy';
  const isModelLoaded = backendHealth && backendHealth.model_loaded;

  return (
    <header className="sticky top-0 z-40 w-full glass-panel border-b border-slate-800/80 bg-[#0c101d]/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo & Title */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 via-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/25">
              <span className="font-mono font-bold text-white text-lg tracking-wider">0-9</span>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-lg font-bold text-white tracking-tight">DigitVision AI</h1>
                <span className="px-2 py-0.5 text-[10px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-full">
                  v3.0 Multi-Digit
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">Advanced Handwritten Digit Recognition & Explainability</p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center space-x-1 sm:space-x-2 bg-slate-900/60 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setActiveTab('recognize')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'recognize'
                  ? 'bg-brand-600 text-white shadow-md shadow-brand-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>Recognize</span>
            </button>

            <button
              onClick={() => setActiveTab('practice')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'practice'
                  ? 'bg-brand-600 text-white shadow-md shadow-brand-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Pencil className="w-3.5 h-3.5" />
              <span>Practice Mode</span>
            </button>

            <button
              onClick={() => setActiveTab('metrics')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'metrics'
                  ? 'bg-brand-600 text-white shadow-md shadow-brand-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Model Metrics</span>
            </button>

            <button
              onClick={() => setActiveTab('resources')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'resources'
                  ? 'bg-brand-600 text-white shadow-md shadow-brand-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Resources</span>
            </button>
          </nav>

          {/* Backend Status & Gemini Assistant Trigger */}
          <div className="flex items-center space-x-3">
            {/* System Status Pill */}
            <button
              onClick={onOpenBackendConfig}
              className={`flex items-center space-x-2 px-2.5 py-1 rounded-full text-xs font-medium border transition-all hover:scale-105 active:scale-95 cursor-pointer ${
                isHealthy
                  ? isModelLoaded
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                    : 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20'
                  : 'bg-rose-500/10 text-rose-400 border-rose-500/30 hover:bg-rose-500/20'
              }`}
              title="Click to view or configure Backend API connection"
            >
              <span className="relative flex h-2 w-2">
                <span
                  className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    isHealthy ? (isModelLoaded ? 'bg-emerald-400' : 'bg-amber-400') : 'bg-rose-400'
                  }`}
                ></span>
                <span
                  className={`relative inline-flex rounded-full h-2 w-2 ${
                    isHealthy ? (isModelLoaded ? 'bg-emerald-500' : 'bg-amber-500') : 'bg-rose-500'
                  }`}
                ></span>
              </span>
              <span>
                {isHealthy
                  ? isModelLoaded
                    ? 'CNN Model Live'
                    : 'Backend Ready (Model Unloaded)'
                  : backendHealth === null
                  ? 'Connecting...'
                  : 'Backend Offline'}
              </span>
            </button>

            {/* AI Assistant Button */}
            <button
              onClick={onOpenAssistant}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-medium shadow-md shadow-purple-600/25 transition-all hover:scale-105 active:scale-95"
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-200" />
              <span className="hidden sm:inline">Gemini AI</span>
            </button>

            {/* Help & Info */}
            <button
              onClick={onOpenHelp}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 transition-colors"
              title="About & Guide"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
