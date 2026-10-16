import React, { useEffect } from 'react';
import { Sparkles, Clock, CheckCircle2, AlertTriangle, Eye, HelpCircle, ArrowUpRight } from 'lucide-react';
import confetti from 'canvas-confetti';

export default function PredictionDisplay({
  prediction,
  originalImage,
  onAskGemini,
  isPredicting
}) {
  // Fire subtle confetti on very high confidence prediction
  useEffect(() => {
    if (prediction && prediction.success && prediction.confidence >= 0.95) {
      try {
        confetti({
          particleCount: 28,
          spread: 60,
          origin: { y: 0.65 },
          colors: ['#6366f1', '#a855f7', '#38bdf8']
        });
      } catch (e) {
        // Confetti fallback
      }
    }
  }, [prediction]);

  if (isPredicting) {
    return (
      <div className="glass-panel rounded-2xl p-6 flex flex-col items-center justify-center min-h-[360px] animate-pulse">
        <div className="w-16 h-16 rounded-full border-4 border-brand-500/30 border-t-brand-500 animate-spin mb-4" />
        <p className="text-slate-300 font-semibold text-sm">Processing with CNN...</p>
        <p className="text-slate-500 text-xs mt-1">Centering, normalizing & running inference</p>
      </div>
    );
  }

  if (!prediction) {
    return (
      <div className="glass-panel rounded-2xl p-6 flex flex-col items-center justify-center min-h-[360px] text-center">
        <div className="w-16 h-16 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-center text-slate-500 mb-3">
          <Eye className="w-8 h-8 opacity-60" />
        </div>
        <h3 className="text-sm font-semibold text-slate-300">Awaiting Input</h3>
        <p className="text-xs text-slate-500 max-w-xs mt-1">
          Draw a digit on the canvas or capture with your webcam, then click <strong className="text-brand-400">Predict</strong>.
        </p>
      </div>
    );
  }

  if (prediction.is_blank) {
    return (
      <div className="glass-panel rounded-2xl p-6 flex flex-col items-center justify-center min-h-[360px] text-center border-amber-500/20">
        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-3">
          <AlertTriangle className="w-7 h-7" />
        </div>
        <h3 className="text-sm font-semibold text-amber-300">Blank Canvas Detected</h3>
        <p className="text-xs text-slate-400 max-w-xs mt-1">
          {prediction.error || "The image appears empty or the drawn strokes are too faint to extract."}
        </p>
      </div>
    );
  }

  if (!prediction.success) {
    return (
      <div className="glass-panel rounded-2xl p-6 flex flex-col items-center justify-center min-h-[360px] text-center border-rose-500/20">
        <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-3">
          <AlertTriangle className="w-7 h-7" />
        </div>
        <h3 className="text-sm font-semibold text-rose-300">Prediction Error</h3>
        <p className="text-xs text-slate-400 max-w-xs mt-1">
          {prediction.error || "Could not process image."}
        </p>
      </div>
    );
  }

  const { predicted_digit, confidence, probabilities, processed_image, duration_ms } = prediction;
  const confidencePercent = Math.round(confidence * 100);

  // Confidence styling
  let badgeColor = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
  if (confidence < 0.6) {
    badgeColor = 'bg-rose-500/20 text-rose-300 border-rose-500/40';
  } else if (confidence < 0.85) {
    badgeColor = 'bg-amber-500/20 text-amber-300 border-amber-500/40';
  }

  return (
    <div className="glass-panel rounded-2xl p-5 shadow-xl flex flex-col justify-between">
      {/* Top Banner: Predicted Digit & Confidence */}
      <div>
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 mb-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Prediction Output
          </span>
          <div className="flex items-center space-x-2">
            <span className="flex items-center text-[11px] text-slate-400 bg-slate-800/70 px-2 py-0.5 rounded-full border border-slate-700/60 font-mono">
              <Clock className="w-3 h-3 mr-1 text-slate-400" />
              {duration_ms} ms
            </span>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${badgeColor}`}>
              {confidencePercent}% Confident
            </span>
          </div>
        </div>

        {/* Hero Prediction Display */}
        <div className="flex items-center justify-between bg-slate-900/70 p-4 rounded-xl border border-slate-800/90 mb-5">
          <div className="flex items-center space-x-4">
            <div className="relative">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-brand-600 via-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                <span className="font-mono text-5xl font-extrabold text-white tracking-tight">
                  {predicted_digit}
                </span>
              </div>
              <div className="absolute -bottom-1 -right-1 p-1 bg-[#0c101d] rounded-full">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 fill-emerald-950" />
              </div>
            </div>

            <div>
              <p className="text-xs text-slate-400 font-medium">Classified Digit</p>
              <h2 className="text-2xl font-bold text-white tracking-tight">
                Digit {predicted_digit}
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {confidence >= 0.9
                  ? 'High certainty match'
                  : confidence >= 0.7
                  ? 'Moderate certainty'
                  : 'Ambiguous or low confidence'}
              </p>
            </div>
          </div>

          {/* Action buttons: Explain (Grad-CAM) & Ask Gemini */}
          <div className="flex items-center space-x-2">
            {onExplain && (
              <button
                onClick={() => onExplain && onExplain()}
                className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-indigo-200 text-xs font-semibold transition-all hover:scale-105 active:scale-95"
                title="Generate Grad-CAM heatmaps showing which pixels influenced this decision"
              >
                <Eye className="w-3.5 h-3.5 text-indigo-400" />
                <span className="hidden sm:inline">Explain</span>
              </button>
            )}

            <button
              onClick={() => onAskGemini && onAskGemini(prediction)}
              className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 text-purple-200 text-xs font-semibold transition-all hover:scale-105 active:scale-95"
              title="Ask Gemini AI to explain this classification or suggest handwriting tips"
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              <span className="hidden sm:inline">Ask AI</span>
            </button>
          </div>
        </div>

        {/* Image Comparison: Original vs Processed 28x28 (MNIST Center-of-Mass) */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800 flex flex-col items-center">
            <span className="text-[11px] font-medium text-slate-400 mb-2">Original Input</span>
            <div className="w-24 h-24 rounded-lg bg-black border border-slate-700/80 overflow-hidden flex items-center justify-center shadow-inner">
              {originalImage ? (
                <img src={originalImage} alt="Original Input" className="w-full h-full object-contain" />
              ) : (
                <span className="text-xs text-slate-600">None</span>
              )}
            </div>
            <span className="text-[10px] text-slate-500 mt-1.5 font-mono">User Drawing/Cam</span>
          </div>

          <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800 flex flex-col items-center">
            <span className="text-[11px] font-medium text-slate-400 mb-2">Processed 28×28</span>
            <div className="w-24 h-24 rounded-lg bg-black border border-brand-500/40 overflow-hidden flex items-center justify-center shadow-inner relative group">
              {processed_image ? (
                <img
                  src={processed_image}
                  alt="Preprocessed 28x28"
                  className="w-full h-full object-contain [image-rendering:pixelated]"
                />
              ) : (
                <span className="text-xs text-slate-600">None</span>
              )}
              <div className="absolute inset-0 bg-brand-500/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
            </div>
            <span className="text-[10px] text-brand-400 mt-1.5 font-mono">LeCun Centered</span>
          </div>
        </div>

        {/* 10-Class Probability Distribution Bars */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-medium text-slate-400 mb-1">
            <span>Class Probability Distribution</span>
            <span>0 to 9</span>
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
            {Object.entries(probabilities || {}).map(([digitKey, probValue]) => {
              const isWinner = parseInt(digitKey) === predicted_digit;
              const pct = Math.round(probValue * 100);
              return (
                <div key={digitKey} className="flex items-center space-x-2 text-xs">
                  <span
                    className={`w-4 font-mono font-bold text-center ${
                      isWinner ? 'text-brand-400' : 'text-slate-400'
                    }`}
                  >
                    {digitKey}
                  </span>
                  <div className="flex-1 h-3 rounded-full bg-slate-800/80 overflow-hidden relative border border-slate-700/40">
                    <div
                      className={`h-full transition-all duration-500 rounded-full ${
                        isWinner
                          ? 'bg-gradient-to-r from-brand-500 to-purple-500 shadow-sm'
                          : 'bg-slate-600/70'
                      }`}
                      style={{ width: `${Math.max(pct, probValue > 0 ? 3 : 0)}%` }}
                    />
                  </div>
                  <span
                    className={`w-10 text-right font-mono text-[11px] ${
                      isWinner ? 'text-white font-bold' : 'text-slate-500'
                    }`}
                  >
                    {pct}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
