import React, { useState, useEffect } from 'react';
import { X, Globe, CheckCircle2, AlertCircle, RefreshCw, ExternalLink, Server, Sparkles } from 'lucide-react';
import { getApiBaseUrl, setCustomApiUrl, getApiUrl } from '../config.js';

export default function BackendConfigModal({ isOpen, onClose, onConnected }) {
  const [apiUrl, setApiUrl] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setApiUrl(getApiBaseUrl() || '');
      setTestResult(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTestAndSave = async (urlToTest = apiUrl) => {
    const cleanUrl = urlToTest.trim().replace(/\/+$/, '');
    setIsTesting(true);
    setTestResult(null);

    const testEndpoint = cleanUrl ? `${cleanUrl}/api/health` : '/api/health';

    try {
      const res = await fetch(testEndpoint, { method: 'GET' });
      if (res.ok) {
        const data = await res.json();
        setCustomApiUrl(cleanUrl);
        setTestResult({
          success: true,
          message: data.model_loaded
            ? 'Connected! Backend is healthy and CNN model is live.'
            : 'Connected to backend! (Model is warming up)'
        });
        if (onConnected) {
          onConnected(data);
        }
      } else {
        setTestResult({
          success: false,
          message: `Server returned HTTP ${res.status}. Ensure backend is fully started.`
        });
      }
    } catch (err) {
      setTestResult({
        success: false,
        message: 'Could not connect. Ensure the URL is correct, includes https://, and the service is running.'
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleResetToDefault = () => {
    setCustomApiUrl('');
    setApiUrl('');
    handleTestAndSave('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg glass-panel rounded-2xl p-6 border border-slate-700 shadow-2xl space-y-5 bg-[#0e1324]/95">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Backend API Connection</h3>
              <p className="text-xs text-slate-400">Configure your deployed Python Flask / CNN server</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Hosting Context */}
        <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs text-slate-300 space-y-2">
          <p className="text-slate-200 font-medium">Why is this needed?</p>
          <p className="text-slate-400 text-[11px] leading-relaxed">
            Vercel hosts the React frontend statically. The heavy TensorFlow machine learning model runs on Python/Flask
            and needs a cloud container like <strong>Render</strong>.
          </p>
        </div>

        {/* Input Form */}
        <div className="space-y-3">
          <label className="block text-xs font-semibold text-slate-300">
            Backend API Base URL
          </label>
          <div className="relative">
            <Globe className="w-4 h-4 absolute left-3 top-3 text-slate-500 pointer-events-none" />
            <input
              type="url"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              placeholder="https://digit-recognition-backend-xxxx.onrender.com"
              className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
          <p className="text-[11px] text-slate-500">
            Leave blank when developing locally (defaults to local proxy <code className="text-slate-400">/api</code>).
          </p>
        </div>

        {/* Test Result Feedback */}
        {testResult && (
          <div
            className={`p-3 rounded-xl border flex items-start space-x-2.5 text-xs ${
              testResult.success
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            }`}
          >
            {testResult.success ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
            )}
            <div className="flex-1 text-[11px] leading-snug">{testResult.message}</div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-2">
          <button
            onClick={handleResetToDefault}
            disabled={isTesting}
            className="text-xs text-slate-400 hover:text-white transition-colors underline underline-offset-2"
          >
            Reset to Local
          </button>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => handleTestAndSave(apiUrl)}
              disabled={isTesting}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 active:from-brand-700 text-white text-xs font-semibold shadow-md transition-all disabled:opacity-50"
            >
              {isTesting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Testing Connection...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Save & Connect</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Deployment Assistance Footer */}
        <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
          <span>Need a free backend host?</span>
          <a
            href="https://render.com/deploy?repo=https://github.com/SAICHANDU2481/Digit-Recognition-System"
            target="_blank"
            rel="noreferrer"
            className="flex items-center space-x-1 text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
          >
            <span>1-Click Deploy on Render</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  );
}
